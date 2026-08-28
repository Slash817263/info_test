exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, X-Admin-Token, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    const adminSecret = process.env.ADMIN_SECRET;

    const clientAdminToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
    if (!clientAdminToken || clientAdminToken !== adminSecret) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Doar administratorul are acces.' }) };
    }

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
                    // Fetch lead to get phone number if available
                    let leadPhone = null;
                    const leadRes = await fetch(`${supabaseUrl}/rest/v1/results?id=eq.${lead_id}&select=student_username`, {
                        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                    });
                    if (leadRes.ok) {
                        const lData = await leadRes.json();
                        if (lData && lData.length > 0) leadPhone = lData[0].student_username;
                    }

                    // Create student with requested subscription duration
                    let calculatedExpiresAt = null;
                    const durationVal = body.duration || '30';
                    if (durationVal !== 'unlimited') {
                        const days = parseInt(durationVal) || 30;
                        calculatedExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
                    }

                    const studentPayload = {
                        username: cleanUsername,
                        password: password.trim(),
                        phone_number: leadPhone || null,
                        expires_at: calculatedExpiresAt
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
                        if (errTxt.includes('expires_at') || errTxt.includes('column')) {
                            delete studentPayload.expires_at;
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
