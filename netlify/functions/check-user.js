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

        if (data && data.length > 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    exists: true,
                    name: data[0].student_name,
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
                body: JSON.stringify({ exists: false, history: [] })
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
