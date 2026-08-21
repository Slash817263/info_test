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
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase env variables missing' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { username } = body;
        const cleanUsername = (username || '').trim().toLowerCase();
        if (!cleanUsername) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Username is required' }) };
        }

        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token lipsa' }) };
        }

        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
        let decoded;
        try {
            decoded = jwt.verify(token, jwtSecret);
        } catch(e) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token invalid sau expirat' }) };
        }
        
        if ((decoded.username || '').toLowerCase() !== cleanUsername) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token mismatch cu username' }) };
        }

        const safeUsername = cleanUsername.replace(/[%_]/g, '\\$&');
        const encodedUsername = encodeURIComponent(cleanUsername);
        
        // Verificam hash-ul parolei pentru a asigura delogarea daca parola s-a schimbat
        const stdUrl = `${supabaseUrl}/rest/v1/students?username=ilike.${encodeURIComponent(safeUsername)}&select=password,phone_number`;
        const stdRes = await fetch(stdUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
        let phoneNumber = null;
        if (stdRes.ok) {
            const stdData = await stdRes.json();
            if (stdData.length > 0) {
                const currentHashPrefix = (stdData[0].password || '').substring(0, 15);
                if (currentHashPrefix !== decoded.hashPrefix) {
                    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Parola a fost modificata. Va rugam sa va relogati.' }) };
                }
                phoneNumber = stdData[0].phone_number;
            } else {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Utilizatorul nu mai exista' }) };
            }
        }

        // Query results for this student (lightweight metadata)
        const url = `${supabaseUrl}/rest/v1/results?or=(student_username.ilike.${encodeURIComponent(safeUsername)},student_name.ilike.${encodeURIComponent(safeUsername)})&select=id,student_name,test_type,score,total_points,created_at&order=created_at.desc`;
        const response = await fetch(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        const data = response.ok ? await response.json() : [];
        const finalData = data.filter(d => !d.test_type || !d.test_type.startsWith('progress_')); // excludem salvari partiale

        const hasCompletedInitial = finalData.some(d => {
            if (!d.test_type) return true; // legacy tests before test_type existed were initial
            const t = d.test_type.toLowerCase().trim();
            if (t === 'initial' || t.startsWith('initial')) return true;
            if (!t.startsWith('intermediar') && !t.startsWith('tema') && !t.startsWith('progress_')) return true;
            return false;
        });

        const studentDisplayName = (finalData.length > 0 && finalData[0].student_name) ? finalData[0].student_name : cleanUsername;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                exists: true,
                name: studentDisplayName,
                phone_number: phoneNumber,
                hasCompletedInitial: hasCompletedInitial,
                history: finalData.slice(0, 10).map(d => ({
                    test_type: d.test_type,
                    score: d.score,
                    total_points: d.total_points,
                    created_at: d.created_at
                }))
            })
        };
    } catch (error) {
        console.error('check-user error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};
