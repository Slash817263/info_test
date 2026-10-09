const utils = require('./_utils');

exports.handler = async function(event, context) {
    const headers = utils.getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!utils.verifyAdminToken(event)) {
        return utils.createErrorResponse(401, 'Unauthorized: Doar administratorul are acces.', headers);
    }

    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL', process.env.SUPABASE_URL);
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY', process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase credentials missing.' }) };
    }

    const method = event.httpMethod;

    try {
        if (method === 'GET') {
            const params = event.queryStringParameters || {};
            const action = params.action || 'list_leads';

            if (action === 'list_leads') {
                const res = await fetch(`${supabaseUrl}/rest/v1/results?test_type=eq.lead_diagnostic&order=created_at.desc`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (!res.ok) throw new Error(await res.text());
                const leads = await res.json();
                return { statusCode: 200, headers, body: JSON.stringify(leads) };
            }

            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid GET action.' }) };

        } else if (method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const action = body.action;

            if (action === 'convert_lead') {
                const { lead_id, username, password, full_name } = body;
                if (!lead_id || !username || !password) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'lead_id, username și password sunt obligatorii.' }) };
                }

                // 1. Check if student already exists or create student
                const cleanUsername = username.trim().toLowerCase();
                const studentCheck = await fetch(`${supabaseUrl}/rest/v1/students?username=eq.${encodeURIComponent(cleanUsername)}`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (!studentCheck.ok) {
                    const text = await studentCheck.text().catch(()=>'');
                    throw new Error(`HTTP ${studentCheck.status} pe studentCheck: ${text}`);
                }
                const existingStudents = await studentCheck.json();

                if (!existingStudents || existingStudents.length === 0) {
                    // Fetch lead to get phone number and creation date if available
                    let leadPhone = null;
                    let leadCreatedAt = null;
                    const leadRes = await fetch(`${supabaseUrl}/rest/v1/results?id=eq.${lead_id}&select=student_username,created_at`, {
                        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                    });
                    if (leadRes.ok) {
                        const lData = await leadRes.json();
                        if (lData && lData.length > 0) {
                            leadPhone = lData[0].student_username;
                            leadCreatedAt = lData[0].created_at;
                        }
                    }

                    // Create student with requested subscription duration and GDPR consent audit
                    let calculatedExpiresAt = null;
                    const durationVal = body.duration || '30';
                    if (durationVal !== 'unlimited') {
                        const days = parseInt(durationVal) || 30;
                        calculatedExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
                    }

                    const studentPayload = {
                        username: cleanUsername,
                        password: utils.hashPassword(password.trim()),
                        phone_number: leadPhone || null,
                        expires_at: calculatedExpiresAt,
                        gdpr_consent: {
                            accepted: true,
                            consented_at: leadCreatedAt || new Date().toISOString(),
                            policy_version: '1.0',
                            source: 'lead_conversion',
                            lead_id: Number(lead_id)
                        }
                    };

                    let createStudentRes = await fetch(`${supabaseUrl}/rest/v1/students`, {
                        method: 'POST',
                        headers: {
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify(studentPayload)
                    });

                    if (!createStudentRes.ok) {
                        const errTxt = await createStudentRes.text();
                        if (errTxt.includes('gdpr_consent') || errTxt.includes('expires_at') || errTxt.includes('column')) {
                            if (errTxt.includes('gdpr_consent')) delete studentPayload.gdpr_consent;
                            if (errTxt.includes('expires_at')) delete studentPayload.expires_at;
                            createStudentRes = await fetch(`${supabaseUrl}/rest/v1/students`, {
                                method: 'POST',
                                headers: {
                                    'apikey': supabaseKey,
                                    'Authorization': `Bearer ${supabaseKey}`,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'return=representation'
                                },
                                body: JSON.stringify(studentPayload)
                            });
                        }
                        if (!createStudentRes.ok) {
                            const finalErr = await createStudentRes.text();
                            throw new Error(`Eroare la crearea contului de elev: ${finalErr}`);
                        }
                    }
                }

                // 2. Convert lead diagnostic test into official initial test
                const patchRes = await fetch(`${supabaseUrl}/rest/v1/results?id=eq.${lead_id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        student_username: cleanUsername,
                        student_name: (full_name || username).trim(),
                        test_type: 'initial'
                    })
                });

                if (!patchRes.ok) {
                    const errTxt = await patchRes.text();
                    throw new Error(`Eroare la asocierea testului inițial: ${errTxt}`);
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        message: `Contul elevului @${cleanUsername} a fost creat și testul inițial a fost asociat cu succes!`
                    })
                };

            } else if (action === 'delete_lead') {
                const lead_id = body.lead_id;
                if (!lead_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'lead_id is required' }) };

                const delRes = await fetch(`${supabaseUrl}/rest/v1/results?id=eq.${lead_id}`, {
                    method: 'DELETE',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (!delRes.ok) throw new Error(await delRes.text());

                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }

            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid POST action.' }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    } catch (err) {
        console.error('manage-leads error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
