exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, X-Admin-Token',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const validTokens = [process.env.ADMIN_SECRET].filter(Boolean);
    const clientToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
    
    if (!clientToken || !validTokens.includes(clientToken)) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing Supabase vars' }) };
    }

    const STUDENTS_ENDPOINT = `${supabaseUrl}/rest/v1/students`;

    try {
        if (event.httpMethod === 'GET') {
            const res = await fetch(`${STUDENTS_ENDPOINT}?select=id,username,password,created_at,phone_number,expires_at&order=created_at.desc&limit=2000`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (!res.ok) {
                // Fallback in case expires_at column was not yet added in Supabase
                const fallbackRes = await fetch(`${STUDENTS_ENDPOINT}?select=id,username,password,created_at,phone_number&order=created_at.desc&limit=2000`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (!fallbackRes.ok) throw new Error('Eroare la preluare elevi');
                const data = await fallbackRes.json();
                return { statusCode: 200, headers, body: JSON.stringify(data) };
            }
            if (!res.ok) {
                const text = await res.text().catch(()=>'');
                throw new Error(`HTTP ${res.status} pe res: ${text}`);
            }
            const data = await res.json();
            return { statusCode: 200, headers, body: JSON.stringify(data) };
        } 
        
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');

            if (body.action === 'delete' && body.id) {
                const res = await fetch(`${STUDENTS_ENDPOINT}?id=eq.${body.id}`, {
                    method: 'DELETE',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (!res.ok) throw new Error('Eroare la ștergerea elevului');
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
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
            const studentInsert = { 
                username: body.username.trim().toLowerCase(), 
                password: body.password.trim(),
                phone_number: cleanPhone,
                expires_at: body.expires_at !== undefined ? body.expires_at : defaultExpiresAt
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
                // If column expires_at does not exist in schema, retry without it
                if (err.includes('expires_at') || err.includes('column') || err.includes('not found')) {
                    delete studentInsert.expires_at;
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

            const res = await fetch(`${STUDENTS_ENDPOINT}?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (!res.ok) throw new Error('Eroare la ștergerea elevului');
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body || '{}');
            if (body.action === 'reset_password') {
                if (!body.id || !body.new_password) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID și noua parolă sunt obligatorii' }) };
                }

                const res = await fetch(`${STUDENTS_ENDPOINT}?id=eq.${body.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({ password: body.new_password })
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
