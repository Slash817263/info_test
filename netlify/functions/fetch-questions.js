exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, X-Admin-Token',
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
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Supabase environment variables are missing.' })
        };
    }

    try {
        const queryParams = event.queryStringParameters || {};
        const validTokens = [process.env.ADMIN_SECRET].filter(Boolean);
        const clientToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
        const isAdmin = queryParams.admin === 'true' && clientToken && validTokens.includes(clientToken);

        const testType = queryParams.type || 'initial';
        const examType = queryParams.examType || 'Initial';
        const username = queryParams.username || '';
        const idsParam = queryParams.ids || '';

        // Optimization 1: Counts query - only fetch id & exam_type
        if (testType === 'counts') {
            const countsResponse = await fetch(`${supabaseUrl}/rest/v1/questions?select=id,exam_type`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });
            if (!countsResponse.ok) {
                const errorText = await countsResponse.text();
                throw new Error(`Supabase request failed: ${countsResponse.status} - ${errorText}`);
            }
            const dataCounts = await countsResponse.json();
            const counts = { 'Initial': 0, 'Academie': 0, 'Poli': 0, 'BAC': 0, 'Diverse': 0 };
            dataCounts.forEach(q => {
                const ex = q.exam_type || 'Diverse';
                ['Initial', 'Academie', 'Poli', 'BAC', 'Diverse'].forEach(tab => {
                    if (ex.includes(tab)) counts[tab]++;
                });
            });
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(counts)
            };
        }

        // Construct targeted Supabase query
        let queryUrl = `${supabaseUrl}/rest/v1/questions?select=*&order=id.asc`;
        if (!isAdmin) {
            if (idsParam) {
                const requestedIds = idsParam.split(',').map(id => id.trim()).filter(Boolean);
                if (requestedIds.length > 0) {
                    queryUrl += `&id=in.(${requestedIds.join(',')})`;
                }
            } else if (examType !== 'Diverse') {
                queryUrl += `&exam_type=ilike.*${encodeURIComponent(examType)}*`;
            }
        }

        const response = await fetch(queryUrl, {
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
        let mappedQuestions = data.map(q => {
            let options = q.options_json;
            if (typeof options === 'string') {
                try { options = JSON.parse(options); } catch (e) { options = []; }
            }
            const isInitialTest = (testType === 'initial' || examType === 'Initial') && !idsParam;
            const base = {
                id: q.id,
                difficulty: q.difficulty,
                type: q.type,
                category: q.category || null,
                subcategory: q.subcategory || null,
                text: q.text,
                image_url: q.image_url || null,
                code: q.code,
                hint: (!isAdmin && isInitialTest) ? null : (q.hint || q.explanation || null),
                options: options
            };
            if (isAdmin) {
                base.correct_index = q.correct_index;
            }
            base.exam_type = q.exam_type || 'Initial';
            return base;
        });

        // If admin, return all mapped questions
        if (isAdmin) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(mappedQuestions)
            };
        }

        // Double-check category filtering if examType specified and not Diverse
        if (!idsParam) {
            let categoryFiltered = [];
            if (examType === 'Diverse') {
                categoryFiltered = [...mappedQuestions];
            } else {
                categoryFiltered = mappedQuestions.filter(q => (q.exam_type || 'Diverse').includes(examType));
            }
            mappedQuestions = categoryFiltered;
            if (mappedQuestions.length === 0) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify([])
                };
            }
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
            // Restore session with exact questions and order (handles string UUIDs)
            const requestedIds = idsParam.split(',').map(id => id.trim()).filter(Boolean);
            selectedQuestions = requestedIds.map(id => mappedQuestions.find(q => String(q.id) === String(id))).filter(Boolean);
        } else if (testType === 'intermediar' && username) {
            // Fetch past results to dynamically pick questions (checking username or name)
            const encodedUsername = encodeURIComponent(username);
            const resUrl = `${supabaseUrl}/rest/v1/results?or=(student_username.ilike.${encodedUsername},student_name.ilike.${encodedUsername})&order=created_at.desc`;
            const resultsResponse = await fetch(resUrl, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            let targetLength = 10;
            if (examType === 'Academie') targetLength = 9;
            else if (examType === 'Poli') targetLength = 10;
            else if (examType === 'BAC') targetLength = 10;
            else if (examType === 'Diverse') targetLength = 10;

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

            if (resultsResponse.ok) {
                const pastResults = await resultsResponse.json();
                
                // Aggregate last seen status for each question
                const lastStatus = {};
                for (let i = pastResults.length - 1; i >= 0; i--) { // older to newer
                    if (pastResults[i].test_type && pastResults[i].test_type.startsWith('progress_')) continue;
                    const details = pastResults[i].details_json || [];
                    for (const d of details) {
                        if (d && d.id !== undefined) {
                            lastStatus[d.id] = !!d.isCorrect;
                        }
                    }
                }

                if (examType === 'Diverse') {
                    // LOGICA SPECIALA DIVERSE:
                    // 1. Diverse nefăcute
                    // 2. Diverse greșite
                    // 3. Alte categorii (Bac, Poli, Academie) nefăcute - STRICT RANDOM & echilibrate
                    // 4. Alte categorii greșite
                    // 5. Diverse corecte
                    // 6. Alte categorii corecte
                    const divPool = mappedQuestions.filter(q => (q.exam_type || '').includes('Diverse'));
                    const otherPool = mappedQuestions.filter(q => !(q.exam_type || '').includes('Diverse'));

                    const div_unseen = divPool.filter(q => lastStatus[q.id] === undefined);
                    const div_wrong = divPool.filter(q => lastStatus[q.id] === false);
                    const div_correct = divPool.filter(q => lastStatus[q.id] === true);

                    const other_unseen = otherPool.filter(q => lastStatus[q.id] === undefined);
                    const other_wrong = otherPool.filter(q => lastStatus[q.id] === false);
                    const other_correct = otherPool.filter(q => lastStatus[q.id] === true);

                    shuffle(div_unseen); shuffle(div_wrong); shuffle(div_correct);
                    shuffle(other_unseen); shuffle(other_wrong); shuffle(other_correct);

                    if (selectedQuestions.length < targetLength) {
                        selectedQuestions.push(...pickDiverseAware(div_unseen, targetLength - selectedQuestions.length));
                    }
                    if (selectedQuestions.length < targetLength) {
                        selectedQuestions.push(...pickDiverseAware(div_wrong, targetLength - selectedQuestions.length));
                    }
                    if (selectedQuestions.length < targetLength) {
                        selectedQuestions.push(...pickDiverseAware(other_unseen, targetLength - selectedQuestions.length));
                    }
                    if (selectedQuestions.length < targetLength) {
                        selectedQuestions.push(...pickDiverseAware(other_wrong, targetLength - selectedQuestions.length));
                    }
                    if (selectedQuestions.length < targetLength) {
                        selectedQuestions.push(...pickDiverseAware(div_correct, targetLength - selectedQuestions.length));
                    }
                    if (selectedQuestions.length < targetLength) {
                        selectedQuestions.push(...pickDiverseAware(other_correct, targetLength - selectedQuestions.length));
                    }
                } else {
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

                    shuffle(unseenQs); shuffle(wrongQs); shuffle(correctQs);

                    selectedQuestions.push(...pickDiverseAware(unseenQs, targetLength - selectedQuestions.length));
                    selectedQuestions.push(...pickDiverseAware(wrongQs, targetLength - selectedQuestions.length));
                    selectedQuestions.push(...pickDiverseAware(correctQs, targetLength - selectedQuestions.length));
                }
                
                shuffle(selectedQuestions);
            } else {
                // fallback if results fetch fails
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
