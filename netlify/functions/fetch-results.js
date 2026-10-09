const utils = require('./_utils');

exports.handler = async function(event, context) {
    const headers = utils.getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return utils.createErrorResponse(405, 'Method Not Allowed', headers);
    }

    const isAdmin = utils.verifyAdminToken(event);
    const params = event.queryStringParameters || {};
    const requestedUsername = params.username ? params.username.trim() : '';
    let authenticatedUsername = null;

    if (!isAdmin) {
        const decoded = utils.parseJwt(event);
        if (!decoded || !decoded.username) {
            return utils.createErrorResponse(401, 'Autentificare necesară.', headers);
        }
        authenticatedUsername = decoded.username.trim();

        if (requestedUsername && requestedUsername.toLowerCase() !== authenticatedUsername.toLowerCase()) {
            return utils.createErrorResponse(403, 'Forbidden: Nu ai permisiunea de a accesa rezultatele altui elev.', headers);
        }
    }

    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL', process.env.SUPABASE_URL);
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY', process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

    if (!supabaseUrl || !supabaseKey) {
        return utils.createErrorResponse(500, 'Supabase environment variables are missing.', headers);
    }

    try {
        // Enforce student ownership: an authenticated non-admin can only ever view their own data
        const targetUsername = isAdmin ? requestedUsername : authenticatedUsername;

        if (params.id) {
            let singleUrl = `${supabaseUrl}/rest/v1/results?id=eq.${encodeURIComponent(params.id)}&select=*&limit=1`;
            if (!isAdmin && targetUsername) {
                const safeUser = targetUsername.toLowerCase().replace(/[%_]/g, '\\$&');
                singleUrl += `&or=(student_username.ilike.${encodeURIComponent(safeUser)},student_name.ilike.${encodeURIComponent(safeUser)})`;
            }

            const response = await fetch(singleUrl, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Supabase query failed: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            if (!data || data.length === 0) {
                return utils.createErrorResponse(404, 'Rezultatul nu a fost găsit.', headers);
            }
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(data[0])
            };
        }

        // List query: only admin can query without targetUsername (all results)
        if (!isAdmin && !targetUsername) {
            return utils.createErrorResponse(401, 'Unauthorized: Trebuie să fii admin.', headers);
        }

        const isSummary = params.summary === 'true' || (!targetUsername && params.full !== 'true');
        const selectCols = isSummary
            ? 'id,student_name,student_username,score,total_points,time_taken_ms,blur_count,test_type,created_at,student_email'
            : '*';

        let url = `${supabaseUrl}/rest/v1/results?test_type=not.in.(category_coverage,lead_diagnostic)&test_type=not.like.progress_*&select=${encodeURIComponent(selectCols)}&order=created_at.desc&limit=2000`;
        if (targetUsername) {
            const safeUser = targetUsername.toLowerCase().replace(/[%_]/g, '\\$&');
            url += `&or=(student_username.ilike.${encodeURIComponent(safeUser)},student_name.ilike.${encodeURIComponent(safeUser)})`;
        }

        const response = await fetch(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Supabase query failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const filteredData = data.filter(d => !d.test_type || (!d.test_type.startsWith('progress_') && d.test_type !== 'category_coverage' && d.test_type !== 'lead_diagnostic'));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(filteredData)
        };
    } catch (error) {
        console.error('Error fetching results:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
