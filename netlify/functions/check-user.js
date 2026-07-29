exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
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
        const { email } = body;

        if (!email) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email is required' }) };
        }

        // Query the most recent result for this email
        const url = `${supabaseUrl}/rest/v1/results?student_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`;
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
                body: JSON.stringify({ exists: true, name: data[0].student_name })
            };
        } else {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ exists: false })
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
