const fs = require('fs');
const path = require('path');

let rateLimitCache = {};
const RATE_LIMIT_MS = 60000;
const MAX_SUBMITS_PER_MIN = 5;

function getLiveEnv(key, fallback = '') {
    try {
        const envCandidates = [
            path.resolve(__dirname, '../../.env'),
            path.resolve(__dirname, '../.env'),
            path.resolve(process.cwd(), '.env')
        ];
        for (const p of envCandidates) {
            if (fs.existsSync(p)) {
                const content = fs.readFileSync(p, 'utf8');
                for (const line of content.split('\n')) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                        const idx = trimmed.indexOf('=');
                        const k = trimmed.slice(0, idx).trim();
                        const v = trimmed.slice(idx + 1).trim();
                        if (k === key) return v;
                    }
                }
            }
        }
    } catch (e) {}
    return process.env[key] || fallback;
}

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

    const ip = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    if (!rateLimitCache[ip]) {
        rateLimitCache[ip] = { count: 1, first: now };
    } else {
        if (now - rateLimitCache[ip].first > RATE_LIMIT_MS) {
            rateLimitCache[ip] = { count: 1, first: now };
        } else {
            rateLimitCache[ip].count++;
        }
    }

    if (rateLimitCache[ip].count > MAX_SUBMITS_PER_MIN) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'Prea multe teste trimise. Te rugăm să aștepți.' }) };
    }

    const supabaseUrl = getLiveEnv('SUPABASE_URL', process.env.SUPABASE_URL);
    const supabaseKey = getLiveEnv('SUPABASE_SERVICE_KEY', process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

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
    const jwtSecret = getLiveEnv('JWT_SECRET', process.env.JWT_SECRET);
    if (!jwtSecret) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configurare server incompletă (JWT_SECRET lipsă)' }) };
    }
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

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isAssigned = !!(test_type === 'tema' || (assigned_test_id && typeof assigned_test_id === 'string' && uuidRegex.test(assigned_test_id)));

        // Anti-cheat: prevent impossibly fast submissions only for timed live exams (initial, etc.)
        // Assigned homework tests (teme) are untimed and completed at the student's own pace.
        if (!isAssigned) {
            const minTimeAllowed = Math.max(2000, question_ids.length * 400);
            if (time_taken_ms < minTimeAllowed && answers_json.some(a => a !== null)) {
                // Only block if they actually answered something super fast. If they submitted an empty test, let it pass (they get 0).
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Timpul de rezolvare este nerealist de mic. Ești sigur că nu ești un bot? 🤖' })
                };
            }
        }

        if ((decoded.username || '').toLowerCase() !== (student_username || '').toLowerCase()) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Forbidden: Username mismatch cu token-ul de autentificare.' })
            };
        }

        const { isStudentSubscriptionActive } = require('./_utils.js');
        const isActive = await isStudentSubscriptionActive(supabaseUrl, supabaseKey, student_username);
        if (!isActive) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Abonamentul tău a expirat. Nu poți salva acest test.' })
            };
        }

        // Prevent duplicate submissions for assigned tests
        if (isAssigned && assigned_test_id) {
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
        let earnedXp = 0;
        const serverDetails = [];
        const difficultyStats = { easy: {c:0, t:0}, medium: {c:0, t:0}, hard: {c:0, t:0} };

        const finalExamType = exam_type || (test_type === 'initial' ? 'Initial' : 'Diverse');
        let finalTestType = 'initial';
        if (exam_type === 'Zilnic' || (test_type && test_type.toLowerCase().includes('zilnic'))) {
            finalTestType = 'intermediar:Zilnic';
        } else if (isAssigned || test_type === 'tema' || (test_type && test_type.startsWith('tema'))) {
            finalTestType = (finalExamType && finalExamType !== 'Initial') ? `tema:${finalExamType}` : 'tema';
        } else if (test_type === 'intermediar' || (test_type && test_type.startsWith('intermediar'))) {
            finalTestType = `intermediar:${finalExamType}`;
        } else {
            finalTestType = 'initial';
        }

        if (finalTestType === 'intermediar:Zilnic') {
            const checkUrl = `${supabaseUrl}/rest/v1/results?student_username=ilike.${encodeURIComponent(student_username)}&select=created_at,test_type`;
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
                        body: JSON.stringify({ error: 'Ai efectuat deja testul zilnic pentru astăzi!' })
                    };
                }
            }
        }
        const isIntermediate = finalTestType.startsWith('intermediar');

        for (let i = 0; i < question_ids.length; i++) {
            const qId = question_ids[i];
            const q = questionsMap[qId];
            if (!q) continue;

            const studentAns = answers_json[i];
            const isCorrect = (studentAns !== null && studentAns !== undefined && studentAns !== '') && (Number(studentAns) === Number(q.correct_index));
            
            const diff = (q.difficulty || 'easy').toLowerCase();
            if (!difficultyStats[diff]) {
                difficultyStats[diff] = { c: 0, t: 0 };
            }
            difficultyStats[diff].t += 1;
            
            if (isCorrect) {
                serverScore += ptsPerQuestion;
                difficultyStats[diff].c += 1;
                earnedXp += 10;
            }

            let opts = q.options_json;
            if (typeof opts === 'string') {
                try { opts = JSON.parse(opts); } catch(e) {}
            }

            serverDetails.push({
                number: i + 1,
                id: q.id,
                category: q.category || 'Diverse',
                subcategory: q.subcategory || null,
                exam_type: q.exam_type || finalExamType,
                difficulty: q.difficulty || 'medium',
                text: q.text,
                code: q.code || null,
                image_url: q.image_url || null,
                isCorrect: isCorrect,
                studentAnswer: studentAns,
                correctAnswer: q.correct_index,
                options: opts,
                hint: isIntermediate ? (q.hint || q.explanation || null) : null,
                assigned_test_id: isAssigned ? assigned_test_id : null
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

        // Get student gamification data & phone
        let studentPhone = '';
        let currentStreak = 0;
        let lastActive = null;
        let currentXp = 0;

        const stdRes = await fetch(`${supabaseUrl}/rest/v1/students?username=ilike.${encodeURIComponent(student_username)}&select=phone_number,current_streak,last_active_date,xp`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        
        if (stdRes.ok) {
            const stdData = await stdRes.json();
            if (stdData.length > 0) {
                studentPhone = stdData[0].phone_number || '';
                currentStreak = stdData[0].current_streak || 0;
                lastActive = stdData[0].last_active_date || null;
                currentXp = stdData[0].xp || 0;
            }
        }

        // Calculate Gamification Updates with Romanian timezone (Europe/Bucharest)
        const getBucharestDateStr = (dateObj) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(dateObj);
        const today = new Date();
        const todayStr = getBucharestDateStr(today);
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayStr = getBucharestDateStr(yesterday);

        let newStreak = currentStreak;
        if (lastActive === yesterdayStr) {
            newStreak += 1;
        } else if (lastActive === todayStr) {
            // Already active today, streak remains same
        } else {
            // Missed a day or first time
            newStreak = 1;
        }
        const newXp = currentXp + earnedXp;

        // Update Gamification in Supabase
        const patchRes = await fetch(`${supabaseUrl}/rest/v1/students?username=ilike.${encodeURIComponent(student_username)}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                current_streak: newStreak,
                last_active_date: todayStr,
                xp: newXp
            })
        });

        if (!patchRes.ok) {
            console.error('[save-result] Failed to update gamification data:', await patchRes.text());
        }

        // Trigger automatic email report delivery ONLY for introductory/initial test
        if (finalTestType === 'initial' || finalTestType.startsWith('initial')) {
            try {
                const emailHandler = require('./send-report-email.js').handler;
                await emailHandler({
                    httpMethod: 'POST',
                    headers: { 
                        origin: corsOrigin,
                        'x-internal-secret': getLiveEnv('INTERNAL_API_SECRET', process.env.INTERNAL_API_SECRET || '')
                    },
                    body: JSON.stringify({
                        student_name: student_username,
                        phone: studentPhone,
                        score: serverScore,
                        total_points: serverMaxPoints,
                        time_taken_ms: time_taken_ms,
                        blur_count: blur_count,
                        details: serverDetails,
                        stats: difficultyStats
                    })
                }, {});
                console.log(`[save-result] Email report dispatched successfully for initial test (${student_username})`);
            } catch (e) {
                console.error('[save-result] Error invoking send-report-email:', e);
            }
        }

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

        const clientDetails = serverDetails;

        // Return the evaluated details back to the client so they can show the results page
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ 
                success: true, 
                data: data,
                evaluatedDetails: clientDetails,
                score: serverScore,
                totalPoints: serverMaxPoints,
                stats: difficultyStats,
                gamification: {
                    xpEarned: earnedXp,
                    newTotalXp: newXp,
                    newStreak: newStreak
                }
            })
        };
    } catch (error) {
        console.error('Error saving result:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
