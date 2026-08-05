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
        let mappedQuestions = data.map(q => {
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
                image_url: q.image_url || null,
                code: q.code,
                options: options
            };
            if (isAdmin) {
                base.correct_index = q.correct_index;
                base.explanation = q.explanation;
            }
            base.exam_type = q.exam_type || 'Initial';
            return base;
        });

        const queryParams = event.queryStringParameters || {};
        const testType = queryParams.type || 'initial';
        const examType = queryParams.examType || 'Initial'; // Default to Initial for new students
        const email = queryParams.email || '';
        const idsParam = queryParams.ids || '';

        if (testType === 'counts') {
            const counts = { 'Initial': 0, 'Admitere': 0, 'BAC': 0, 'Diverse': 0 };
            mappedQuestions.forEach(q => {
                const ex = q.exam_type || 'Diverse';
                ['Initial', 'Admitere', 'BAC', 'Diverse'].forEach(tab => {
                    if (ex.includes(tab)) counts[tab]++;
                });
            });
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(counts)
            };
        }

        // If admin, just return all mapped questions in their original DB order
        if (isAdmin) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(mappedQuestions)
            };
        }

        // For students, filter questions from the requested examType
        // For students, filter questions from the requested examType
        let categoryFiltered = [];
        if (examType === 'Diverse') {
            categoryFiltered = [...mappedQuestions]; // Take from all categories
        } else {
            categoryFiltered = mappedQuestions.filter(q => (q.exam_type || 'Diverse').includes(examType));
        }

        // Fallback if requested category has no questions
        if (categoryFiltered.length > 0) {
            mappedQuestions = categoryFiltered;
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
            // Fetch past results to dynamically pick questions (checking email, username, or name)
            const encodedEmail = encodeURIComponent(email);
            const resUrl = `${supabaseUrl}/rest/v1/results?or=(student_email.eq.${encodedEmail},student_username.eq.${encodedEmail},student_name.eq.${encodedEmail})&order=created_at.desc`;
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

                // Build test of questions
                let targetLength = 30;
                if (examType === 'Admitere') targetLength = 9;
                else if (examType === 'BAC') targetLength = 10;
                else if (examType === 'Diverse') targetLength = 20;

                const subcatCounts = {};

                function pickDiverseAware(pool, needed) {
                    if (pool.length === 0 || needed <= 0) return [];
                    
                    const bySub = {};
                    for (const q of pool) {
                        const sub = q.subcategory || 'Altele';
                        if (!bySub[sub]) bySub[sub] = [];
                        bySub[sub].push(q);
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

                // 1. Wrong questions
                selectedQuestions.push(...pickDiverseAware(wrongQs, targetLength - selectedQuestions.length));
                // 2. Unseen questions
                selectedQuestions.push(...pickDiverseAware(unseenQs, targetLength - selectedQuestions.length));
                // 3. Correct questions
                selectedQuestions.push(...pickDiverseAware(correctQs, targetLength - selectedQuestions.length));
                
                shuffle(selectedQuestions);
            } else {
                // fallback if results fetch fails
                let targetLength = 30;
                if (examType === 'Admitere') targetLength = 9;
                else if (examType === 'BAC') targetLength = 10;
                else if (examType === 'Diverse') targetLength = 20;
                
                selectedQuestions = mappedQuestions;
                shuffle(selectedQuestions);
                selectedQuestions = selectedQuestions.slice(0, targetLength);
            }
        } else {
            // initial test -> max 30 questions randomly selected
            let pool = shuffle([...mappedQuestions]);
            if (pool.length > 30) pool = pool.slice(0, 30);
            selectedQuestions = pool;
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
