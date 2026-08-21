exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, X-Admin-Token, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    const validTokens = [process.env.ADMIN_SECRET].filter(Boolean);
    const clientToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
    const isAdmin = clientToken && validTokens.includes(clientToken);

    const params = event.queryStringParameters || {};
    const requestedUsername = params.username;
    
    if (!isAdmin) {
        if (!requestedUsername) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Unauthorized: Trebuie să fii admin.' })
            };
        }
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Autentificare necesară.' }) };
        }
        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
        try {
            const decoded = jwt.verify(token, jwtSecret);
            if ((decoded.username || '').toLowerCase() !== (requestedUsername || '').toLowerCase()) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
            }
        } catch(e) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token invalid' }) };
        }
    }

    if (!supabaseUrl || !supabaseKey) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Supabase environment variables are missing.' })
        };
    }

    try {
        let url = `${supabaseUrl}/rest/v1/results?select=*&order=created_at.desc`;
        if (requestedUsername) {
            url += `&or=(student_username.eq.${encodeURIComponent(requestedUsername)},student_name.eq.${encodeURIComponent(requestedUsername)})`;
        }

        const response = await fetch(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Supabase query failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const filteredData = data.filter(d => !d.test_type || !d.test_type.startsWith('progress_'));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(filteredData)
        };
    } catch (error) {
        console.error('Error fetching results:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};
