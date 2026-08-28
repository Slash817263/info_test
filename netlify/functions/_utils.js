// netlify/functions/_utils.js
const jwt = require('jsonwebtoken');

function getCorsHeaders(event) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    
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
    const adminToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
    if (!adminToken) return false;
    const expectedToken = process.env.ADMIN_SECRET;
    if (!expectedToken) return false;
    if (adminToken === expectedToken) return true;
    try {
        const decoded = jwt.verify(adminToken, expectedToken);
        return decoded && decoded.role === 'admin';
    } catch(e) {
        return false;
    }
}

function parseJwt(event) {
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
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
            if (match && match[1]) {
                return match[1].trim();
            }
        }
    } catch (e) {
        // ignore
    }
    return process.env[key] || fallback;
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
        
        let expireDate;
        if (expiresAt.includes('/')) {
            const parts = expiresAt.split('/');
            if (parts.length === 3) {
                // Assuming DD/MM/YYYY
                expireDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
            } else {
                expireDate = new Date(expiresAt);
            }
        } else {
            expireDate = new Date(expiresAt);
        }

        const today = new Date();
        // Ștergem orele pentru a compara doar ziua (expire la sfârșitul zilei respective)
        today.setHours(0, 0, 0, 0);
        
        if (!isNaN(expireDate.getTime())) {
            expireDate.setHours(0, 0, 0, 0);
            return expireDate >= today;
        }
        
        // If invalid date, fallback to true so we don't accidentally block
        return true;
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

module.exports = {
    getCorsHeaders,
    verifyAdminToken,
    parseJwt,
    getLiveEnv,
    createErrorResponse,
    isStudentSubscriptionActive
};
