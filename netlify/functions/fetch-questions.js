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
        const clientToken = (event.headers && (event.headers['x-admin-token'] || event.headers['X-Admin-Token'])) || '';
        const isAdmin = queryParams.admin === 'true' && clientToken && validTokens.includes(clientToken);

        const testType = queryParams.type || 'initial';
        const examType = queryParams.examType || 'Initial';
        const username = queryParams.username || '';
        const idsParam = queryParams.ids || '';

        if (!isAdmin && username) {
            const authHeader = event.headers.authorization || event.headers.Authorization || '';
            if (!authHeader.startsWith('Bearer ')) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Lipsă token autentificare' }) };
            }
            const token = authHeader.substring(7);
            const jwt = require('jsonwebtoken');
            const utils = require('./_utils');
            const jwtSecret = utils.getLiveEnv('JWT_SECRET', process.env.JWT_SECRET);
            if (!jwtSecret) {
                return { statusCode: 500, headers, body: JSON.stringify({ error: 'Eroare server: JWT_SECRET lipsă.' }) };
            }
            
            try {
                const decoded = jwt.verify(token, jwtSecret);
                if (decoded.username.toLowerCase() !== username.toLowerCase()) {
                    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden: Token invalid pentru acest utilizator' }) };
                }
            } catch (err) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Token expirat sau invalid' }) };
            }

            const { isStudentSubscriptionActive } = require('./_utils.js');
            const isActive = await isStudentSubscriptionActive(supabaseUrl, supabaseKey, username);
            if (!isActive) {
                return {
                    statusCode: 403,
                    headers,
                    body: JSON.stringify({ error: 'Abonamentul tău a expirat. Nu poți accesa întrebări.' })
                };
            }

            if (examType === 'Zilnic' && !idsParam) {
                const checkUrl = `${supabaseUrl}/rest/v1/results?student_username=ilike.${encodeURIComponent(username)}&select=created_at,test_type`;
                const checkRes = await fetch(checkUrl, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (checkRes.ok) {
                    const existing = await checkRes.json();
                    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' });
                    const todayStr = formatter.format(new Date());
                    const alreadyDone = existing.some(e => {
                        if (!e.created_at || !e.test_type) return false;
                        const t = e.test_type.toLowerCase();
                        return t.includes('zilnic') && formatter.format(new Date(e.created_at)) === todayStr;
                    });
                    if (alreadyDone) {
                        return {
                            statusCode: 400,
                            headers,
                            body: JSON.stringify({ error: 'Ai susținut deja testul zilnic de astăzi! Revino mâine pentru un nou test.' })
                        };
                    }
                }
            }
        }

        // Optimization 1: Counts query - only fetch id & exam_type
        if (testType === 'counts') {
            const countsResponse = await fetch(`${supabaseUrl}/rest/v1/questions?select=id,exam_type&limit=50000`, {
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
        let queryUrl = `${supabaseUrl}/rest/v1/questions?select=*&order=id.asc&limit=50000`;
        if (!isAdmin) {
            if (idsParam) {
                const requestedIds = idsParam.split(',').map(id => id.trim()).filter(Boolean);
                if (requestedIds.length > 0) {
                    queryUrl += `&id=in.(${requestedIds.join(',')})`;
                }
            } else if (examType !== 'Diverse' && examType !== 'Zilnic') {
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
            if (examType === 'Diverse' || examType === 'Zilnic') {
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
            const encodedUsername = encodeURIComponent(username);
            const resUrl = `${supabaseUrl}/rest/v1/results?or=(student_username.ilike.${encodedUsername},student_name.ilike.${encodedUsername})&order=created_at.asc`;
            const resultsResponse = await fetch(resUrl, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });

            let targetLength = 10;
            let categoryQuotas = {
                'Fundamente': 2,
                'Organizarea Datelor': 3,
                'Subprograme': 2,
                'Backtracking': 1,
                'Grafuri si Arbori': 2
            };

            if (examType === 'Academie') {
                targetLength = 9;
                categoryQuotas['Grafuri si Arbori'] = 1;
            }

            const questionHistory = {};
            const catStats = { 'Fundamente': { t:0, c:0 }, 'Organizarea Datelor': { t:0, c:0 }, 'Subprograme': { t:0, c:0 }, 'Backtracking': { t:0, c:0 }, 'Grafuri si Arbori': { t:0, c:0 } };
            let totalT = 0, totalC = 0;
            let lastTestWrongCats = [];
            
            if (resultsResponse.ok) {
                const pastResults = await resultsResponse.json();
                pastResults.forEach((res, testIdx) => {
                    if (res.test_type && res.test_type.startsWith('progress_')) return;
                    if (res.test_type === 'category_coverage') return;
                    
                    const details = res.details_json || [];
                    const isLastTest = (testIdx === pastResults.length - 1);
                    
                    details.forEach(d => {
                        if (d && d.id !== undefined) {
                            questionHistory[Number(d.id)] = {
                                isCorrect: !!d.isCorrect,
                                lastSeenIndex: testIdx
                            };
                            if (d.category && catStats[d.category]) {
                                catStats[d.category].t++;
                                totalT++;
                                if (d.isCorrect) {
                                    catStats[d.category].c++;
                                    totalC++;
                                } else if (isLastTest) {
                                    lastTestWrongCats.push(d.category);
                                }
                            }
                        }
                    });
                });
            }

            if (examType === 'Diverse' || examType === 'Zilnic') {
                const overallAcc = totalT > 0 ? (totalC / totalT) : 0;
                
                const catAcc = Object.keys(catStats).map(cat => ({
                    cat, 
                    acc: catStats[cat].t > 0 ? (catStats[cat].c / catStats[cat].t) : 0.5,
                    count: catStats[cat].t
                })).sort((a,b) => b.acc - a.acc); 
                
                for (let weakCat of lastTestWrongCats) {
                    if (categoryQuotas[weakCat]) {
                        const strong = catAcc.find(c => c.cat !== weakCat && categoryQuotas[c.cat] > 1);
                        if (strong) {
                            categoryQuotas[strong.cat]--;
                            categoryQuotas[weakCat]++;
                        }
                    }
                }
                
                // Conform cerinței: dacă scorul e sub 70%, primește doar ușor-mediu (fără greu)
                if (overallAcc < 0.70) {
                    mappedQuestions = mappedQuestions.filter(q => (q.difficulty || 'usor').toLowerCase() !== 'greu' && (q.difficulty || 'easy').toLowerCase() !== 'hard');
                } else if (overallAcc > 0.85) {
                    mappedQuestions = mappedQuestions.filter(q => (q.difficulty || 'mediu').toLowerCase() !== 'usor' && (q.difficulty || 'medium').toLowerCase() !== 'easy');
                }
            }

            function pickCategoryQuestions(catPool, count, useSubcats) {
                if (!catPool || catPool.length === 0 || count <= 0) return [];
                const picked = [];
                
                if (useSubcats) {
                    const subcatGroups = {};
                    catPool.forEach(q => {
                        const sub = q.subcategory || 'Alta';
                        if (!subcatGroups[sub]) subcatGroups[sub] = [];
                        subcatGroups[sub].push(q);
                    });
                    
                    let subcats = Object.keys(subcatGroups);
                    let i = 0;
                    while (picked.length < count && subcats.length > 0) {
                        const sub = subcats[i % subcats.length];
                        const pool = subcatGroups[sub];
                        
                        const unseen = [], wrong = [], correct = [];
                        pool.forEach(q => {
                            const h = questionHistory[Number(q.id)];
                            if (!h) unseen.push(q);
                            else if (!h.isCorrect) wrong.push(q);
                            else correct.push({q, idx: h.lastSeenIndex});
                        });
                        
                        shuffle(unseen); shuffle(wrong);
                        correct.sort((a,b) => a.idx - b.idx);
                        
                        let p = unseen.pop() || wrong.pop() || (correct.length ? correct.shift().q : null);
                        
                        if (p) {
                            picked.push(p);
                            subcatGroups[sub] = pool.filter(x => x.id !== p.id);
                            i++;
                        } else {
                            subcats.splice(i % subcats.length, 1);
                        }
                    }
                } else {
                    const unseen = [], wrong = [], correct = [];
                    catPool.forEach(q => {
                        const h = questionHistory[Number(q.id)];
                        if (!h) unseen.push(q);
                        else if (!h.isCorrect) wrong.push(q);
                        else correct.push({q, idx: h.lastSeenIndex});
                    });
                    shuffle(unseen); shuffle(wrong);
                    correct.sort((a,b) => a.idx - b.idx);
                    while (picked.length < count && unseen.length > 0) picked.push(unseen.pop());
                    while (picked.length < count && wrong.length > 0) picked.push(wrong.pop());
                    while (picked.length < count && correct.length > 0) picked.push(correct.shift().q);
                }
                
                return picked;
            }

            const chosenQuestions = [];
            const pickedIds = new Set();
            const useSubcats = (examType !== 'Diverse');

            for (const [catName, quota] of Object.entries(categoryQuotas)) {
                const catPool = mappedQuestions.filter(q => q.category === catName && !pickedIds.has(Number(q.id)));
                const catPicked = pickCategoryQuestions(catPool, quota, useSubcats);
                catPicked.forEach(q => {
                    chosenQuestions.push(q);
                    pickedIds.add(Number(q.id));
                });
            }

            if (chosenQuestions.length < targetLength) {
                const remainingPool = mappedQuestions.filter(q => !pickedIds.has(Number(q.id)));
                const extraNeeded = targetLength - chosenQuestions.length;
                const extraPicked = pickCategoryQuestions(remainingPool, extraNeeded, false);
                extraPicked.forEach(q => {
                    chosenQuestions.push(q);
                    pickedIds.add(Number(q.id));
                });
            }

            shuffle(chosenQuestions);
            selectedQuestions = chosenQuestions.slice(0, targetLength);
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
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
