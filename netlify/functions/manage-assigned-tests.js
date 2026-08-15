exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': 'https://acadeinformatica.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, X-Admin-Token',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase env missing.' }) };
    }

    const method = event.httpMethod;
    const adminToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
    const validAdminTokens = [process.env.ADMIN_SECRET].filter(Boolean);
    const isAdmin = adminToken && validAdminTokens.includes(adminToken);

    try {
        if (method === 'GET') {
            const params = event.queryStringParameters || {};
            const username = params.username;
            
            if (!username && !isAdmin) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Trebuie sa fii admin.' }) };
            }
            
            let url = `${supabaseUrl}/rest/v1/assigned_tests?order=created_at.desc`;
            if (username && !isAdmin) {
                // Elevul cere testele lui (doar cele pending)
                url += `&student_username=eq.${encodeURIComponent(username)}&status=eq.pending`;
            } else if (username && isAdmin) {
                url += `&student_username=eq.${encodeURIComponent(username)}`;
            }

            const response = await fetch(url, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();
            return { statusCode: 200, headers, body: JSON.stringify(data) };

        } else if (method === 'POST') {
            if (!isAdmin) return { statusCode: 401, headers, body: JSON.stringify({error: 'Unauthorized'}) };
            
            const body = JSON.parse(event.body);
            const { student_username, exam_type, target_length, deadline } = body;

            const triggerWebhook = async (username, type, len, dline) => {
                if (process.env.WHATSAPP_WEBHOOK_URL) {
                    const stdRes = await fetch(`${supabaseUrl}/rest/v1/students?username=eq.${encodeURIComponent(username)}&select=phone_number`, {
                        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                    });
                    if (stdRes.ok) {
                        const stdData = await stdRes.json();
                        if (stdData.length > 0 && stdData[0].phone_number) {
                            try {
                                await fetch(process.env.WHATSAPP_WEBHOOK_URL, {
                                    method: 'POST',
                                    headers: { 
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${process.env.WHATSAPP_WEBHOOK_SECRET}`
                                    },
                                    body: JSON.stringify({
                                        event: 'test_assigned',
                                        phone_number: stdData[0].phone_number,
                                        student_username: username,
                                        exam_type: type,
                                        target_length: len,
                                        deadline: dline
                                    })
                                });
                            } catch (err) { console.error('Webhook fetch error:', err); }
                        }
                    }
                }
            };

            if (body.save_draft) {
                const insertRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests`, {
                    method: 'POST',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                    body: JSON.stringify({
                        student_username: body.student_username,
                        exam_type: body.exam_type,
                        target_length: body.target_length,
                        deadline: body.deadline,
                        questions_ids: body.questions_ids,
                        status: 'pending'
                    })
                });
                if (!insertRes.ok) throw new Error(await insertRes.text());
                const inserted = await insertRes.json();
                
                await triggerWebhook(body.student_username, body.exam_type, body.target_length, body.deadline);

                return { statusCode: 201, headers, body: JSON.stringify(inserted[0]) };
            }

            if (!student_username || !exam_type || !target_length || !deadline) {
                return { statusCode: 400, headers, body: JSON.stringify({error: 'Missing fields'}) };
            }

            // 1. Fetch student's past results
            const resUrl = `${supabaseUrl}/rest/v1/results?student_username=eq.${encodeURIComponent(student_username)}`;
            const resultsResponse = await fetch(resUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
            let pastResults = [];
            if (resultsResponse.ok) {
                pastResults = await resultsResponse.json();
            }

            const seenIds = new Set();
            for (const res of pastResults) {
                const details = res.details_json || [];
                for (const d of details) seenIds.add(d.id);
            }

            // 2. Fetch all questions
            const qResponse = await fetch(`${supabaseUrl}/rest/v1/questions?select=id,exam_type`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (!qResponse.ok) throw new Error(await qResponse.text());
            let allQuestions = await qResponse.json();

            // 3. Filter by exam_type (if not Diverse)
            if (exam_type !== 'Diverse') {
                allQuestions = allQuestions.filter(q => (q.exam_type || 'Diverse').includes(exam_type));
            }

            // 4. Filter unseen
            let unseenQs = allQuestions.filter(q => !seenIds.has(q.id));

            if (unseenQs.length < target_length) {
                return { statusCode: 400, headers, body: JSON.stringify({error: `Doar ${unseenQs.length} intrebari nevazute disponibile din categoria ceruta.`}) };
            }

            // Shuffle unseenQs
            for (let i = unseenQs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [unseenQs[i], unseenQs[j]] = [unseenQs[j], unseenQs[i]];
            }

            const selectedIds = unseenQs.slice(0, target_length).map(q => q.id);

            if (body.draft) {
                return { statusCode: 200, headers, body: JSON.stringify({
                    draft: true,
                    student_username,
                    exam_type,
                    target_length,
                    deadline,
                    questions_ids: selectedIds,
                    status: 'pending'
                }) };
            }

            // 5. Insert assigned test
            const insertRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    student_username,
                    exam_type,
                    target_length,
                    deadline,
                    questions_ids: selectedIds,
                    status: 'pending'
                })
            });

            if (!insertRes.ok) throw new Error(await insertRes.text());
            const inserted = await insertRes.json();

            await triggerWebhook(student_username, exam_type, target_length, deadline);

            return { statusCode: 201, headers, body: JSON.stringify(inserted[0]) };
            
        } else if (method === 'PUT') {
            if (!isAdmin) return { statusCode: 401, headers, body: JSON.stringify({error: 'Unauthorized'}) };
            
            const body = JSON.parse(event.body);
            const { action, id, old_question_id, student_username, exam_type, current_questions_ids } = body;
            
            if (action === 'regenerate_draft') {
                // Fetch all questions for category
                const qResponse = await fetch(`${supabaseUrl}/rest/v1/questions?select=id,exam_type`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                let allQuestions = await qResponse.json();
                if (exam_type !== 'Diverse') {
                    allQuestions = allQuestions.filter(q => (q.exam_type || 'Diverse').includes(exam_type));
                }
                
                // Fetch student seen ids
                const resUrl = `${supabaseUrl}/rest/v1/results?student_username=eq.${encodeURIComponent(student_username)}`;
                const resultsResponse = await fetch(resUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
                const seenIds = new Set();
                if (resultsResponse.ok) {
                    const pastResults = await resultsResponse.json();
                    for (const res of pastResults) {
                        for (const d of (res.details_json || [])) seenIds.add(d.id);
                    }
                }
                
                const currentIdsSet = new Set(current_questions_ids);
                let availablePool = allQuestions.filter(q => !seenIds.has(q.id) && !currentIdsSet.has(q.id));
                
                if (availablePool.length === 0) {
                     return { statusCode: 400, headers, body: JSON.stringify({error: 'Nu mai exista intrebari nevazute in aceasta categorie.'}) };
                }
                
                const newQId = availablePool[Math.floor(Math.random() * availablePool.length)].id;
                
                return { statusCode: 200, headers, body: JSON.stringify({ new_question_id: newQId }) };
                
            } else if (action === 'regenerate') {
                // Fetch the assigned test
                const tRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?id=eq.${id}`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                const testData = await tRes.json();
                if (!testData || testData.length === 0) return { statusCode: 404, headers, body: JSON.stringify({error: 'Test not found'}) };
                const t = testData[0];
                
                // Fetch all questions for category
                const qResponse = await fetch(`${supabaseUrl}/rest/v1/questions?select=id,exam_type`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                let allQuestions = await qResponse.json();
                if (t.exam_type !== 'Diverse') {
                    allQuestions = allQuestions.filter(q => (q.exam_type || 'Diverse').includes(t.exam_type));
                }
                
                // Fetch student seen ids
                const resUrl = `${supabaseUrl}/rest/v1/results?student_username=eq.${encodeURIComponent(t.student_username)}`;
                const resultsResponse = await fetch(resUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
                const seenIds = new Set();
                if (resultsResponse.ok) {
                    const pastResults = await resultsResponse.json();
                    for (const res of pastResults) {
                        for (const d of (res.details_json || [])) seenIds.add(d.id);
                    }
                }
                
                // We also consider the already generated questions in this test as "seen" so we don't pick them again
                const currentIdsSet = new Set(t.questions_ids);
                
                let availablePool = allQuestions.filter(q => !seenIds.has(q.id) && !currentIdsSet.has(q.id));
                if (availablePool.length === 0) {
                     return { statusCode: 400, headers, body: JSON.stringify({error: 'Nu mai exista intrebari nevazute in aceasta categorie.'}) };
                }
                
                const newQId = availablePool[Math.floor(Math.random() * availablePool.length)].id;
                
                const newIds = t.questions_ids.map(qid => qid === old_question_id ? newQId : qid);
                
                const updateRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?id=eq.${id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({ questions_ids: newIds })
                });
                
                if (!updateRes.ok) throw new Error(await updateRes.text());
                const updated = await updateRes.json();
                
                return { statusCode: 200, headers, body: JSON.stringify(updated[0]) };
            }
            
            return { statusCode: 400, headers, body: JSON.stringify({error: 'Invalid action'}) };
            
        } else if (method === 'DELETE') {
            if (!isAdmin) return { statusCode: 401, headers, body: JSON.stringify({error: 'Unauthorized'}) };
            const params = event.queryStringParameters || {};
            if (!params.id) return { statusCode: 400, headers, body: JSON.stringify({error: 'Missing id'}) };
            
            const delRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?id=eq.${params.id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            
            if (!delRes.ok) throw new Error(await delRes.text());
            return { statusCode: 200, headers, body: JSON.stringify({success: true}) };
        }

        return { statusCode: 405, headers, body: 'Method not allowed' };
    } catch (e) {
        console.error('Error manage-assigned-tests:', e);
        return { statusCode: 500, headers, body: JSON.stringify({error: e.message}) };
    }
};
