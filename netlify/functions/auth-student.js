let rateLimitCache = {};
const RATE_LIMIT_MS = 60000;
const MAX_REQUESTS_PER_MIN = 15;

exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, X-Admin-Token',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const ip = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    if (!rateLimitCache[ip]) {
        rateLimitCache[ip] = { count: 1, first: now };
    } else {
        if (now - rateLimitCache[ip].first > RATE_LIMIT_MS) {
            rateLimitCache[ip] = { count: 1, first: now };
        } else {
            rateLimitCache[ip].count++;
        }
    }

    if (rateLimitCache[ip].count > MAX_REQUESTS_PER_MIN) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'Prea multe încercări. Te rugăm să aștepți un minut.' }) };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing Supabase vars' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { username, password } = body;
        const cleanUsername = (username || '').trim().toLowerCase();
        // Escape SQL wildcard characters to prevent ilike injection
        const safeUsername = cleanUsername.replace(/[%_]/g, '\\$&');
        const cleanPassword = (password || '').trim();

        if (!cleanUsername || !cleanPassword) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Username și parola sunt obligatorii' }) };
        }

        const res = await fetch(`${supabaseUrl}/rest/v1/students?username=ilike.${encodeURIComponent(safeUsername)}&select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!res.ok) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Eroare la baza de date' }) };
        }

        const data = await res.json();

        if (data.length === 0) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Utilizator negăsit' }) };
        }

        const student = data[0];
        let isPasswordValid = (student.password === cleanPassword);

        if (!isPasswordValid) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Parolă incorectă' }) };
        }

        const utils = require('./_utils');
        const jwt = require('jsonwebtoken');
        const jwtSecret = utils.getLiveEnv('JWT_SECRET', process.env.JWT_SECRET);
        if (!jwtSecret) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Eroare server: JWT_SECRET lipsă.' }) };
        }
        
        const hashPrefix = (student.password || '').substring(0, 15);
        const token = jwt.sign(
            { username: student.username, id: student.id, hashPrefix: hashPrefix },
            jwtSecret,
            { expiresIn: '30d' }
        );

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Autentificare cu succes',
                token: token,
                student: {
                    id: student.id,
                    username: student.username,
                    phone_number: student.phone_number
                }
            })
        };

    } catch (e) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Eroare internă de server' })
        };
    }
};