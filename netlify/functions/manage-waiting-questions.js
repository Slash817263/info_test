exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
        'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const validTokens = [process.env.ADMIN_SECRET].filter(Boolean);
    const clientToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];

    if (!clientToken || !validTokens.includes(clientToken)) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Unauthorized: Invalid Admin Token' })
        };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Supabase environment variables are missing.' })
        };
    }

    try {
        const method = event.httpMethod;
        const params = event.queryStringParameters || {};
        const qId = params.id ? String(params.id).trim() : null;

        // APPROVE SINGLE OR ALL
        if (method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const action = body.action || 'approve';

            if (action === 'approve_all') {
                // Fetch waiting questions from Supabase
                const fetchRes = await fetch(`${supabaseUrl}/rest/v1/waiting_questions?select=*`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                
                let questionsToApprove = [];
                if (fetchRes.ok) {
                    const sbList = await fetchRes.json();
                    if (sbList && sbList.length > 0) questionsToApprove = sbList;
                }

                if (questionsToApprove.length === 0) {
                    return { statusCode: 200, headers, body: JSON.stringify({ message: 'No questions to approve.' }) };
                }

                // Batch insert into questions table
                const insertPayload = questionsToApprove.map(q => {
                    let opts = q.options_json || q.options;
                    if (typeof opts === 'string') {
                        try { opts = JSON.parse(opts); } catch(e) {}
                    }
                    return {
                        difficulty: q.difficulty,
                        type: q.type,
                        category: q.category,
                        subcategory: q.subcategory,
                        exam_type: q.exam_type || 'Initial',
                        text: q.text,
                        image_url: q.image_url || null,
                        code: q.code || null,
                        options_json: opts,
                        correct_index: parseInt(q.correct_index)
                    };
                });

                const insRes = await fetch(`${supabaseUrl}/rest/v1/questions`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(insertPayload)
                });

                if (!insRes.ok) {
                    const errText = await insRes.text();
                    throw new Error(`Failed to insert questions into Supabase: ${errText}`);
                }

                // Clear waiting table
                await fetch(`${supabaseUrl}/rest/v1/waiting_questions?id=gt.0`, {
                    method: 'DELETE',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                }).catch(e => console.error('Warning: Failed to clear waiting_questions table:', e));

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, count: questionsToApprove.length })
                };
            }

            // APPROVE SINGLE
            if (action === 'approve') {
                const questionData = body.question;
                if (!questionData) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing question data.' }) };
                }

                let opts = questionData.options_json || questionData.options;
                if (typeof opts === 'string') {
                    try { opts = JSON.parse(opts); } catch(e) {}
                }

                // Insert into Supabase questions table
                const insRes = await fetch(`${supabaseUrl}/rest/v1/questions`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        difficulty: questionData.difficulty,
                        type: questionData.type,
                        category: questionData.category,
                        subcategory: questionData.subcategory,
                        exam_type: questionData.exam_type || 'Initial',
                        text: questionData.text,
                        image_url: questionData.image_url || null,
                        code: questionData.code || null,
                        options_json: opts,
                        correct_index: parseInt(questionData.correct_index)
                    })
                });

                if (!insRes.ok) {
                    const errText = await insRes.text();
                    throw new Error(`Failed to insert question into Supabase: ${errText}`);
                }

                const approvedData = await insRes.json();

                // Remove from waiting table
                const targetId = qId || questionData.id;
                if (targetId) {
                    await fetch(`${supabaseUrl}/rest/v1/waiting_questions?id=eq.${targetId}`, {
                        method: 'DELETE',
                        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                    }).catch(e => console.error('Warning: Failed to remove question from waiting table:', e));
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, approvedQuestion: approvedData[0] })
                };
            }
        }

        // REJECT (DELETE)
        if (method === 'DELETE') {
            if (!qId) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing question ID.' }) };
            }

            const delRes = await fetch(`${supabaseUrl}/rest/v1/waiting_questions?id=eq.${qId}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });

            if (!delRes.ok) {
                 return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to delete from DB.' }) };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'Question rejected.' })
            };
        }

        // UPDATE WAITING QUESTION (PUT)
        if (method === 'PUT') {
            if (!qId) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing question ID.' }) };
            }
            const body = JSON.parse(event.body || '{}');

            const allowedFields = ['exam_type', 'difficulty', 'type', 'category', 'subcategory', 'text', 'image_url', 'code', 'options_json', 'correct_index'];
            const safeBody = {};
            for (const key of allowedFields) {
                if (body[key] !== undefined) {
                    safeBody[key] = body[key];
                }
            }

            if (safeBody.options_json && typeof safeBody.options_json === 'string') {
                try { safeBody.options_json = JSON.parse(safeBody.options_json); } catch(e) {}
            }
            if (safeBody.correct_index !== undefined) {
                safeBody.correct_index = parseInt(safeBody.correct_index);
            }

            if (Object.keys(safeBody).length === 0) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'No valid fields provided for update.' }) };
            }

            const updRes = await fetch(`${supabaseUrl}/rest/v1/waiting_questions?id=eq.${qId}`, {
                method: 'PATCH',
                headers: { 
                    'apikey': supabaseKey, 
                    'Authorization': `Bearer ${supabaseKey}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(safeBody)
            });

            if (!updRes.ok) {
                return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to update in DB.' }) };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, question: body })
            };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        console.error('Error in manage-waiting-questions:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};
