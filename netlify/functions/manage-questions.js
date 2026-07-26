exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    const adminToken = process.env.ADMIN_SECRET || 'admin123';

    if (event.headers['x-admin-token'] !== adminToken) {
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
        const method = event.httpMethod;
        const params = event.queryStringParameters || {};

        if (method === 'POST') {
            const body = JSON.parse(event.body);
            const { difficulty, type, category, subcategory, text, code, options_json, correct_index, explanation } = body;

            if (!difficulty || !type || !text || !options_json || correct_index === undefined || !explanation) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing required fields.' })
                };
            }

            const response = await fetch(`${supabaseUrl}/rest/v1/questions`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    difficulty,
                    type,
                    category: category || null,
                    subcategory: subcategory || null,
                    text,
                    code: code || null,
                    options_json: typeof options_json === 'string' ? JSON.parse(options_json) : options_json,
                    correct_index: parseInt(correct_index),
                    explanation
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Insert failed: ${response.status} - ${errText}`);
            }

            const data = await response.json();
            return { statusCode: 201, headers, body: JSON.stringify({ success: true, data }) };

        } else if (method === 'PUT') {
            const id = params.id;
            if (!id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing question id.' }) };
            }

            const body = JSON.parse(event.body);

            // If options_json is a string, parse it
            if (body.options_json && typeof body.options_json === 'string') {
                body.options_json = JSON.parse(body.options_json);
            }
            if (body.correct_index !== undefined) {
                body.correct_index = parseInt(body.correct_index);
            }

            const response = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Update failed: ${response.status} - ${errText}`);
            }

            const data = await response.json();
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };

        } else if (method === 'DELETE') {
            const id = params.id;
            if (!id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing question id.' }) };
            }

            const response = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${id}`, {
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

            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed.' }) };
    } catch (error) {
        console.error('manage-questions error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};
