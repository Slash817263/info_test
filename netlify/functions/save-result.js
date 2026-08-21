exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token, X-Admin-Token',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase environment variables are missing.' }) };
    }

    // Verify JWT
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token lipsa' }) };
    }
    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    let decoded;
    try {
        decoded = jwt.verify(token, jwtSecret);
    } catch(e) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token invalid sau expirat' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const {
            student_username,
            student_id,
            test_type,
            exam_type,
            time_taken_ms,
            blur_count,
            answers_json,
            question_ids,
            assigned_test_id
        } = body;

        if (!student_username || time_taken_ms === undefined || !answers_json || !question_ids) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields in request body.' })
            };
        }

        if ((decoded.username || '').toLowerCase() !== (student_username || '').toLowerCase()) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Forbidden: Username mismatch cu token-ul de autentificare.' })
            };
        }

        // Prevent duplicate submissions for assigned tests
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (assigned_test_id && typeof assigned_test_id === 'string' && uuidRegex.test(assigned_test_id)) {
            const checkRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?id=eq.${assigned_test_id}&select=status`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                if (checkData.length > 0 && checkData[0].status === 'completed') {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Această temă a fost deja finalizată și trimisă.' })
                    };
                }
            }
        }

        if (!Array.isArray(answers_json) || !Array.isArray(question_ids) || answers_json.length !== question_ids.length) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid answers payload format or length mismatch.' })
            };
        }

        if (new Set(question_ids).size !== question_ids.length) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Duplicate question IDs are not allowed.' })
            };
        }

        // Fetch the questions from Supabase to evaluate answers server-side
        const idsString = question_ids.join(',');
        const qResponse = await fetch(`${supabaseUrl}/rest/v1/questions?id=in.(${idsString})`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!qResponse.ok) {
            throw new Error(`Failed to fetch questions for evaluation.`);
        }
        
        const fetchedQuestions = await qResponse.json();
        const questionsMap = {};
        fetchedQuestions.forEach(q => questionsMap[q.id] = q);

        const pointsMap = { easy: 1, medium: 2, hard: 3 };
        let serverScore = 0;
        let serverMaxPoints = 100;
        const totalQuestions = question_ids.length;

        // Determine calculation mode
        let dinOficiu = 0;
        let ptsPerQuestion = 0;

        if ((exam_type === 'Academie' || test_type === 'Academie') && totalQuestions === 9) {
            dinOficiu = 10;
            ptsPerQuestion = 10;
        } else {
            dinOficiu = 0;
            ptsPerQuestion = totalQuestions > 0 ? (100 / totalQuestions) : 0;
        }

        serverScore = dinOficiu;
        serverMaxPoints = 100;
        const serverDetails = [];
        const difficultyStats = { easy: {c:0, t:0}, medium: {c:0, t:0}, hard: {c:0, t:0} };

        const isAssigned = !!(assigned_test_id && typeof assigned_test_id === 'string' && uuidRegex.test(assigned_test_id));
        const finalExamType = exam_type || (test_type === 'initial' ? 'Initial' : 'Diverse');
        let finalTestType = 'initial';
        if (isAssigned || test_type === 'tema' || (test_type && test_type.startsWith('tema'))) {
            finalTestType = (finalExamType && finalExamType !== 'Initial') ? `tema:${finalExamType}` : 'tema';
        } else if (test_type === 'intermediar' || (test_type && test_type.startsWith('intermediar'))) {
            finalTestType = `intermediar:${finalExamType}`;
        } else {
            finalTestType = 'initial';
        }
        const isIntermediate = finalTestType.startsWith('intermediar');

        for (let i = 0; i < question_ids.length; i++) {
            const qId = question_ids[i];
            const q = questionsMap[qId];
            if (!q) continue;

            const studentAns = answers_json[i];
            const isCorrect = studentAns === q.correct_index;
            
            const diff = (q.difficulty || 'easy').toLowerCase();
            if (!difficultyStats[diff]) {
                difficultyStats[diff] = { c: 0, t: 0 };
            }
            difficultyStats[diff].t += 1;
            
            if (isCorrect) {
                serverScore += ptsPerQuestion;
                difficultyStats[diff].c += 1;
            }

            let opts = q.options_json;
            if (typeof opts === 'string') {
                try { opts = JSON.parse(opts); } catch(e) {}
            }

            serverDetails.push({
                number: i + 1,
                id: q.id,
                exam_type: q.exam_type || finalExamType,
                difficulty: q.difficulty || 'medium',
                text: q.text,
                code: q.code || null,
                image_url: q.image_url || null,
                isCorrect: isCorrect,
                studentAnswer: studentAns,
                correctAnswer: q.correct_index,
                options: opts,
                hint: isIntermediate ? (q.hint || q.explanation || null) : null
            });
        }

        serverScore = Math.min(Math.round(serverScore), 100);

        const insertData = {
            student_name: student_username, // Fallback for old schema compatibility
            student_username: student_username,
            score: serverScore,
            total_points: serverMaxPoints,
            time_taken_ms: (isAssigned || finalTestType === 'tema') ? 0 : time_taken_ms,
            test_type: finalTestType,
            blur_count: (isAssigned || finalTestType === 'tema') ? 0 : (blur_count !== undefined ? blur_count : 0),
            answers_json: answers_json,
            details_json: serverDetails
        };

        const response = await fetch(`${supabaseUrl}/rest/v1/results`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(insertData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Supabase insert failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // If this result is from an assigned test, mark it as completed and clean up progress
        if (assigned_test_id && typeof assigned_test_id === 'string' && uuidRegex.test(assigned_test_id)) {
            const updateRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?id=eq.${assigned_test_id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ status: 'completed' })
            });
            if (!updateRes.ok) {
                console.error("Failed to update assigned test status", await updateRes.text());
            }

            // Clean up temporary intermediate progress row for this assigned test
            await fetch(`${supabaseUrl}/rest/v1/results?test_type=eq.progress_${assigned_test_id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            }).catch(e => console.error("Error cleaning progress row:", e));
        }

        // Return the evaluated details back to the client so they can show the results page
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ 
                success: true, 
                data: data,
                evaluatedDetails: serverDetails,
                score: serverScore,
                totalPoints: serverMaxPoints,
                stats: difficultyStats
            })
        };
    } catch (error) {
        console.error('Error saving result:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};
