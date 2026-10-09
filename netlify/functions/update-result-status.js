const utils = require('./_utils');

exports.handler = async function(event, context) {
    const headers = utils.getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST' && event.httpMethod !== 'PATCH') {
        return utils.createErrorResponse(405, 'Method Not Allowed', headers);
    }

    if (!utils.verifyAdminToken(event)) {
        return utils.createErrorResponse(401, 'Unauthorized: Invalid Admin Token', headers);
    }

    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL', process.env.SUPABASE_URL);
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY', process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

    if (!supabaseUrl || !supabaseKey) {
        return utils.createErrorResponse(500, 'Supabase environment variables are missing.', headers);
    }

    try {
        let body = {};
        if (event.body) {
            try {
                body = JSON.parse(event.body);
            } catch (e) {
                return utils.createErrorResponse(400, 'Invalid JSON body.', headers);
            }
        }

        const id = body.id || (event.queryStringParameters && event.queryStringParameters.id);
        if (!id) {
            return utils.createErrorResponse(400, 'Missing result id.', headers);
        }

        const isDiscussed = body.discussed === true || body.status === 'discussed' || body.status === 'discutat';
        const newEmailVal = isDiscussed ? 'discussed' : null;

        const patchRes = await fetch(`${supabaseUrl}/rest/v1/results?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                student_email: newEmailVal
            })
        });

        if (!patchRes.ok) {
            const errText = await patchRes.text().catch(() => '');
            return utils.createErrorResponse(patchRes.status, `Failed to update result status: ${errText}`, headers);
        }

        const updatedData = await patchRes.json().catch(() => []);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                id: Number(id),
                discussed: isDiscussed,
                result: updatedData[0] || null
            })
        };
    } catch (err) {
        console.error('update-result-status error:', err);
        return utils.createErrorResponse(500, err.message || 'Internal server error', headers);
    }
};
