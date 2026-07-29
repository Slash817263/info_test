exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Supabase environment variables are missing.' })
        };
    }

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/questions?select=*&order=id.asc`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Supabase request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Map database fields to the shape the frontend expects
        const isAdmin = (event.queryStringParameters || {}).admin === 'true';
        const mappedQuestions = data.map(q => {
            let options = q.options_json;
            if (typeof options === 'string') {
                options = JSON.parse(options);
            }
            const base = {
                id: q.id,
                difficulty: q.difficulty,
                type: q.type,
                category: q.category || null,
                subcategory: q.subcategory || null,
                text: q.text,
                code: q.code,
                options: options
            };
            if (isAdmin) {
                base.correct_index = q.correct_index;
                base.explanation = q.explanation;
            }
            return base;
        });

        const queryParams = event.queryStringParameters || {};
        const testType = queryParams.type || 'initial';
        const email = queryParams.email || '';
        const idsParam = queryParams.ids || '';

        // If admin, just return all mapped questions in their original DB order
        if (isAdmin) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(mappedQuestions)
            };
        }

        let selectedQuestions = [];

        // Shuffle helper
        const shuffle = (array) => {
            let currentIndex = array.length, randomIndex;
            while (currentIndex != 0) {
                randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex--;
                [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
            }
            return array;
        };

        if (idsParam) {
            // Restore session with exact questions and order
            const requestedIds = idsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
            selectedQuestions = requestedIds.map(id => mappedQuestions.find(q => q.id === id)).filter(Boolean);
        } else if (testType === 'intermediar' && email) {
            // Fetch past results to dynamically pick questions
            const resUrl = `${supabaseUrl}/rest/v1/results?student_email=eq.${encodeURIComponent(email)}&order=created_at.desc`;
            const resultsResponse = await fetch(resUrl, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            if (resultsResponse.ok) {
                const pastResults = await resultsResponse.json();
                
                // Aggregate last seen status for each question
                const lastStatus = {};
                for (let i = pastResults.length - 1; i >= 0; i--) { // older to newer
                    const details = pastResults[i].details_json || [];
                    for (const d of details) {
                        lastStatus[d.id] = d.isCorrect;
                    }
                }

                const wrongQs = [];
                const correctQs = [];
                const unseenQs = [];

                for (const q of mappedQuestions) {
                    if (lastStatus[q.id] === false) {
                        wrongQs.push(q);
                    } else if (lastStatus[q.id] === true) {
                        correctQs.push(q);
                    } else {
                        unseenQs.push(q);
                    }
                }

                shuffle(wrongQs);
                shuffle(unseenQs);
                shuffle(correctQs);

                // Build test of 30 questions
                const targetLength = 30;
                
                // 1. All wrong questions
                for (const q of wrongQs) {
                    if (selectedQuestions.length < targetLength) selectedQuestions.push(q);
                }
                
                // 2. Unseen questions
                for (const q of unseenQs) {
                    if (selectedQuestions.length < targetLength) selectedQuestions.push(q);
                }
                
                // 3. Correct questions
                for (const q of correctQs) {
                    if (selectedQuestions.length < targetLength) selectedQuestions.push(q);
                }
                
                shuffle(selectedQuestions);
            } else {
                // fallback if results fetch fails
                selectedQuestions = mappedQuestions;
                shuffle(selectedQuestions);
                selectedQuestions = selectedQuestions.slice(0, 30);
            }
        } else {
            // initial test -> order: easy -> medium -> hard
            const easyQs = mappedQuestions.filter(q => q.difficulty === 'easy');
            const mediumQs = mappedQuestions.filter(q => q.difficulty === 'medium');
            const hardQs = mappedQuestions.filter(q => q.difficulty === 'hard');

            shuffle(easyQs);
            shuffle(mediumQs);
            shuffle(hardQs);

            selectedQuestions = [...easyQs, ...mediumQs, ...hardQs];
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(selectedQuestions)
        };
    } catch (error) {
        console.error('Error fetching questions:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};
