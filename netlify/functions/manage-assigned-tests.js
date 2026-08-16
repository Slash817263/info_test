exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, X-Admin-Token, Authorization',
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

    const shuffle = (array) => {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    };

    try {
        if (method === 'GET') {
            const params = event.queryStringParameters || {};
            const username = params.username;
            
            if (!username && !isAdmin) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Trebuie sa fii admin.' }) };
            }

            if (username && !isAdmin) {
                const authHeader = event.headers.authorization || event.headers.Authorization;
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Autentificare necesară.' }) };
                }
                const token = authHeader.substring(7);
                const jwt = require('jsonwebtoken');
                try {
                    const decoded = jwt.verify(token, process.env.SUPABASE_KEY);
                    if (decoded.username !== username) {
                        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
                    }
                } catch(e) {
                    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token invalid sau expirat' }) };
                }
            }
            
            let url = `${supabaseUrl}/rest/v1/assigned_tests?order=created_at.desc`;
            if (username && !isAdmin) {
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

            let progData = [];
            if (username) {
                try {
                    const progUrl = `${supabaseUrl}/rest/v1/results?student_username=eq.${encodeURIComponent(username)}&test_type=like.progress_*&select=test_type,answers_json`;
                    const progRes = await fetch(progUrl, {
                        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                    });
                    if (progRes.ok) {
                        progData = await progRes.json();
                    }
                } catch(e) {
                    console.error('Error fetching progress in manage-assigned-tests:', e);
                }
            }

            const enrichedData = data.map(at => {
                const prog = progData.find(p => p.test_type === `progress_${at.id}`);
                let answered = 0;
                if (prog && prog.answers_json && Array.isArray(prog.answers_json)) {
                    answered = prog.answers_json.filter(a => a !== null && a !== undefined).length;
                }
                return {
                    ...at,
                    answered_count: answered
                };
            });

            return { statusCode: 200, headers, body: JSON.stringify(enrichedData) };

        } else if (method === 'POST') {
            if (!isAdmin) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
            
            const body = JSON.parse(event.body || '{}');
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
                    headers: { 
                        'apikey': supabaseKey, 
                        'Authorization': `Bearer ${supabaseKey}`, 
                        'Content-Type': 'application/json', 
                        'Prefer': 'return=representation' 
                    },
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
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Toate câmpurile sunt obligatorii.' }) };
            }

            // 1. Fetch all questions for requested category
            const qResponse = await fetch(`${supabaseUrl}/rest/v1/questions?select=id,exam_type,category,subcategory`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (!qResponse.ok) throw new Error(await qResponse.text());
            let allQuestions = await qResponse.json();

            let categoryQuestions = allQuestions;
            if (exam_type !== 'Diverse') {
                categoryQuestions = allQuestions.filter(q => (q.exam_type || 'Diverse').includes(exam_type));
            }

            if (categoryQuestions.length === 0) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ error: `Nu există întrebări în baza de date pentru categoria "${exam_type}".` }) 
                };
            }

            if (categoryQuestions.length < target_length) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ error: `Categoria "${exam_type}" conține doar ${categoryQuestions.length} întrebări în total. Nu poți genera un test cu ${target_length} întrebări.` }) 
                };
            }

            // 2. Fetch student's past completed results to evaluate priorities
            const encodedUser = encodeURIComponent(student_username);
            const resUrl = `${supabaseUrl}/rest/v1/results?or=(student_username.eq.${encodedUser},student_name.eq.${encodedUser})&order=created_at.asc`;
            const resultsResponse = await fetch(resUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
            
            const lastQuestionStatus = {}; // question_id -> boolean (true if correct, false if wrong)
            if (resultsResponse.ok) {
                const pastResults = await resultsResponse.json();
                for (const res of pastResults) {
                    if (res.test_type && res.test_type.startsWith('progress_')) continue; // exclude partials
                    const details = res.details_json || [];
                    for (const d of details) {
                        if (d && d.id !== undefined) {
                            lastQuestionStatus[d.id] = !!d.isCorrect;
                        }
                    }
                }
            }

            // 3. Selection with Diverse priority hierarchy and subcategory balancing
            const subcatCounts = {};
            function pickDiverseAware(pool, needed) {
                if (!pool || pool.length === 0 || needed <= 0) return [];
                
                const bySub = {};
                for (const q of pool) {
                    const sub = q.subcategory || q.category || 'Altele';
                    if (!bySub[sub]) bySub[sub] = [];
                    bySub[sub].push(q);
                }
                
                for (const sub of Object.keys(bySub)) {
                    shuffle(bySub[sub]);
                }
                
                const picked = [];
                while (picked.length < needed) {
                    let minCount = Infinity;
                    let candidateSubcats = [];
                    
                    for (const sub of Object.keys(bySub)) {
                        if (bySub[sub].length === 0) continue;
                        const currentCount = subcatCounts[sub] || 0;
                        if (currentCount < minCount) {
                            minCount = currentCount;
                            candidateSubcats = [sub];
                        } else if (currentCount === minCount) {
                            candidateSubcats.push(sub);
                        }
                    }
                    
                    if (candidateSubcats.length === 0) break;
                    
                    const chosenSub = candidateSubcats[Math.floor(Math.random() * candidateSubcats.length)];
                    const q = bySub[chosenSub].pop();
                    
                    picked.push(q);
                    subcatCounts[chosenSub] = (subcatCounts[chosenSub] || 0) + 1;
                }
                return picked;
            }

            const selected = [];

            if (exam_type === 'Diverse') {
                // LOGICA SPECIALA DIVERSE:
                // 1. Diverse nefăcute
                // 2. Diverse greșite
                // 3. Alte categorii (Bac, Poli, Academie) nefăcute - STRICT RANDOM & echilibrate
                // 4. Alte categorii greșite
                // 5. Diverse corecte
                // 6. Alte categorii corecte
                const divPool = allQuestions.filter(q => (q.exam_type || '').includes('Diverse'));
                const otherPool = allQuestions.filter(q => !(q.exam_type || '').includes('Diverse'));

                const div_unseen = divPool.filter(q => lastQuestionStatus[q.id] === undefined);
                const div_wrong = divPool.filter(q => lastQuestionStatus[q.id] === false);
                const div_correct = divPool.filter(q => lastQuestionStatus[q.id] === true);

                const other_unseen = otherPool.filter(q => lastQuestionStatus[q.id] === undefined);
                const other_wrong = otherPool.filter(q => lastQuestionStatus[q.id] === false);
                const other_correct = otherPool.filter(q => lastQuestionStatus[q.id] === true);

                shuffle(div_unseen); shuffle(div_wrong); shuffle(div_correct);
                shuffle(other_unseen); shuffle(other_wrong); shuffle(other_correct);

                if (selected.length < target_length) {
                    selected.push(...pickDiverseAware(div_unseen, target_length - selected.length));
                }
                if (selected.length < target_length) {
                    selected.push(...pickDiverseAware(div_wrong, target_length - selected.length));
                }
                if (selected.length < target_length) {
                    selected.push(...pickDiverseAware(other_unseen, target_length - selected.length));
                }
                if (selected.length < target_length) {
                    selected.push(...pickDiverseAware(other_wrong, target_length - selected.length));
                }
                if (selected.length < target_length) {
                    selected.push(...pickDiverseAware(div_correct, target_length - selected.length));
                }
                if (selected.length < target_length) {
                    selected.push(...pickDiverseAware(other_correct, target_length - selected.length));
                }
            } else {
                const priority1_unseen = categoryQuestions.filter(q => lastQuestionStatus[q.id] === undefined);
                const priority2_wrong = categoryQuestions.filter(q => lastQuestionStatus[q.id] === false);
                const priority3_correct = categoryQuestions.filter(q => lastQuestionStatus[q.id] === true);

                shuffle(priority1_unseen);
                shuffle(priority2_wrong);
                shuffle(priority3_correct);

                if (selected.length < target_length) {
                    selected.push(...pickDiverseAware(priority1_unseen, target_length - selected.length));
                }
                if (selected.length < target_length) {
                    selected.push(...pickDiverseAware(priority2_wrong, target_length - selected.length));
                }
                if (selected.length < target_length) {
                    selected.push(...pickDiverseAware(priority3_correct, target_length - selected.length));
                }
            }

            shuffle(selected);
            const selectedIds = selected.map(q => q.id);

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

            // 4. Insert assigned test
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
            if (!isAdmin) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
            
            const body = JSON.parse(event.body || '{}');
            const { action, id, old_question_id, student_username, exam_type, current_questions_ids } = body;
            
            if (action === 'regenerate_draft' || action === 'regenerate') {
                let targetUsername = student_username;
                let targetExamType = exam_type;
                let currentIds = current_questions_ids || [];
                let testRow = null;

                if (action === 'regenerate') {
                    const tRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?id=eq.${id}`, {
                        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                    });
                    const testData = await tRes.json();
                    if (!testData || testData.length === 0) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Testul nu a fost găsit.' }) };
                    testRow = testData[0];
                    targetUsername = testRow.student_username;
                    targetExamType = testRow.exam_type;
                    currentIds = testRow.questions_ids || [];
                }

                // Fetch questions for category
                const qResponse = await fetch(`${supabaseUrl}/rest/v1/questions?select=id,exam_type`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                let allQuestions = await qResponse.json();
                let categoryQuestions = allQuestions;
                if (targetExamType !== 'Diverse') {
                    categoryQuestions = allQuestions.filter(q => (q.exam_type || 'Diverse').includes(targetExamType));
                }

                // Fetch history
                const encodedUser = encodeURIComponent(targetUsername);
                const resUrl = `${supabaseUrl}/rest/v1/results?or=(student_username.eq.${encodedUser},student_name.eq.${encodedUser})&order=created_at.asc`;
                const resultsResponse = await fetch(resUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
                const lastStatus = {};
                if (resultsResponse.ok) {
                    const pastResults = await resultsResponse.json();
                    for (const res of pastResults) {
                        if (res.test_type && res.test_type.startsWith('progress_')) continue;
                        for (const d of (res.details_json || [])) {
                            if (d && d.id !== undefined) lastStatus[d.id] = !!d.isCorrect;
                        }
                    }
                }

                const currentSet = new Set(currentIds);
                const candidates = categoryQuestions.filter(q => !currentSet.has(q.id));

                if (candidates.length === 0) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nu mai există alte întrebări disponibile în această categorie pentru înlocuire.' }) };
                }

                // Priority: unseen -> wrong -> correct
                const p1 = candidates.filter(q => lastStatus[q.id] === undefined);
                const p2 = candidates.filter(q => lastStatus[q.id] === false);
                const p3 = candidates.filter(q => lastStatus[q.id] === true);

                let pool = p1.length > 0 ? p1 : (p2.length > 0 ? p2 : (p3.length > 0 ? p3 : candidates));
                const newQId = pool[Math.floor(Math.random() * pool.length)].id;

                if (action === 'regenerate_draft') {
                    return { statusCode: 200, headers, body: JSON.stringify({ new_question_id: newQId }) };
                } else {
                    const newIds = currentIds.map(qid => qid === old_question_id ? newQId : qid);
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
            }
            
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Acțiune invalidă.' }) };
            
        } else if (method === 'DELETE') {
            if (!isAdmin) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
            const params = event.queryStringParameters || {};
            if (!params.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id' }) };
            
            // Delete the assigned test
            const delRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?id=eq.${params.id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            
            if (!delRes.ok) throw new Error(await delRes.text());

            // Also clean up any uncompleted progress row for this test
            await fetch(`${supabaseUrl}/rest/v1/results?test_type=eq.progress_${params.id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            }).catch(e => console.error('Warning: Failed to clean up progress row for assigned test:', e));

            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: 'Method not allowed' };
    } catch (e) {
        console.error('Error manage-assigned-tests:', e);
        return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
};
