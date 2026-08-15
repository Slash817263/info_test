exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': 'https://acadeinformatica.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type',
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
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.SUPABASE_KEY);
    } catch(e) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token invalid sau expirat' }) };
    }

    try {
        const body = JSON.parse(event.body);
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

        if (!Array.isArray(answers_json) || !Array.isArray(question_ids) || answers_json.length !== question_ids.length) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid answers payload format or length mismatch.' })
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
        let serverMaxPoints = 0;
        
        // Add 10 default points for Academie and Initial
        if (exam_type === 'Academie' || exam_type === 'Diverse' || exam_type === 'Initial' || test_type === 'initial') {
            serverScore = 10;
            serverMaxPoints = 10;
        }
        const serverDetails = [];
        const difficultyStats = { easy: {c:0, t:0}, medium: {c:0, t:0}, hard: {c:0, t:0} };

        for (let i = 0; i < question_ids.length; i++) {
            const qId = question_ids[i];
            const q = questionsMap[qId];
            if (!q) continue;

            const studentAns = answers_json[i];
            const isCorrect = studentAns === q.correct_index;
            
            let pts = 0;
            if (exam_type === 'BAC' || exam_type === 'Academie' || exam_type === 'Diverse' || exam_type === 'Initial' || test_type === 'initial' || exam_type === 'Poli') {
                pts = 10;
            } else {
                pts = pointsMap[q.difficulty] || 0; // fallback
            }
            
            serverMaxPoints += pts;
            difficultyStats[q.difficulty].t += 1;
            
            if (isCorrect) {
                serverScore += pts;
                difficultyStats[q.difficulty].c += 1;
            }

            let opts = q.options_json;
            if (typeof opts === 'string') opts = JSON.parse(opts);

            serverDetails.push({
                number: i + 1,
                id: q.id,
                difficulty: q.difficulty,
                text: q.text,
                code: q.code || null,
                image_url: q.image_url || null,
                isCorrect: isCorrect,
                studentAnswer: studentAns,
                correctAnswer: q.correct_index,
                options: opts,
                explanation: q.explanation
            });
        }

        const insertData = {
            student_name: student_username, // Fallback for old schema compatibility
            student_username: student_username,
            score: serverScore,
            total_points: serverMaxPoints,
            time_taken_ms,
            test_type: test_type || 'initial',
            blur_count: blur_count !== undefined ? blur_count : 0,
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

        // If this result is from an assigned test, mark it as completed
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
