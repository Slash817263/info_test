const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const fs = require('fs');
const path = require('path');

function getLiveEnv(key, fallback = '') {
    try {
        const envCandidates = [
            path.resolve(__dirname, '../../.env'),
            path.resolve(__dirname, '../.env'),
            path.resolve(process.cwd(), '.env')
        ];
        for (const p of envCandidates) {
            if (fs.existsSync(p)) {
                const content = fs.readFileSync(p, 'utf8');
                for (const line of content.split('\n')) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                        const idx = trimmed.indexOf('=');
                        const k = trimmed.slice(0, idx).trim();
                        const v = trimmed.slice(idx + 1).trim();
                        if (k === key) return v;
                    }
                }
            }
        }
    } catch (e) {}
    return process.env[key] || fallback;
}

const rateLimitCache = {};

exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { password } = body;
        const adminSecret = getLiveEnv('ADMIN_SECRET', process.env.ADMIN_SECRET || '');

        const clientIp = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
        const now = Date.now();
        if (!rateLimitCache[clientIp]) rateLimitCache[clientIp] = { attempts: 0, lockUntil: 0 };
        const record = rateLimitCache[clientIp];

        if (record.lockUntil > now) {
            return { statusCode: 429, headers, body: JSON.stringify({ error: 'Prea multe încercări. Așteaptă.' }) };
        }

        const providedBuf = Buffer.from(password || '');
        const secretBuf = Buffer.from(adminSecret);
        let isMatch = false;

        if (providedBuf.length === secretBuf.length && secretBuf.length > 0) {
            isMatch = crypto.timingSafeEqual(providedBuf, secretBuf);
        }

        if (!isMatch) {
            record.attempts++;
            if (record.attempts >= 5) {
                record.lockUntil = now + 15 * 60 * 1000;
            }
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Parolă incorectă' })
            };
        }

        record.attempts = 0;
        record.lockUntil = 0;

        const token = jwt.sign({ role: 'admin' }, adminSecret, { expiresIn: '24h' });
        
        const isHttps = origin.startsWith('https') || (event.headers && event.headers['x-forwarded-proto'] === 'https');
        const secureFlag = isHttps ? 'Secure; ' : '';
        const cookieStr = `admin_token=${token}; HttpOnly; ${secureFlag}SameSite=Lax; Path=/; Max-Age=86400`;

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Set-Cookie': cookieStr
            },
            body: JSON.stringify({ success: true, message: 'Autentificare cu succes' })
        };
    } catch (e) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Eroare server' })
        };
    }
};
