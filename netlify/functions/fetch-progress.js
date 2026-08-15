exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase env missing' }) };
    }

    const student_username = event.queryStringParameters.student_username;
    const assigned_test_id = event.queryStringParameters.assigned_test_id;

    if (!student_username || !assigned_test_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing parameters' }) };
    }

    try {
        const queryUrl = `${supabaseUrl}/rest/v1/results?student_username=eq.${encodeURIComponent(student_username)}&test_type=eq.progress_${assigned_test_id}&select=*&limit=1`;
        
        const response = await fetch(queryUrl, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Supabase fetch failed`);
        }

        const data = await response.json();
        
        if (data.length > 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    has_progress: true,
                    answers_json: data[0].answers_json,
                    current_index: data[0].score, // we stored current_index in score
                    time_taken_ms: data[0].time_taken_ms
                })
            };
        } else {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ has_progress: false })
            };
        }
    } catch (error) {
        console.error('Error fetching progress:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
