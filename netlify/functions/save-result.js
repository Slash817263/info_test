exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
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

    try {
        const body = JSON.parse(event.body);
        const {
            student_name,
            student_email,
            test_type,
            time_taken_ms,
            blur_count,
            answers_json,
            question_ids
        } = body;

        if (!student_name || time_taken_ms === undefined || !answers_json || !question_ids) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields in request body.' })
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
        const serverDetails = [];
        const difficultyStats = { easy: {c:0, t:0}, medium: {c:0, t:0}, hard: {c:0, t:0} };

        for (let i = 0; i < question_ids.length; i++) {
            const qId = question_ids[i];
            const q = questionsMap[qId];
            if (!q) continue;

            const studentAns = answers_json[i];
            const isCorrect = studentAns === q.correct_index;
            const pts = pointsMap[q.difficulty] || 0;
            
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
                isCorrect: isCorrect,
                studentAnswer: studentAns,
                correctAnswer: q.correct_index,
                options: opts,
                explanation: q.explanation
            });
        }

        const insertData = {
            student_name,
            score: serverScore,
            total_points: serverMaxPoints,
            time_taken_ms,
            student_email: student_email || null,
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
