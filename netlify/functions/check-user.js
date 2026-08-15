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
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase env variables missing' }) };
    }

    try {
        const body = JSON.parse(event.body);
        const { username } = body;

        if (!username) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Username is required' }) };
        }

        // Query recent results for this student across all identifier fields
        const encodedUsername = encodeURIComponent(username);
        const url = `${supabaseUrl}/rest/v1/results?or=(student_username.eq.${encodedUsername},student_name.eq.${encodedUsername})&order=created_at.desc&limit=5`;
        const response = await fetch(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Supabase error: ${response.status} - ${errText}`);
        }

        const data = await response.json();

        // Check if phone number exists
        const stdUrl = `${supabaseUrl}/rest/v1/students?username=eq.${encodedUsername}&select=phone_number`;
        const stdRes = await fetch(stdUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
        let phoneNumber = null;
        if (stdRes.ok) {
            const stdData = await stdRes.json();
            if (stdData.length > 0) {
                phoneNumber = stdData[0].phone_number;
            }
        }

        if (data && data.length > 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    exists: true,
                    name: data[0].student_name,
                    phone_number: phoneNumber,
                    history: data.map(d => ({
                        test_type: d.test_type,
                        score: d.score,
                        total_points: d.total_points,
                        created_at: d.created_at
                    }))
                })
            };
        } else {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ exists: false, history: [], phone_number: phoneNumber })
            };
        }
    } catch (error) {
        console.error('check-user error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};
