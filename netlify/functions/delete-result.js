exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': 'https://acadeinformatica.netlify.app',
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
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};
