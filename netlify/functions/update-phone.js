exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, X-Admin-Token, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing Supabase vars' }) };
    }

    // Verify token (either Admin token or Student JWT)
    const adminToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
    const validAdminTokens = [process.env.ADMIN_SECRET].filter(Boolean);
    const isAdmin = adminToken && validAdminTokens.includes(adminToken);

    let authenticatedUsername = null;
    if (!isAdmin) {
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const jwt = require('jsonwebtoken');
            const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
            try {
                const decoded = jwt.verify(token, jwtSecret);
                authenticatedUsername = decoded.username;
            } catch (e) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token invalid sau expirat.' }) };
            }
        } else {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Autentificare necesară.' }) };
        }
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { student_id, username, phone_number } = body;

        if (!student_id || !username || !phone_number) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Student ID, Username și Numarul de telefon sunt obligatorii' }) };
        }

        if (!isAdmin && authenticatedUsername && authenticatedUsername.toLowerCase() !== (username || '').toLowerCase()) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Nu ai permisiunea de a modifica acest profil.' }) };
        }

        // Validate Romanian phone number (starts with 07, exactly 10 digits)
        const phoneRegex = /^07\d{8}$/;
        if (!phoneRegex.test(phone_number)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Format numar invalid. Trebuie sa fie de tipul 07XXXXXXXX (10 cifre).' }) };
        }

        const res = await fetch(`${supabaseUrl}/rest/v1/students?id=eq.${student_id}&username=ilike.${encodeURIComponent(username)}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ phone_number })
        });

        if (!res.ok) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Eroare la baza de date la actualizarea numarului' }) };
        }

        const data = await res.json();
        
        if (data.length === 0) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Utilizator negasit' }) };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };

    } catch (e) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Eroare interna de server' })
        };
    }
};
