exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, X-Admin-Token',
        'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
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
        const method = event.httpMethod;
        const params = event.queryStringParameters || {};

        function normalizeExamType(et) {
            if (!et) return 'Diverse';
            let types = et.split(',').map(s => s.trim()).filter(Boolean);
            if (types.includes('Initial')) {
                if (types.includes('BAC')) return 'Initial,BAC';
                if (types.includes('Academie')) return 'Initial,Academie';
                if (types.includes('Poli')) return 'Initial,Poli';
                return 'Initial,Diverse';
            }
            return types.join(',');
        }

        if (method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { exam_type, difficulty, type, category, subcategory, text, image_url, code, options_json, correct_index, hint, explanation } = body;

            if (!exam_type || !difficulty || !type || !text || !options_json || correct_index === undefined) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing required fields.' })
                };
            }

            let parsedOptions = typeof options_json === 'string' ? JSON.parse(options_json) : options_json;
            if (!Array.isArray(parsedOptions) || parsedOptions.length < 2 || parsedOptions.length > 6) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Numărul de opțiuni de răspuns trebuie să fie între 2 și 6.' })
                };
            }

            const parsedCorrectIndex = parseInt(correct_index);
            if (isNaN(parsedCorrectIndex) || parsedCorrectIndex < 0 || parsedCorrectIndex >= parsedOptions.length) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Indexul răspunsului corect este în afara limitelor opțiunilor.' })
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
                    exam_type: normalizeExamType(exam_type),
                    difficulty,
                    type,
                    category: category || null,
                    subcategory: subcategory || null,
                    text,
                    image_url: image_url || null,
                    code: code || null,
                    hint: hint || explanation || null,
                    options_json: parsedOptions,
                    correct_index: parsedCorrectIndex
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

            const body = JSON.parse(event.body || '{}');

            // Whitelist allowed fields to prevent injection
            const allowedFields = ['exam_type', 'difficulty', 'type', 'category', 'subcategory', 'text', 'image_url', 'code', 'options_json', 'correct_index', 'hint'];
            const safeBody = {};
            for (const key of allowedFields) {
                if (body[key] !== undefined) {
                    safeBody[key] = body[key];
                }
            }
            if (safeBody.hint === undefined && body.explanation !== undefined) {
                safeBody.hint = body.explanation;
            }

            if (safeBody.options_json) {
                if (typeof safeBody.options_json === 'string') {
                    safeBody.options_json = JSON.parse(safeBody.options_json);
                }
                if (!Array.isArray(safeBody.options_json) || safeBody.options_json.length < 2 || safeBody.options_json.length > 6) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Numărul de opțiuni trebuie să fie între 2 și 6.' }) };
                }
            }
            if (safeBody.exam_type) {
                safeBody.exam_type = normalizeExamType(safeBody.exam_type);
            }
            if (safeBody.correct_index !== undefined) {
                safeBody.correct_index = parseInt(safeBody.correct_index);
            }

            if (Object.keys(safeBody).length === 0) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'No valid fields provided for update.' }) };
            }

            const response = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(safeBody)
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

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Question deleted.' }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    } catch (error) {
        console.error('Error in manage-questions:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};
