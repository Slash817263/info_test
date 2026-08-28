exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, X-Admin-Token',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'DELETE') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    const validTokens = [process.env.ADMIN_SECRET].filter(Boolean);
    const clientToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];

    if (!clientToken || !validTokens.includes(clientToken)) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Unauthorized: Invalid Admin Token' })
        };
    }

    if (!supabaseUrl || !supabaseKey) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Supabase environment variables are missing.' })
        };
    }

    try {
        const params = event.queryStringParameters || {};
        const id = params.id;

        if (!id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing result id.' })
            };
        }

        // 1. Fetch the result to see if it belongs to an assigned test
        const getRes = await fetch(`${supabaseUrl}/rest/v1/results?id=eq.${id}&select=details_json,test_type`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        
        let assignedTestId = null;
        if (getRes.ok) {
            const getJson = await getRes.json();
            if (getJson.length > 0) {
                const details = getJson[0].details_json;
                if (Array.isArray(details) && details.length > 0 && details[0].assigned_test_id) {
                    assignedTestId = details[0].assigned_test_id;
                }
            }
        }

        // 2. Delete the result
        const response = await fetch(`${supabaseUrl}/rest/v1/results?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Delete failed: ${response.status} - ${errText}`);
        }

        // 3. If it was an assigned test, revert it to pending and add 1 day
        if (assignedTestId) {
            const newDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await fetch(`${supabaseUrl}/rest/v1/assigned_tests?id=eq.${assignedTestId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'pending', deadline: newDeadline })
            });
            
            // Clean up any remaining progress row just in case
            await fetch(`${supabaseUrl}/rest/v1/results?test_type=eq.progress_${assignedTestId}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('delete-result error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
