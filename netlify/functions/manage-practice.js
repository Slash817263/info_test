const jwt = require('jsonwebtoken');

const CANONICAL_TAXONOMY = {
    "Fundamente": ["Citire si afisare date", "Operatori si expresii", "Structuri de control", "Complexitati", "Pseudocod"],
    "Organizarea Datelor": ["Vectori", "Matrice", "Siruri de caractere", "Structuri de date (struct)"],
    "Subprograme": ["Transmitere prin valoare", "Transmitere prin referinta", "Recursivitate"],
    "Backtracking": ["Teorie si aplicare practica"],
    "Grafuri si Arbori": ["Terminologie grafuri", "Grafuri orientate", "Grafuri neorientate", "Arbori"]
};

exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token, X-Admin-Token',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const utils = require('./_utils');
    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL', process.env.SUPABASE_URL);
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY', process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase environment variables missing.' }) };
    }

    // Helper: Authenticate request (Admin or Student JWT)
    const isAdmin = utils.verifyAdminToken(event);

    let authUser = null;
    const decoded = utils.parseJwt(event);
    if (decoded && decoded.username) {
        authUser = decoded.username;
    }

    const method = event.httpMethod;

    try {
        if (method === 'GET') {
            const params = event.queryStringParameters || {};
            const action = params.action || 'get_coverage';
            const studentUsername = params.student_username || authUser;

            if (!studentUsername) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'student_username is required.' }) };
            }

            // Must be admin or the student themselves
            if (!isAdmin && (!authUser || authUser.toLowerCase() !== studentUsername.toLowerCase())) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized.' }) };
            }

            // Permitem vizualizarea progresului și pentru conturile expirate
            // (blocăm accesul la teste noi din fetch-questions, dar dashboard-ul este vizibil)

            const { fetchAllSupabaseRows } = require('./_utils');
            // 1. Fetch all active questions to compute accurate totals with full pagination
            const allQuestions = await fetchAllSupabaseRows(`${supabaseUrl}/rest/v1/questions?select=id,category,subcategory,difficulty,type,text,code,options_json,image_url,hint,correct_index`, supabaseKey);

            // 2. Fetch student's coverage record from results table
            const encodedUser = encodeURIComponent(studentUsername);
            const covRes = await fetch(`${supabaseUrl}/rest/v1/results?or=(student_username.ilike.${encodedUser},student_name.ilike.${encodedUser})&test_type=eq.category_coverage&select=*&limit=1`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            let coverageRow = null;
            if (covRes.ok) {
                const covData = await covRes.json();
                if (covData && covData.length > 0) coverageRow = covData[0];
            }

            // Map tracking unique question status: qId -> { isCorrect: boolean, studentAnswer: number|null }
            const questionStatusMap = new Map();
            let masteredSet = new Set();
            let wrongSet = new Set();

            const includeCoverage = params.source !== 'tests' && params.include_coverage !== 'false';

            // 1. From coverageRow (category_coverage) - mastered from practice
            if (includeCoverage && coverageRow && coverageRow.details_json && Array.isArray(coverageRow.details_json)) {
                coverageRow.details_json.forEach(id => {
                    const qId = Number(id);
                    masteredSet.add(qId);
                    questionStatusMap.set(qId, { isCorrect: true, studentAnswer: null });
                });
            }

            // 1b. From coverageRow (category_coverage) - wrong answers from practice
            if (includeCoverage && coverageRow && coverageRow.answers_json) {
                let pWrongs = coverageRow.answers_json;
                if (typeof pWrongs === 'string') {
                    try { pWrongs = JSON.parse(pWrongs); } catch (e) { pWrongs = []; }
                }
                if (Array.isArray(pWrongs)) {
                    pWrongs.forEach(item => {
                        if (item && (item.id !== undefined || item.question_id !== undefined)) {
                            const qId = Number(item.id !== undefined ? item.id : item.question_id);
                            const stAns = item.studentAnswer !== undefined ? item.studentAnswer : item.selected_index;
                            wrongSet.add(qId);
                            if (!masteredSet.has(qId)) {
                                questionStatusMap.set(qId, { isCorrect: false, studentAnswer: stAns });
                            }
                        }
                    });
                } else if (pWrongs && typeof pWrongs === 'object') {
                    Object.entries(pWrongs).forEach(([key, val]) => {
                        const qId = Number(key);
                        if (!isNaN(qId)) {
                            const stAns = typeof val === 'object' && val !== null ? val.studentAnswer : val;
                            wrongSet.add(qId);
                            if (!masteredSet.has(qId)) {
                                questionStatusMap.set(qId, { isCorrect: false, studentAnswer: stAns });
                            }
                        }
                    });
                }
            }

            // 2. Scan all regular test results (chronological order asc: initial, intermediar, tema)
            const histResUrl = `${supabaseUrl}/rest/v1/results?or=(student_username.ilike.${encodedUser},student_name.ilike.${encodedUser})&order=created_at.asc`;
            const pastTests = await fetchAllSupabaseRows(histResUrl, supabaseKey);
            for (const t of (pastTests || [])) {
                if (t.test_type && (t.test_type.startsWith('progress_') || t.test_type === 'category_coverage' || t.test_type === 'lead_diagnostic')) continue;
                let details = t.details_json;
                if (typeof details === 'string') {
                    try { details = JSON.parse(details); } catch (e) { details = []; }
                }
                if (Array.isArray(details)) {
                    for (const d of details) {
                        if (d && (d.id !== undefined || d.number !== undefined)) {
                            const qId = Number(d.id !== undefined ? d.id : d.number);
                            const isCor = !!(d.isCorrect === true || d.is_correct === true || d.correct === true || (d.studentAnswer !== null && d.studentAnswer !== undefined && d.correctAnswer !== undefined && d.studentAnswer === d.correctAnswer));
                            
                            const prev = questionStatusMap.get(qId);
                            if (isCor) {
                                masteredSet.add(qId);
                                wrongSet.delete(qId);
                                questionStatusMap.set(qId, { isCorrect: true, studentAnswer: d.studentAnswer });
                            } else {
                                // If already mastered previously, student remains mastered.
                                // If not yet mastered, mark as wrong with the student's answer.
                                if (!prev || !prev.isCorrect) {
                                    wrongSet.add(qId);
                                    questionStatusMap.set(qId, { isCorrect: false, studentAnswer: d.studentAnswer });
                                }
                            }
                        }
                    }
                }
            }

            // 3. Scan pending assigned tests for this student only if explicitly requested (e.g. from admin triage picker)
            const includeAssigned = params.include_assigned === 'true';
            if (includeAssigned) {
                try {
                    const assignedRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?student_username=ilike.${encodedUser}&status=eq.pending&select=questions_ids`, {
                        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                    });
                    if (assignedRes.ok) {
                        const pendingTests = await assignedRes.json();
                        for (const pt of pendingTests) {
                            let qIds = pt.questions_ids;
                            if (typeof qIds === 'string') {
                                try { qIds = JSON.parse(qIds); } catch (e) { qIds = []; }
                            }
                            if (Array.isArray(qIds)) {
                                for (const id of qIds) {
                                    const qNum = Number(id);
                                    if (!isNaN(qNum) && !questionStatusMap.has(qNum)) {
                                        questionStatusMap.set(qNum, { isCorrect: null, isAssigned: true, studentAnswer: null });
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error fetching pending assigned tests in manage-practice:', err);
                }
            }

            if (action === 'get_student_practice_details') {
                const requestedCategory = params.category || 'all';
                // Only return questions that the student has actually encountered/answered/assigned
                let targetQuestions = allQuestions.filter(q => questionStatusMap.has(Number(q.id)));
                if (requestedCategory && requestedCategory !== 'all') {
                    targetQuestions = targetQuestions.filter(q => q.category === requestedCategory);
                }

                // Sort: wrong questions first, then assigned, then correct ones
                targetQuestions.sort((a, b) => {
                    const stA = questionStatusMap.get(Number(a.id)) || {};
                    const stB = questionStatusMap.get(Number(b.id)) || {};
                    const rankA = stA.isCorrect ? 3 : (stA.isAssigned ? 2 : 1);
                    const rankB = stB.isCorrect ? 3 : (stB.isAssigned ? 2 : 1);
                    if (rankA === rankB) return a.id - b.id;
                    return rankA - rankB;
                });

                const details = targetQuestions.map((q, idx) => {
                    const status = questionStatusMap.get(Number(q.id));
                    let opts = q.options_json;
                    if (typeof opts === 'string') {
                        try { opts = JSON.parse(opts); } catch (e) { opts = []; }
                    }
                    const isAssigned = status ? !!status.isAssigned : false;
                    const isCor = status ? !!status.isCorrect : false;
                    const stAns = (status && status.studentAnswer !== null && status.studentAnswer !== undefined) 
                        ? status.studentAnswer 
                        : (isCor ? q.correct_index : null);

                    return {
                        number: idx + 1,
                        id: q.id,
                        text: q.text,
                        code: q.code,
                        options: opts,
                        studentAnswer: stAns,
                        correctAnswer: q.correct_index,
                        isCorrect: isCor,
                        isAssigned: isAssigned,
                        status: isAssigned ? 'ASIGNAT' : (isCor ? 'CORECT' : 'GRESIT'),
                        difficulty: q.difficulty,
                        category: q.category,
                        subcategory: q.subcategory,
                        image_url: q.image_url,
                        hint: q.hint
                    };
                });

                const totalMastered = details.filter(d => d.isCorrect).length;
                const totalAssigned = details.filter(d => d.isAssigned).length;
                const totalWrong = details.filter(d => !d.isCorrect && !d.isAssigned).length;

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        student_username: studentUsername,
                        category: requestedCategory,
                        total_encountered: details.length,
                        total_mastered: totalMastered,
                        total_assigned: totalAssigned,
                        total_wrong: totalWrong,
                        details: details
                    })
                };
            }

            if (action === 'get_coverage') {
                // Calculate category and subcategory stats
                const categoryStats = [];
                let globalTotal = allQuestions.length;
                let globalMastered = 0;

                for (const [catName, subcats] of Object.entries(CANONICAL_TAXONOMY)) {
                    const catQuestions = allQuestions.filter(q => q.category === catName);
                    const catTotal = catQuestions.length;
                    const catMastered = catQuestions.filter(q => masteredSet.has(Number(q.id))).length;
                    const catPercent = catTotal > 0 ? Math.round((catMastered / catTotal) * 100) : 0;
                    globalMastered += catMastered;

                    const subcatList = subcats.map(subName => {
                        const subQuestions = catQuestions.filter(q => q.subcategory === subName);
                        const subTotal = subQuestions.length;
                        const subMastered = subQuestions.filter(q => masteredSet.has(Number(q.id))).length;
                        const subPercent = subTotal > 0 ? Math.round((subMastered / subTotal) * 100) : 0;
                        return {
                            subcategory: subName,
                            total: subTotal,
                            mastered: subMastered,
                            percent: subPercent
                        };
                    });

                    categoryStats.push({
                        category: catName,
                        total: catTotal,
                        mastered: catMastered,
                        percent: catPercent,
                        subcategories: subcatList
                    });
                }

                const overallPercent = globalTotal > 0 ? Math.round((masteredSet.size / globalTotal) * 100) : 0;

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        student_username: studentUsername,
                        overall_percent: overallPercent,
                        total_mastered: masteredSet.size,
                        total_questions: globalTotal,
                        categories: categoryStats,
                        mastered_ids: Array.from(masteredSet)
                    })
                };

            } else if (action === 'get_session_questions') {
                if (!isAdmin && studentUsername) {
                    const { isStudentSubscriptionActive } = require('./_utils.js');
                    const isActive = await isStudentSubscriptionActive(supabaseUrl, supabaseKey, studentUsername);
                    if (!isActive) {
                        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Subscription expired.' }) };
                    }
                }

                const category = params.category;
                const subcategory = params.subcategory;

                if (!category) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Category is required for practice session.' }) };
                }

                let filtered = allQuestions.filter(q => q.category === category);
                if (subcategory && subcategory !== 'all') {
                    filtered = filtered.filter(q => q.subcategory === subcategory);
                }

                if (filtered.length === 0) {
                    return { statusCode: 200, headers, body: JSON.stringify({ questions: [], all_mastered: false }) };
                }

                // Helper shuffle
                const shuffle = (arr) => {
                    const res = [...arr];
                    for (let i = res.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [res[i], res[j]] = [res[j], res[i]];
                    }
                    return res;
                };

                // Split into 3 main groups:
                // 1. Unattempted (new)
                // 2. Previously Wrong (failed in past tests/sessions, not yet mastered)
                // 3. Already Mastered (solved correctly on first attempt)
                const unattempted = filtered.filter(q => !masteredSet.has(Number(q.id)) && !wrongSet.has(Number(q.id)));
                const previouslyWrong = filtered.filter(q => wrongSet.has(Number(q.id)) && !masteredSet.has(Number(q.id)));
                const alreadyMastered = filtered.filter(q => masteredSet.has(Number(q.id)));

                // Subdivide by difficulty within each group:
                // Easy
                const unattemptedEasy = unattempted.filter(q => q.difficulty === 'easy');
                const wrongEasy = previouslyWrong.filter(q => q.difficulty === 'easy');
                const masteredEasy = alreadyMastered.filter(q => q.difficulty === 'easy');

                // Medium (default if unspecified)
                const unattemptedMedium = unattempted.filter(q => q.difficulty === 'medium' || !q.difficulty);
                const wrongMedium = previouslyWrong.filter(q => q.difficulty === 'medium' || !q.difficulty);
                const masteredMedium = alreadyMastered.filter(q => q.difficulty === 'medium' || !q.difficulty);

                // Hard
                const unattemptedHard = unattempted.filter(q => q.difficulty === 'hard');
                const wrongHard = previouslyWrong.filter(q => q.difficulty === 'hard');
                const masteredHard = alreadyMastered.filter(q => q.difficulty === 'hard');

                // Ordering logic:
                // 1. Ușoare noi
                // 2. Medii noi
                // 3. Grele noi
                // 4. Ușoare greșite anterior
                // 5. Medii greșite anterior
                // 6. Grele greșite anterior
                // 7. Ușoare deja rezolvate
                // 8. Medii deja rezolvate
                // 9. Grele deja rezolvate
                const sessionPool = [
                    ...shuffle(unattemptedEasy),
                    ...shuffle(unattemptedMedium),
                    ...shuffle(unattemptedHard),
                    ...shuffle(wrongEasy),
                    ...shuffle(wrongMedium),
                    ...shuffle(wrongHard),
                    ...shuffle(masteredEasy),
                    ...shuffle(masteredMedium),
                    ...shuffle(masteredHard)
                ];

                const allMastered = unattempted.length === 0 && previouslyWrong.length === 0;

                // Map questions (hide correct_index from client initially)
                const safeQuestions = sessionPool.map(q => {
                    let opts = q.options_json;
                    if (typeof opts === 'string') {
                        try { opts = JSON.parse(opts); } catch (e) { opts = []; }
                    }
                    return {
                        id: q.id,
                        category: q.category,
                        subcategory: q.subcategory,
                        difficulty: q.difficulty,
                        type: q.type,
                        text: q.text,
                        code: q.code,
                        image_url: q.image_url,
                        options: opts
                    };
                });

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        category,
                        subcategory: subcategory || 'all',
                        total_available: filtered.length,
                        unmastered_count: unattempted.length + previouslyWrong.length,
                        all_mastered: allMastered,
                        questions: safeQuestions
                    })
                };
            }

            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid GET action.' }) };

        } else if (method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const action = body.action;

            if (action === 'check_answer') {
                if (!isAdmin && !authUser) {
                    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Autentificare necesară.' }) };
                }

                const { question_id, selected_index, student_username } = body;
                if (question_id === undefined || selected_index === undefined) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'question_id and selected_index are required.' }) };
                }

                const qNum = parseInt(question_id, 10);
                const sIdx = parseInt(selected_index, 10);
                if (isNaN(qNum) || isNaN(sIdx) || qNum <= 0 || sIdx < 0) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Parametrii question_id și selected_index trebuie să fie numere întregi valide.' }) };
                }

                // Enforce student ownership: non-admins can only verify/record answers for their own account
                const targetStudent = isAdmin ? (student_username || authUser) : authUser;
                if (!isAdmin && student_username && student_username.trim().toLowerCase() !== authUser.toLowerCase()) {
                    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden: Nu poți trimite răspunsuri pentru un alt elev.' }) };
                }

                // Verify student subscription
                if (!isAdmin && targetStudent) {
                    const { isStudentSubscriptionActive } = require('./_utils.js');
                    const isActive = await isStudentSubscriptionActive(supabaseUrl, supabaseKey, targetStudent);
                    if (!isActive) {
                        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Abonamentul tău a expirat. Nu poți accesa întrebări de antrenament.' }) };
                    }
                }

                const qRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${qNum}&select=id,correct_index,hint`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (!qRes.ok) throw new Error(await qRes.text());
                const qData = await qRes.json();
                if (!qData || qData.length === 0) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Question not found.' }) };
                }

                const q = qData[0];
                const isCorrect = sIdx === Number(q.correct_index);

                // Auto-record answer (mastered or wrong) in category_coverage in real-time
                if (targetStudent) {
                    try {
                        const safeUser = targetStudent.trim().toLowerCase().replace(/[%_]/g, '\\$&');
                        const encodedUser = encodeURIComponent(safeUser);
                        const covRes = await fetch(`${supabaseUrl}/rest/v1/results?student_username=ilike.${encodedUser}&test_type=eq.category_coverage&select=*&limit=1`, {
                            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                        });
                        let existingRow = null;
                        if (covRes.ok) {
                            const covData = await covRes.json();
                            if (covData && covData.length > 0) existingRow = covData[0];
                        }

                        let wrongList = [];
                        if (existingRow && existingRow.answers_json) {
                            wrongList = typeof existingRow.answers_json === 'string'
                                ? JSON.parse(existingRow.answers_json)
                                : existingRow.answers_json;
                            if (!Array.isArray(wrongList)) wrongList = [];
                        }

                        let masteredList = (existingRow && Array.isArray(existingRow.details_json)) ? existingRow.details_json : [];

                        if (isCorrect) {
                            if (!masteredList.map(Number).includes(qNum)) {
                                masteredList.push(qNum);
                            }
                            wrongList = wrongList.filter(item => Number(item.id || item.question_id) !== qNum);
                        } else {
                            const exIdx = wrongList.findIndex(item => Number(item.id || item.question_id) === qNum);
                            const wrongEntry = {
                                id: qNum,
                                studentAnswer: sIdx,
                                updated_at: new Date().toISOString()
                            };
                            if (exIdx >= 0) {
                                wrongList[exIdx] = wrongEntry;
                            } else {
                                wrongList.push(wrongEntry);
                            }
                        }

                        if (existingRow) {
                            await fetch(`${supabaseUrl}/rest/v1/results?id=eq.${existingRow.id}`, {
                                method: 'PATCH',
                                headers: {
                                    'apikey': supabaseKey,
                                    'Authorization': `Bearer ${supabaseKey}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    score: masteredList.length,
                                    details_json: masteredList,
                                    answers_json: wrongList
                                })
                            });
                        } else {
                            await fetch(`${supabaseUrl}/rest/v1/results`, {
                                method: 'POST',
                                headers: {
                                    'apikey': supabaseKey,
                                    'Authorization': `Bearer ${supabaseKey}`,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'return=representation'
                                },
                                body: JSON.stringify({
                                    student_username: targetStudent,
                                    student_name: targetStudent,
                                    test_type: 'category_coverage',
                                    score: masteredList.length,
                                    total_points: 522,
                                    time_taken_ms: 0,
                                    blur_count: 0,
                                    answers_json: wrongList,
                                    details_json: masteredList
                                })
                            });
                        }
                    } catch (err) {
                        console.error('Error auto-recording practice answer:', err);
                    }
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        question_id: q.id,
                        is_correct: isCorrect,
                        correct_index: q.correct_index,
                        hint: q.hint || null
                    })
                };

            } else if (action === 'sync_coverage') {
                const { student_username, newly_mastered_ids, wrong_answers, earned_xp } = body;
                if (!student_username || !Array.isArray(newly_mastered_ids)) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid payload for sync_coverage.' }) };
                }

                if (!isAdmin && (!authUser || authUser.toLowerCase() !== student_username.toLowerCase())) {
                    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized.' }) };
                }

                // Fetch existing coverage row
                const encodedUser = encodeURIComponent(student_username);
                const covRes = await fetch(`${supabaseUrl}/rest/v1/results?student_username=ilike.${encodedUser}&test_type=eq.category_coverage&select=*&limit=1`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                let existingRow = null;
                if (covRes.ok) {
                    const covData = await covRes.json();
                    if (covData && covData.length > 0) existingRow = covData[0];
                }

                let wrongList = [];
                if (existingRow && existingRow.answers_json) {
                    wrongList = typeof existingRow.answers_json === 'string' 
                        ? JSON.parse(existingRow.answers_json) 
                        : existingRow.answers_json;
                    if (!Array.isArray(wrongList)) wrongList = [];
                }

                // Merge wrong_answers if passed
                if (Array.isArray(wrong_answers)) {
                    wrong_answers.forEach(w => {
                        const qId = Number(w.id || w.question_id);
                        const sAns = w.studentAnswer !== undefined ? w.studentAnswer : w.selected_index;
                        const exIdx = wrongList.findIndex(item => Number(item.id || item.question_id) === qId);
                        const entry = { id: qId, studentAnswer: sAns, updated_at: new Date().toISOString() };
                        if (exIdx >= 0) {
                            wrongList[exIdx] = entry;
                        } else {
                            wrongList.push(entry);
                        }
                    });
                }

                const currentSet = new Set((existingRow && existingRow.details_json) || []);
                newly_mastered_ids.forEach(id => {
                    const qId = Number(id);
                    currentSet.add(qId);
                    // If newly mastered, remove from wrong list
                    wrongList = wrongList.filter(item => Number(item.id || item.question_id) !== qId);
                });
                const updatedList = Array.from(currentSet);

                if (existingRow) {
                    // Update existing row
                    const patchRes = await fetch(`${supabaseUrl}/rest/v1/results?id=eq.${existingRow.id}`, {
                        method: 'PATCH',
                        headers: {
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify({
                            score: updatedList.length,
                            details_json: updatedList,
                            answers_json: wrongList
                        })
                    });
                    if (!patchRes.ok) throw new Error(await patchRes.text());
                } else {
                    // Insert new coverage row
                    const insertRes = await fetch(`${supabaseUrl}/rest/v1/results`, {
                        method: 'POST',
                        headers: {
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify({
                            student_username: student_username,
                            student_name: student_username,
                            test_type: 'category_coverage',
                            score: updatedList.length,
                            total_points: 522,
                            time_taken_ms: 0,
                            blur_count: 0,
                            answers_json: wrongList,
                            details_json: updatedList
                        })
                    });
                    if (!insertRes.ok) throw new Error(await insertRes.text());
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        total_mastered: updatedList.length
                    })
                };
            }

            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid POST action.' }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    } catch (err) {
        console.error('Error in manage-practice:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
