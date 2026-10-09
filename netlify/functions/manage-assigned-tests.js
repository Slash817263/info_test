const utils = require('./_utils');

exports.handler = async function(event, context) {
    const headers = utils.getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL', process.env.SUPABASE_URL);
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY', process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

    if (!supabaseUrl || !supabaseKey) {
        return utils.createErrorResponse(500, 'Supabase env missing.', headers);
    }

    const method = event.httpMethod;
    const isAdmin = utils.verifyAdminToken(event);

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
                const decoded = utils.parseJwt(event);
                if (!decoded) {
                    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Autentificare necesară.' }) };
                }
                if ((decoded.username || '').toLowerCase() !== (username || '').toLowerCase()) {
                    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
                }
            }
            
            let url = `${supabaseUrl}/rest/v1/assigned_tests?order=created_at.desc`;
            if (username && !isAdmin) {
                url += `&student_username=ilike.${encodeURIComponent(username)}&status=eq.pending`;
            } else if (username && isAdmin) {
                url += `&student_username=ilike.${encodeURIComponent(username)}`;
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
            try {
                let progUrl = `${supabaseUrl}/rest/v1/results?test_type=like.progress_*&select=test_type,answers_json,score,time_taken_ms,created_at`;
                if (username) {
                    progUrl = `${supabaseUrl}/rest/v1/results?student_username=ilike.${encodeURIComponent(username)}&test_type=like.progress_*&select=test_type,answers_json,score,time_taken_ms,created_at`;
                }
                const progRes = await fetch(progUrl, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (progRes.ok) {
                    progData = await progRes.json();
                }
            } catch(e) {
                console.error('Error fetching progress in manage-assigned-tests:', e);
            }

            const enrichedData = data.map(at => {
                const prog = progData.find(p => p.test_type === `progress_${at.id}`);
                let answered = 0;
                if (prog && prog.answers_json && Array.isArray(prog.answers_json)) {
                    answered = prog.answers_json.filter(a => a !== null && a !== undefined).length;
                }
                return {
                    ...at,
                    answered_count: answered,
                    current_answers: (prog && prog.answers_json) ? prog.answers_json : null,
                    progress_last_index: (prog && prog.score !== undefined) ? prog.score : null,
                    progress_time_ms: prog ? prog.time_taken_ms : null,
                    progress_updated_at: prog ? prog.created_at : null
                };
            });

            return { statusCode: 200, headers, body: JSON.stringify(enrichedData) };

        } else if (method === 'POST') {
            if (!isAdmin) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
            
            const body = JSON.parse(event.body || '{}');
            const { action, student_username, exam_type, target_length, deadline } = body;

            if (action === 'update_deadline' || body.action === 'update_deadline') {
                const testId = body.id || body.test_id;
                const deadlineIso = body.deadline;
                if (!testId || !deadlineIso) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID-ul și noul termen (deadline) sunt obligatorii.' }) };
                }
                const updateRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?id=eq.${testId}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({ deadline: deadlineIso })
                });
                if (!updateRes.ok) throw new Error(await updateRes.text());
                const updated = await updateRes.json();
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, test: updated[0] }) };
            }

            if (action === 'generate_recovery_test' || body.action === 'generate_recovery_test') {
                const targetStudent = (student_username || body.student_username || '').trim();
                if (!targetStudent) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Numele elevului este obligatoriu.' }) };
                }

                const totalTarget = Math.max(5, Math.min(50, parseInt(target_length || body.target_length || 15, 10) || 15));
                const examType = (exam_type || body.exam_type || 'Diverse').trim();
                
                // Calculate default deadline: 48h from now if not provided
                let finalDeadline = deadline || body.deadline;
                if (!finalDeadline) {
                    const d = new Date();
                    d.setDate(d.getDate() + 2);
                    d.setHours(20, 0, 0, 0);
                    finalDeadline = d.toISOString();
                }

                // 1. Fetch all active questions
                let allQuestions = await utils.fetchAllSupabaseRows(`${supabaseUrl}/rest/v1/questions?select=*`, supabaseKey);
                if (!allQuestions || allQuestions.length === 0) {
                    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Nu s-au putut încărca întrebările din baza de date.' }) };
                }

                // Filter questions if a specific exam type (non-Toate) is requested
                let poolByExam = allQuestions;
                if (examType !== 'Toate') {
                    const filtered = allQuestions.filter(q => (q.exam_type || 'Diverse').includes(examType));
                    if (filtered.length >= totalTarget) {
                        poolByExam = filtered;
                    }
                }

                // 2. Fetch student past results (completed tests & category_coverage)
                const encodedUser = encodeURIComponent(targetStudent);
                const resultsRes = await fetch(`${supabaseUrl}/rest/v1/results?or=(student_username.ilike.${encodedUser},student_name.ilike.${encodedUser})&order=created_at.asc`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                const pastResults = resultsRes.ok ? await resultsRes.json() : [];

                // 3. Fetch pending assigned tests so we don't pick questions already assigned in active tests
                const currentlyAssignedSet = new Set();
                try {
                    const pendingRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?student_username=ilike.${encodedUser}&status=eq.pending&select=questions_ids`, {
                        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                    });
                    if (pendingRes.ok) {
                        const pendingTests = await pendingRes.json();
                        pendingTests.forEach(pt => {
                            let qIds = pt.questions_ids;
                            if (typeof qIds === 'string') {
                                try { qIds = JSON.parse(qIds); } catch (e) { qIds = []; }
                            }
                            if (Array.isArray(qIds)) {
                                qIds.forEach(id => currentlyAssignedSet.add(Number(id)));
                            }
                        });
                    }
                } catch(e) {}

                // 4. Build student mastery map and wrong set
                const masteredSet = new Set();
                const wrongSet = new Set();
                const subcatStats = {}; // subcategory -> { seen: 0, correct: 0 }

                for (const res of pastResults) {
                    if (res.test_type && res.test_type.startsWith('progress_')) continue;

                    if (res.test_type === 'category_coverage') {
                        const masteredList = Array.isArray(res.details_json) ? res.details_json : [];
                        masteredList.forEach(id => {
                            const qId = Number(id);
                            if (!isNaN(qId)) {
                                masteredSet.add(qId);
                                wrongSet.delete(qId);
                            }
                        });

                        let pWrongs = res.answers_json;
                        if (typeof pWrongs === 'string') {
                            try { pWrongs = JSON.parse(pWrongs); } catch (e) { pWrongs = []; }
                        }
                        if (Array.isArray(pWrongs)) {
                            pWrongs.forEach(item => {
                                if (item && (item.id !== undefined || item.question_id !== undefined)) {
                                    const qId = Number(item.id !== undefined ? item.id : item.question_id);
                                    if (!isNaN(qId) && !masteredSet.has(qId)) {
                                        wrongSet.add(qId);
                                    }
                                }
                            });
                        } else if (pWrongs && typeof pWrongs === 'object') {
                            Object.keys(pWrongs).forEach(key => {
                                const qId = Number(key);
                                if (!isNaN(qId) && !masteredSet.has(qId)) {
                                    wrongSet.add(qId);
                                }
                            });
                        }
                        continue;
                    }

                    let details = res.details_json;
                    if (typeof details === 'string') {
                        try { details = JSON.parse(details); } catch(e) { details = []; }
                    }
                    if (Array.isArray(details)) {
                        for (const d of details) {
                            if (!d) continue;
                            const qId = Number(d.id !== undefined ? d.id : d.number);
                            if (isNaN(qId)) continue;
                            const isCor = !!(d.isCorrect === true || d.is_correct === true || d.correct === true || (d.studentAnswer !== null && d.studentAnswer !== undefined && d.correctAnswer !== undefined && d.studentAnswer === d.correctAnswer));

                            // Subcategory stats tracking
                            const sub = (d.subcategory || '').trim();
                            if (sub) {
                                if (!subcatStats[sub]) subcatStats[sub] = { seen: 0, correct: 0 };
                                subcatStats[sub].seen++;
                                if (isCor) subcatStats[sub].correct++;
                            }

                            if (isCor) {
                                masteredSet.add(qId);
                                wrongSet.delete(qId);
                            } else {
                                if (!masteredSet.has(qId)) {
                                    wrongSet.add(qId);
                                }
                            }
                        }
                    }
                }

                // Also update subcatStats with category_coverage data
                masteredSet.forEach(id => {
                    const q = allQuestions.find(x => Number(x.id) === id);
                    if (q && q.subcategory) {
                        const sub = q.subcategory.trim();
                        if (!subcatStats[sub]) subcatStats[sub] = { seen: 0, correct: 0 };
                        subcatStats[sub].seen++;
                        subcatStats[sub].correct++;
                    }
                });
                wrongSet.forEach(id => {
                    const q = allQuestions.find(x => Number(x.id) === id);
                    if (q && q.subcategory) {
                        const sub = q.subcategory.trim();
                        if (!subcatStats[sub]) subcatStats[sub] = { seen: 0, correct: 0 };
                        subcatStats[sub].seen++;
                    }
                });

                // Identify weak subcategories (< 50% accuracy or least mastered)
                const weakSubcatList = [];
                Object.entries(subcatStats).forEach(([sub, stats]) => {
                    const acc = stats.seen > 0 ? (stats.correct / stats.seen) : 1;
                    if (acc < 0.5) {
                        weakSubcatList.push({ sub, acc, seen: stats.seen });
                    }
                });
                weakSubcatList.sort((a, b) => a.acc - b.acc);
                const weakSubcategoryNames = weakSubcatList.map(w => w.sub);

                // 5. Partition questions into candidate pools
                // Pool 1: Wrong questions (50% target)
                const poolWrong = poolByExam.filter(q => wrongSet.has(Number(q.id)) && !currentlyAssignedSet.has(Number(q.id)));

                // Pool 2: Weak subcategory questions (30% target) - excluding already in wrongSet, masteredSet, or currentlyAssigned
                const poolWeak = poolByExam.filter(q => 
                    weakSubcategoryNames.includes((q.subcategory || '').trim()) &&
                    !wrongSet.has(Number(q.id)) &&
                    !masteredSet.has(Number(q.id)) &&
                    !currentlyAssignedSet.has(Number(q.id))
                );

                // Pool 3: New medium & hard questions (20% target) - progression
                const poolNewHard = poolByExam.filter(q => 
                    (q.difficulty === 'hard' || q.difficulty === 'medium') &&
                    !wrongSet.has(Number(q.id)) &&
                    !masteredSet.has(Number(q.id)) &&
                    !currentlyAssignedSet.has(Number(q.id))
                );

                // Pool 4: General unseen fallback
                const poolUnseenFallback = poolByExam.filter(q => 
                    !wrongSet.has(Number(q.id)) &&
                    !masteredSet.has(Number(q.id)) &&
                    !currentlyAssignedSet.has(Number(q.id))
                );

                shuffle(poolWrong);
                shuffle(poolWeak);
                shuffle(poolNewHard);
                shuffle(poolUnseenFallback);

                // 6. Quota calculations with automatic deficit rollover
                const quotaWrong = Math.round(totalTarget * 0.5); // 50%
                const quotaWeak = Math.round(totalTarget * 0.3);  // 30%
                const quotaNew = totalTarget - quotaWrong - quotaWeak; // 20%

                const selectedQuestions = [];
                const pickedIds = new Set();
                const questionOrigins = {}; // qId -> 'wrong' | 'weak' | 'new'

                // Pick from Pool 1 (Wrong)
                const takeWrong = Math.min(quotaWrong, poolWrong.length);
                for (let i = 0; i < takeWrong; i++) {
                    const q = poolWrong[i];
                    selectedQuestions.push(q);
                    pickedIds.add(Number(q.id));
                    questionOrigins[q.id] = 'wrong';
                }

                // Pick from Pool 2 (Weak subcategories)
                const neededWeak = quotaWeak + (quotaWrong - takeWrong); // deficit rollover from wrong
                let takeWeakCount = 0;
                for (const q of poolWeak) {
                    if (takeWeakCount >= neededWeak || selectedQuestions.length >= totalTarget) break;
                    if (!pickedIds.has(Number(q.id))) {
                        selectedQuestions.push(q);
                        pickedIds.add(Number(q.id));
                        questionOrigins[q.id] = 'weak';
                        takeWeakCount++;
                    }
                }

                // Pick from Pool 3 (New medium / hard progression)
                for (const q of poolNewHard) {
                    if (selectedQuestions.length >= totalTarget) break;
                    if (!pickedIds.has(Number(q.id))) {
                        selectedQuestions.push(q);
                        pickedIds.add(Number(q.id));
                        questionOrigins[q.id] = 'new';
                    }
                }

                // Final safety fallback from poolUnseenFallback or poolByExam if needed
                if (selectedQuestions.length < totalTarget) {
                    for (const q of poolUnseenFallback) {
                        if (selectedQuestions.length >= totalTarget) break;
                        if (!pickedIds.has(Number(q.id))) {
                            selectedQuestions.push(q);
                            pickedIds.add(Number(q.id));
                            questionOrigins[q.id] = 'new';
                        }
                    }
                }
                if (selectedQuestions.length < totalTarget) {
                    for (const q of poolByExam) {
                        if (selectedQuestions.length >= totalTarget) break;
                        if (!pickedIds.has(Number(q.id))) {
                            selectedQuestions.push(q);
                            pickedIds.add(Number(q.id));
                            questionOrigins[q.id] = 'new';
                        }
                    }
                }

                shuffle(selectedQuestions);

                const countWrong = selectedQuestions.filter(q => questionOrigins[q.id] === 'wrong').length;
                const countWeak = selectedQuestions.filter(q => questionOrigins[q.id] === 'weak').length;
                const countNew = selectedQuestions.filter(q => questionOrigins[q.id] === 'new').length;

                const responseDraft = {
                    draft: true,
                    is_smart_recovery: true,
                    title: `⚡ Temă Recuperare: ${targetStudent}`,
                    student_username: targetStudent,
                    exam_type: examType,
                    target_length: selectedQuestions.length,
                    deadline: finalDeadline,
                    questions_ids: selectedQuestions.map(q => q.id),
                    status: 'pending',
                    recovery_meta: {
                        from_wrong_count: countWrong,
                        from_weak_count: countWeak,
                        from_new_count: countNew,
                        weak_subcategories: weakSubcategoryNames,
                        total_wrong_pool: poolWrong.length,
                        question_origins: questionOrigins
                    }
                };

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(responseDraft)
                };
            }

            if (action === 'bulk_assign' || body.action === 'bulk_assign') {
                const student_usernames = Array.isArray(body.student_usernames) ? body.student_usernames : (Array.isArray(body.students) ? body.students : []);
                const questions_ids = Array.isArray(body.questions_ids) ? body.questions_ids.map(n => Number(n)) : [];
                const preset_id = body.preset_id ? Number(body.preset_id) : null;
                const title = (body.title || '').trim();
                const exam_type = body.exam_type || 'Diverse';
                const deadline = body.deadline;

                if (student_usernames.length === 0) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Trebuie să selectezi cel puțin un elev.' }) };
                }

                if (questions_ids.length === 0) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Testul nu conține întrebări.' }) };
                }

                if (!deadline) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Termenul limită este obligatoriu.' }) };
                }

                const assignedRecords = student_usernames.map(username => {
                    const rec = {
                        student_username: String(username).trim(),
                        exam_type: exam_type,
                        target_length: questions_ids.length,
                        deadline: deadline,
                        questions_ids: questions_ids,
                        status: 'pending'
                    };
                    if (preset_id) rec.preset_id = preset_id;
                    if (title) rec.title = title;
                    return rec;
                });

                const insertRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(assignedRecords)
                });

                if (!insertRes.ok) {
                    const errText = await insertRes.text();
                    // Fallback graceful dacă coloanele title sau preset_id nu există încă în DB
                    if (errText.includes('preset_id') || errText.includes('title') || errText.includes('column')) {
                        const fallbackRecords = student_usernames.map(username => ({
                            student_username: String(username).trim(),
                            exam_type: exam_type,
                            target_length: questions_ids.length,
                            deadline: deadline,
                            questions_ids: questions_ids,
                            status: 'pending'
                        }));
                        const fallbackRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests`, {
                            method: 'POST',
                            headers: {
                                'apikey': supabaseKey,
                                'Authorization': `Bearer ${supabaseKey}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=representation'
                            },
                            body: JSON.stringify(fallbackRecords)
                        });
                        if (!fallbackRes.ok) throw new Error(await fallbackRes.text());
                        const insertedFallback = await fallbackRes.json();
                        return { statusCode: 201, headers, body: JSON.stringify({ success: true, count: insertedFallback.length, assigned_count: insertedFallback.length, assigned: insertedFallback }) };
                    }
                    throw new Error(errText);
                }

                const inserted = await insertRes.json();
                return { statusCode: 201, headers, body: JSON.stringify({ success: true, count: inserted.length, assigned_count: inserted.length, assigned: inserted }) };
            }

            if (body.save_draft) {
                const draftRecord = {
                    student_username: body.student_username,
                    exam_type: body.exam_type,
                    target_length: body.target_length,
                    deadline: body.deadline,
                    questions_ids: body.questions_ids,
                    status: 'pending'
                };
                if (body.title) draftRecord.title = body.title;
                if (body.preset_id) draftRecord.preset_id = body.preset_id;

                let insertRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests`, {
                    method: 'POST',
                    headers: { 
                        'apikey': supabaseKey, 
                        'Authorization': `Bearer ${supabaseKey}`, 
                        'Content-Type': 'application/json', 
                        'Prefer': 'return=representation' 
                    },
                    body: JSON.stringify(draftRecord)
                });
                if (!insertRes.ok) {
                    const errText = await insertRes.text();
                    if (errText.includes('title') || errText.includes('preset_id') || errText.includes('column')) {
                        delete draftRecord.title;
                        delete draftRecord.preset_id;
                        insertRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests`, {
                            method: 'POST',
                            headers: { 
                                'apikey': supabaseKey, 
                                'Authorization': `Bearer ${supabaseKey}`, 
                                'Content-Type': 'application/json', 
                                'Prefer': 'return=representation' 
                            },
                            body: JSON.stringify(draftRecord)
                        });
                        if (!insertRes.ok) throw new Error(await insertRes.text());
                    } else {
                        throw new Error(errText);
                    }
                }
                const inserted = await insertRes.json();
                return { statusCode: 201, headers, body: JSON.stringify(inserted[0]) };
            }

            if (!student_username || !exam_type || !target_length || !deadline) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Toate câmpurile sunt obligatorii.' }) };
            }

            const { fetchAllSupabaseRows } = require('./_utils');
            // 1. Fetch all questions for requested category with pagination
            let allQuestions = await fetchAllSupabaseRows(`${supabaseUrl}/rest/v1/questions?select=id,exam_type,category,subcategory`, supabaseKey);

            let categoryQuestions = allQuestions;
            if (exam_type !== 'Toate') {
                categoryQuestions = allQuestions.filter(q => (q.exam_type || 'Diverse').includes(exam_type));
            }

            let preselected_ids = body.preselected_ids || [];
            let selected = [];
            
            if (preselected_ids.length > target_length) {
                target_length = preselected_ids.length; // Override
            }

            if (preselected_ids.length > 0) {
                const preSet = new Set(preselected_ids.map(String));
                const preQuestions = allQuestions.filter(q => preSet.has(String(q.id)));
                selected.push(...preQuestions);
                
                allQuestions = allQuestions.filter(q => !preSet.has(String(q.id)));
                categoryQuestions = categoryQuestions.filter(q => !preSet.has(String(q.id)));
            }

            if (categoryQuestions.length + selected.length === 0) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ error: `Nu există întrebări în baza de date pentru categoria "${exam_type}".` }) 
                };
            }

            if (categoryQuestions.length + selected.length < target_length) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ error: `Categoria "${exam_type}" conține doar ${categoryQuestions.length + selected.length} întrebări în total.` }) 
                };
            }

            // 2. Fetch student's past completed results to evaluate priorities
            const encodedUser = encodeURIComponent(student_username);
            const resUrl = `${supabaseUrl}/rest/v1/results?or=(student_username.ilike.${encodedUser},student_name.ilike.${encodedUser})&order=created_at.asc`;
            const resultsResponse = await fetch(resUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
            
            const lastQuestionStatus = {}; // question_id -> boolean (true if correct, false if wrong)
            if (resultsResponse.ok) {
                const pastResults = await resultsResponse.json();
                for (const res of pastResults) {
                    if (res.test_type && res.test_type.startsWith('progress_')) continue; // exclude partials
                    
                    if (res.test_type === 'category_coverage') {
                        const masteredList = Array.isArray(res.details_json) ? res.details_json : [];
                        masteredList.forEach(id => {
                            const qId = Number(id);
                            if (!isNaN(qId)) lastQuestionStatus[qId] = true;
                        });

                        let pWrongs = res.answers_json;
                        if (typeof pWrongs === 'string') {
                            try { pWrongs = JSON.parse(pWrongs); } catch (e) { pWrongs = []; }
                        }
                        if (Array.isArray(pWrongs)) {
                            pWrongs.forEach(item => {
                                if (item && (item.id !== undefined || item.question_id !== undefined)) {
                                    const qId = Number(item.id !== undefined ? item.id : item.question_id);
                                    if (!isNaN(qId) && lastQuestionStatus[qId] !== true) {
                                        lastQuestionStatus[qId] = false;
                                    }
                                }
                            });
                        } else if (pWrongs && typeof pWrongs === 'object') {
                            Object.keys(pWrongs).forEach(key => {
                                const qId = Number(key);
                                if (!isNaN(qId) && lastQuestionStatus[qId] !== true) {
                                    lastQuestionStatus[qId] = false;
                                }
                            });
                        }
                        continue;
                    }

                    let details = res.details_json;
                    if (typeof details === 'string') {
                        try { details = JSON.parse(details); } catch(e) { details = []; }
                    }
                    if (Array.isArray(details)) {
                        for (const d of details) {
                            if (!d) continue;
                            const qId = Number(d.id !== undefined ? d.id : d.number);
                            if (isNaN(qId)) continue;
                            const isCor = !!(d.isCorrect === true || d.is_correct === true || d.correct === true || (d.studentAnswer !== null && d.studentAnswer !== undefined && d.correctAnswer !== undefined && d.studentAnswer === d.correctAnswer));
                            if (isCor) {
                                lastQuestionStatus[qId] = true;
                            } else if (lastQuestionStatus[qId] !== true) {
                                lastQuestionStatus[qId] = false;
                            }
                        }
                    }
                }
            }

            // Also fetch pending assigned tests so questions already assigned to the student are marked 'assigned' and not treated as 'unseen'
            try {
                const pendingAssignedRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?student_username=ilike.${encodedUser}&status=eq.pending&select=questions_ids`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (pendingAssignedRes.ok) {
                    const pendingTests = await pendingAssignedRes.json();
                    for (const pt of pendingTests) {
                        let qIds = pt.questions_ids;
                        if (typeof qIds === 'string') {
                            try { qIds = JSON.parse(qIds); } catch(e) { qIds = []; }
                        }
                        if (Array.isArray(qIds)) {
                            for (const id of qIds) {
                                const qNum = Number(id);
                                if (!isNaN(qNum) && lastQuestionStatus[qNum] === undefined) {
                                    lastQuestionStatus[qNum] = 'assigned';
                                }
                            }
                        }
                    }
                }
            } catch(e) {
                console.error('Error fetching pending assigned tests in manage-assigned-tests:', e);
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

            // selected array is already initialized with preselected ones

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
                    if (!tRes.ok) {
                        const text = await tRes.text().catch(()=>'');
                        throw new Error(`HTTP ${tRes.status} pe tRes: ${text}`);
                    }
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
                if (!qResponse.ok) {
                    const text = await qResponse.text().catch(()=>'');
                    throw new Error(`HTTP ${qResponse.status} pe qResponse: ${text}`);
                }
                let allQuestions = await qResponse.json();
                let categoryQuestions = allQuestions;
                if (targetExamType !== 'Toate') {
                    categoryQuestions = allQuestions.filter(q => (q.exam_type || 'Diverse').includes(targetExamType));
                }

                // Fetch history
                const encodedUser = encodeURIComponent(targetUsername);
                const resUrl = `${supabaseUrl}/rest/v1/results?or=(student_username.ilike.${encodedUser},student_name.ilike.${encodedUser})&order=created_at.asc`;
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

                const currentSet = new Set(currentIds.map(String));
                const candidates = categoryQuestions.filter(q => !currentSet.has(String(q.id)));

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
                    const newIds = currentIds.map(qid => String(qid) === String(old_question_id) ? newQId : qid);
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

            if (action === 'update_deadline') {
                if (!id || !body.deadline) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID-ul și noul termen (deadline) sunt obligatorii.' }) };
                }
                const updateRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?id=eq.${id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({ deadline: body.deadline })
                });
                if (!updateRes.ok) throw new Error(await updateRes.text());
                const updated = await updateRes.json();
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, test: updated[0] }) };
            }
            
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Acțiune invalidă.' }) };
            
        } else if (method === 'DELETE') {
            if (!isAdmin) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
            const params = event.queryStringParameters || {};
            if (!params.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id' }) };
            
            const id = params.id;
            const action = (params.action || 'delete').toLowerCase();

            if (action === 'reassign') {
                // 1. Fetch assigned test to check its current deadline
                const getRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?id=eq.${id}&select=*`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (!getRes.ok) throw new Error(await getRes.text());
                const getJson = await getRes.json();
                if (getJson.length === 0) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Assigned test not found' }) };
                }
                const testRow = getJson[0];

                // 2. Compute deadline:
                // Dacă termenul inițial este mai mare de 24h din acest moment, îl lasă pe acela.
                // Altfel, modifică termenul cu cel puțin 24+ ore până la următoarea oră fixă (ex: dacă e 12:01 acum -> 13:00 mâine).
                const now = new Date();
                const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

                let newDeadlineIso;
                if (testRow.deadline && new Date(testRow.deadline).getTime() > twentyFourHoursFromNow.getTime()) {
                    newDeadlineIso = new Date(testRow.deadline).toISOString();
                } else {
                    const target = new Date(twentyFourHoursFromNow);
                    if (target.getMinutes() > 0 || target.getSeconds() > 0 || target.getMilliseconds() > 0) {
                        target.setHours(target.getHours() + 1, 0, 0, 0);
                    } else {
                        target.setSeconds(0, 0);
                    }
                    newDeadlineIso = target.toISOString();
                }

                // 3. Clean up progress row for this test
                await fetch(`${supabaseUrl}/rest/v1/results?test_type=eq.progress_${id}`, {
                    method: 'DELETE',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                }).catch(e => console.error('Warning: Failed to delete progress row', e));

                // 4. Clean up any completion result from results table
                await fetch(`${supabaseUrl}/rest/v1/results?details_json=cs.%5B%7B%22assigned_test_id%22:%22${id}%22%7D%5D`, {
                    method: 'DELETE',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                }).catch(e => console.error('Warning: Failed to delete completion result', e));

                // 5. Reset status to pending and update deadline in assigned_tests
                const patchPayload = {
                    status: 'pending',
                    deadline: newDeadlineIso
                };
                if (testRow.current_answers !== undefined) {
                    patchPayload.current_answers = [];
                }

                const patchRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?id=eq.${id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(patchPayload)
                });
                if (!patchRes.ok) throw new Error(await patchRes.text());

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, action: 'reassigned', deadline: newDeadlineIso }) };

            } else {
                // DEFINITIVE DELETE: șterge definitiv testul și toate răspunsurile / progresul din baza de date
                // 1. Clean up progress row
                await fetch(`${supabaseUrl}/rest/v1/results?test_type=eq.progress_${id}`, {
                    method: 'DELETE',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                }).catch(e => console.error('Warning: Failed to delete progress row', e));

                // 2. Clean up any completion result in results table
                await fetch(`${supabaseUrl}/rest/v1/results?details_json=cs.%5B%7B%22assigned_test_id%22:%22${id}%22%7D%5D`, {
                    method: 'DELETE',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                }).catch(e => console.error('Warning: Failed to delete completion result', e));

                // 3. Delete the assigned test row permanently
                const delRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?id=eq.${id}`, {
                    method: 'DELETE',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (!delRes.ok) throw new Error(await delRes.text());

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, action: 'deleted' }) };
            }
        }

        return { statusCode: 405, headers, body: 'Method not allowed' };
    } catch (e) {
        console.error('Error manage-assigned-tests:', e);
        return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
};
