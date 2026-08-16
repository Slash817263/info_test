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

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing Supabase vars' }) };
    }

    try {
        const body = JSON.parse(event.body);
        const { username, password } = body;

        if (!username || !password) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Username și parola sunt obligatorii' }) };
        }

        const res = await fetch(`${supabaseUrl}/rest/v1/students?username=eq.${encodeURIComponent(username)}&select=*`, {
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
        const bcrypt = require('bcryptjs');

        let isPasswordValid = false;

        // Check password (supports both plain text and bcrypt hash)
        if (student.password.startsWith('$2')) {
            isPasswordValid = bcrypt.compareSync(password, student.password);
            if (isPasswordValid) {
                // Restore plain text in database so admin can view it directly
                fetch(`${supabaseUrl}/rest/v1/students?id=eq.${student.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ password: password })
                }).catch(err => console.error('Eroare restabilire parola plain:', err));
            }
        } else {
            isPasswordValid = (student.password === password);
        }

        if (!isPasswordValid) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Parolă incorectă' }) };
        }

        const jwt = require('jsonwebtoken');
        const hashPrefix = student.password.substring(0, 15);
        const token = jwt.sign(
            { username: student.username, id: student.id, hashPrefix: hashPrefix },
            process.env.SUPABASE_KEY,
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