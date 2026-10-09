const utils = require('./_utils');

exports.handler = async function(event, context) {
    const headers = utils.getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'DELETE') {
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
