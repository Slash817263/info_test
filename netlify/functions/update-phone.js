exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': 'https://acadeinformatica.netlify.app',
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

    const validTokens = [process.env.ADMIN_SECRET].filter(Boolean);
    const clientToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
    if (!clientToken || !validTokens.includes(clientToken)) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing Supabase vars' }) };
    }

    try {
        const body = JSON.parse(event.body);
        const { student_id, phone_number } = body;

        if (!student_id || !phone_number) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Student ID ?i Numarul de telefon sunt obligatorii' }) };
        }

        // Validate Romanian phone number (starts with 07, exactly 10 digits)
        const phoneRegex = /^07\d{8}$/;
        if (!phoneRegex.test(phone_number)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Format numar invalid. Trebuie sa fie de tipul 07XXXXXXXX (10 cifre).' }) };
        }

        const res = await fetch(`${supabaseUrl}/rest/v1/students?id=eq.${student_id}`, {
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
