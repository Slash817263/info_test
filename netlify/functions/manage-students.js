const utils = require('./_utils');

exports.handler = async function(event, context) {
    const headers = utils.getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!utils.verifyAdminToken(event)) {
        return utils.createErrorResponse(401, 'Unauthorized', headers);
    }

    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL', process.env.SUPABASE_URL);
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY', process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

    if (!supabaseUrl || !supabaseKey) {
        return utils.createErrorResponse(500, 'Missing Supabase vars', headers);
    }

    const STUDENTS_ENDPOINT = `${supabaseUrl}/rest/v1/students`;

    async function cascadeDeleteStudent(studentId) {
        let username = '';
        let phone = '';
        try {
            const studentRes = await fetch(`${STUDENTS_ENDPOINT}?id=eq.${studentId}&select=username,phone_number`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (studentRes.ok) {
                const list = await studentRes.json();
                if (list && list.length > 0) {
                    username = list[0].username;
                    phone = list[0].phone_number;
                }
            }
        } catch (e) {
            console.error('Error fetching student before cascade delete:', e);
        }

        if (username) {
            const encodedUser = encodeURIComponent(username);
            // 1. Delete all results for this student (GDPR Right to be Forgotten)
            await fetch(`${supabaseUrl}/rest/v1/results?student_username=eq.${encodedUser}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            }).catch(e => console.error('Error deleting results for student:', e));

            if (phone) {
                await fetch(`${supabaseUrl}/rest/v1/results?student_username=eq.${encodeURIComponent(phone)}`, {
                    method: 'DELETE',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                }).catch(() => {});
            }

            // 2. Delete all assigned tests for this student
            await fetch(`${supabaseUrl}/rest/v1/assigned_tests?student_username=eq.${encodedUser}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            }).catch(e => console.error('Error deleting assigned tests for student:', e));
        }

        // 3. Delete student account from students table
        const res = await fetch(`${STUDENTS_ENDPOINT}?id=eq.${studentId}`, {
            method: 'DELETE',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        if (!res.ok) throw new Error('Eroare la ștergerea elevului din baza de date');
        return true;
    }

    try {
        if (event.httpMethod === 'GET') {
            const res = await fetch(`${STUDENTS_ENDPOINT}?select=id,username,password,created_at,phone_number,expires_at,gdpr_consent&order=created_at.desc&limit=2000`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (!res.ok) {
                // Fallback in case a column was not yet added in Supabase
                const fallbackRes = await fetch(`${STUDENTS_ENDPOINT}?select=id,username,password,created_at,phone_number,expires_at&order=created_at.desc&limit=2000`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (!fallbackRes.ok) {
                    const thirdRes = await fetch(`${STUDENTS_ENDPOINT}?select=id,username,password,created_at,phone_number&order=created_at.desc&limit=2000`, {
                        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                    });
                    if (!thirdRes.ok) throw new Error('Eroare la preluare elevi');
                    const data = await thirdRes.json();
                    return { statusCode: 200, headers, body: JSON.stringify(data) };
                }
                const data = await fallbackRes.json();
                return { statusCode: 200, headers, body: JSON.stringify(data) };
            }
            const data = await res.json();
            return { statusCode: 200, headers, body: JSON.stringify(data) };
        } 
        
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');

            if (body.action === 'delete' && body.id) {
                await cascadeDeleteStudent(body.id);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Elevul și toate datele sale au fost șterse complet.' }) };
            }

            if (!body.username || !body.password) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Username și parola sunt obligatorii' }) };
            }

            let cleanPhone = body.phone_number ? body.phone_number.trim().replace(/\s+/g, '').replace(/[-().]/g, '') : null;
            if (cleanPhone) {
                if (cleanPhone.startsWith('+40')) cleanPhone = '0' + cleanPhone.substring(3);
                else if (cleanPhone.startsWith('40') && cleanPhone.length === 11) cleanPhone = '0' + cleanPhone.substring(2);
                else if (cleanPhone.startsWith('7') && cleanPhone.length === 9) cleanPhone = '0' + cleanPhone;
            }

            const defaultExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            const hashedPassword = utils.hashPassword(body.password.trim());
            const studentInsert = { 
                username: body.username.trim().toLowerCase(), 
                password: hashedPassword,
                phone_number: cleanPhone,
                expires_at: body.expires_at !== undefined ? body.expires_at : defaultExpiresAt,
                gdpr_consent: body.gdpr_consent || {
                    accepted: true,
                    consented_at: new Date().toISOString(),
                    policy_version: '1.0',
                    source: 'admin_enrollment'
                }
            };

            let res = await fetch(STUDENTS_ENDPOINT, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(studentInsert)
            });

            if (!res.ok) {
                const err = await res.text();
                // If column gdpr_consent or expires_at does not exist in schema, retry without it
                if (err.includes('gdpr_consent') || err.includes('expires_at') || err.includes('column') || err.includes('not found')) {
                    if (err.includes('gdpr_consent')) delete studentInsert.gdpr_consent;
                    if (err.includes('expires_at')) delete studentInsert.expires_at;
                    res = await fetch(STUDENTS_ENDPOINT, {
                        method: 'POST',
                        headers: {
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify(studentInsert)
                    });
                }
                if (!res.ok) {
                    const finalErr = await res.text();
                    if (finalErr.includes('duplicate key value violates unique constraint')) {
                        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Username-ul există deja!' }) };
                    }
                    throw new Error('Eroare la crearea elevului: ' + finalErr);
                }
            }
            if (!res.ok) {
                const text = await res.text().catch(()=>'');
                throw new Error(`HTTP ${res.status} pe res: ${text}`);
            }
            const data = await res.json();
            const createdStudent = data[0];

            // Auto-link any matching lead diagnostic test
            try {
                const cleanUser = body.username.trim().toLowerCase();
                const cleanPhone = (createdStudent.phone_number || '').trim();
                let leadQuery = `${supabaseUrl}/rest/v1/results?test_type=eq.lead_diagnostic`;
                if (cleanPhone) {
                    leadQuery += `&or=(student_username.eq.${encodeURIComponent(cleanPhone)},student_username.eq.${encodeURIComponent(cleanUser)})`;
                } else {
                    leadQuery += `&student_username=eq.${encodeURIComponent(cleanUser)}`;
                }

                const leadRes = await fetch(leadQuery, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (leadRes.ok) {
                    const matchedLeads = await leadRes.json();
                    if (matchedLeads && matchedLeads.length > 0) {
                        for (const l of matchedLeads) {
                            await fetch(`${supabaseUrl}/rest/v1/results?id=eq.${l.id}`, {
                                method: 'PATCH',
                                headers: {
                                    'apikey': supabaseKey,
                                    'Authorization': `Bearer ${supabaseKey}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    student_username: cleanUser,
                                    test_type: 'initial'
                                })
                            });
                        }
                    }
                }
            } catch (e) {
                console.error('Auto-link lead error:', e);
            }

            return { statusCode: 200, headers, body: JSON.stringify(createdStudent) };
        }

        if (event.httpMethod === 'DELETE') {
            const params = event.queryStringParameters || {};
            const id = params.id;
            if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID obligatoriu' }) };

            await cascadeDeleteStudent(id);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Elevul și toate datele asociate au fost șterse complet.' }) };
        }

        if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body || '{}');
            if (body.action === 'reset_password') {
                if (!body.id || !body.new_password) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID și noua parolă sunt obligatorii' }) };
                }

                const hashedNewPassword = utils.hashPassword(body.new_password.trim());
                const res = await fetch(`${STUDENTS_ENDPOINT}?id=eq.${body.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({ password: hashedNewPassword })
                });
                if (!res.ok) throw new Error('Eroare la resetarea parolei');
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }

            if (body.action === 'update_expiration') {
                if (!body.id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID elev este obligatoriu' }) };
                }

                const res = await fetch(`${STUDENTS_ENDPOINT}?id=eq.${body.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({ expires_at: body.expires_at || null })
                });
                if (!res.ok) {
                    const err = await res.text();
                    throw new Error('Eroare la actualizarea valabilității: ' + err);
                }
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, expires_at: body.expires_at }) };
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    } catch (e) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || 'Eroare internă' }) };
    }
};
