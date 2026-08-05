const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin';
const validTokens = [ADMIN_SECRET].filter(Boolean);

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, X-Admin-Token',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const token = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
    if (!token || !validTokens.includes(token)) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing Supabase vars' }) };
    }

    const STUDENTS_ENDPOINT = `${supabaseUrl}/rest/v1/students`;

    try {
        if (event.httpMethod === 'GET') {
            const res = await fetch(`${STUDENTS_ENDPOINT}?select=*&order=created_at.desc`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (!res.ok) throw new Error('Eroare la preluare elevi');
            const data = await res.json();
            return { statusCode: 200, headers, body: JSON.stringify(data) };
        } 
        
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            if (!body.username || !body.password) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Username și parola sunt obligatorii' }) };
            }
            const res = await fetch(STUDENTS_ENDPOINT, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ username: body.username, password: body.password })
            });
            if (!res.ok) {
                const err = await res.text();
                if (err.includes('duplicate key value violates unique constraint')) {
                    return { statusCode: 409, headers, body: JSON.stringify({ error: 'Username-ul există deja!' }) };
                }
                throw new Error('Eroare la crearea elevului: ' + err);
            }
            const data = await res.json();
            return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
        }

        if (event.httpMethod === 'DELETE') {
            const id = event.queryStringParameters.id;
            if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID obligatoriu' }) };

            const res = await fetch(`${STUDENTS_ENDPOINT}?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (!res.ok) throw new Error('Eroare la ștergerea elevului');
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    } catch (e) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || 'Eroare internă' }) };
    }
};
