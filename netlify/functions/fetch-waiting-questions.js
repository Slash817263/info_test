const utils = require('./_utils');

exports.handler = async function(event, context) {
    const headers = utils.getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!utils.verifyAdminToken(event)) {
        return utils.createErrorResponse(401, 'Unauthorized: Invalid Admin Token', headers);
    }

    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL', process.env.SUPABASE_URL);
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY', process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

    if (!supabaseUrl || !supabaseKey) {
        return utils.createErrorResponse(500, 'Supabase credentials missing.', headers);
    }

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/waiting_questions?select=*&order=id.asc`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                const mapped = data.map(q => ({ ...q, exam_type: q.exam_type || 'Initial' }));
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(mapped)
                };
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify([])
        };

    } catch (error) {
        console.error('Error fetching waiting questions:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
