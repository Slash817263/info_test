const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function getCorsHeaders(event) {
    const origin = (event && event.headers && (event.headers.origin || event.headers.Origin)) || '';
    
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    return {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, X-Admin-Token, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };
}

function verifyAdminToken(event) {
    if (!event || !event.headers) return false;

    let adminToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];

    if (!adminToken && event.headers.authorization) {
        const auth = event.headers.authorization;
        if (auth.startsWith('Bearer ')) adminToken = auth.substring(7).trim();
    } else if (!adminToken && event.headers.Authorization) {
        const auth = event.headers.Authorization;
        if (auth.startsWith('Bearer ')) adminToken = auth.substring(7).trim();
    }

    if (!adminToken) {
        const cookieHeader = event.headers.cookie || event.headers.Cookie || '';
        const match = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]+)/);
        if (match) {
            adminToken = decodeURIComponent(match[1]).trim();
        }
    }

    if (!adminToken) return false;

    const expectedToken = getLiveEnv('ADMIN_SECRET', process.env.ADMIN_SECRET);
    if (!expectedToken) return false;

    // Direct secret match
    if (adminToken === expectedToken) return true;

    // JWT verification
    try {
        const decoded = jwt.verify(adminToken, expectedToken);
        return decoded && decoded.role === 'admin';
    } catch(e) {
        return false;
    }
}

function parseJwt(event) {
    if (!event || !event.headers) return null;
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.substring(7);
    const jwtSecret = getLiveEnv('JWT_SECRET', process.env.JWT_SECRET);
    if (!jwtSecret) return null;
    try {
        return jwt.verify(token, jwtSecret);
    } catch (e) {
        return null;
    }
}

// Bypasses cached netlify dev env vars for specific keys
function getLiveEnv(key, fallback = '') {
    try {
        const fs = require('fs');
        const path = require('path');
        const envCandidates = [
            path.resolve(__dirname, '../../.env'),
            path.resolve(__dirname, '../.env'),
            path.resolve(process.cwd(), '.env')
        ];
        for (const envPath of envCandidates) {
            if (fs.existsSync(envPath)) {
                const content = fs.readFileSync(envPath, 'utf-8');
                const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
                if (match && match[1]) {
                    return match[1].trim();
                }
            }
        }
    } catch (e) {
        // ignore
    }
    return process.env[key] || fallback;
}

function hashPassword(password) {
    if (!password) return '';
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `$scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
    if (!storedHash || !password) return false;
    // Backward compatibility for existing plaintext passwords
    if (!storedHash.startsWith('$scrypt$')) {
        return storedHash === password;
    }
    try {
        const parts = storedHash.split('$');
        if (parts.length !== 4) return false;
        const salt = parts[2];
        const originalHash = parts[3];
        const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
        const origBuf = Buffer.from(originalHash, 'hex');
        const verBuf = Buffer.from(verifyHash, 'hex');
        if (origBuf.length !== verBuf.length) return false;
        return crypto.timingSafeEqual(origBuf, verBuf);
    } catch(e) {
        return false;
    }
}

function parseExpirationDate(expiresAt) {
    if (!expiresAt) return null;
    let y, m, d;
    if (expiresAt.includes('/')) {
        const parts = expiresAt.split('/');
        if (parts.length === 3) {
            d = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10);
            y = parseInt(parts[2], 10);
        }
    } else if (expiresAt.includes('-')) {
        const parts = expiresAt.split('T')[0].split('-');
        if (parts.length === 3) {
            y = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10);
            d = parseInt(parts[2], 10);
        }
    }
    if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function isStudentSubscriptionActive(supabaseUrl, supabaseKey, username) {
    if (!username) return false;
    try {
        const cleanUsername = username.trim().toLowerCase().replace(/[%_]/g, '\\$&');
        let res = await fetch(`${supabaseUrl}/rest/v1/students?username=ilike.${encodeURIComponent(cleanUsername)}&select=expires_at`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        
        let data = [];
        if (res.ok) {
            data = await res.json();
        } else {
            // Fallback: column might not exist
            res = await fetch(`${supabaseUrl}/rest/v1/students?username=ilike.${encodeURIComponent(cleanUsername)}&select=id`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (!res.ok) return false;
            data = await res.json();
            // If user exists but no expires_at column, they are active
            if (data && data.length > 0) return true;
        }

        if (!data || data.length === 0) return false;

        const expiresAt = data[0].expires_at;
        if (!expiresAt) return true; // Nelimitat dacă nu are expires_at
        
        const expStr = parseExpirationDate(expiresAt);
        if (!expStr) return true; // If invalid date format, fallback to true

        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' });
        const todayStr = formatter.format(new Date());

        return expStr >= todayStr;
    } catch(e) {
        console.error('Eroare verificare abonament', e);
        return false;
    }
}

function createErrorResponse(statusCode, message, corsHeaders, error = null) {
    if (error) console.error(`[API Error ${statusCode}]`, message, error);
    return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify({ error: message })
    };
}

async function fetchAllSupabaseRows(baseEndpoint, supabaseKey) {
    let all = [];
    let from = 0;
    const chunkSize = 1000;
    while (true) {
        let url = baseEndpoint;
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}offset=${from}&limit=${chunkSize}`;
        
        const res = await fetch(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': 'Bearer ' + supabaseKey
            }
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Supabase fetch failed: ${res.status} - ${errText}`);
        }
        const chunk = await res.json();
        all = all.concat(chunk);
        if (chunk.length < chunkSize) break;
        from += chunkSize;
    }
    return all;
}

function getClientIp(event) {
    if (!event || !event.headers) return 'unknown';
    const forwarded = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
    const forwardedIp = forwarded ? forwarded.split(',')[0].trim() : null;
    return event.headers['cf-connecting-ip'] ||
           event.headers['CF-Connecting-IP'] ||
           event.headers['x-nf-client-connection-ip'] ||
           forwardedIp ||
           event.headers['client-ip'] ||
           'unknown';
}

module.exports = {
    getCorsHeaders,
    verifyAdminToken,
    parseJwt,
    getLiveEnv,
    createErrorResponse,
    isStudentSubscriptionActive,
    fetchAllSupabaseRows,
    hashPassword,
    verifyPassword,
    parseExpirationDate,
    getClientIp
};
