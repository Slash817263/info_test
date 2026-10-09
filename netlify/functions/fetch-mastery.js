const { getCorsHeaders, verifyAdminToken, parseJwt, getLiveEnv, createErrorResponse, fetchAllSupabaseRows } = require('./_utils');

exports.handler = async function(event, context) {
    const corsHeaders = getCorsHeaders(event);
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    const params = event.queryStringParameters || {};
    const username = params.username;
    if (!username) {
        return createErrorResponse(400, 'Lipsă parametru username', corsHeaders);
    }

    // Verify auth
    const isAdmin = verifyAdminToken(event);
    if (!isAdmin) {
        const decoded = parseJwt(event);
        if (!decoded || (decoded.username || '').toLowerCase() !== username.toLowerCase()) {
            return createErrorResponse(403, 'Neautorizat', corsHeaders);
        }
    }

    const supabaseUrl = getLiveEnv('SUPABASE_URL', process.env.SUPABASE_URL);
    const supabaseKey = getLiveEnv('SUPABASE_SERVICE_KEY', process.env.SUPABASE_SERVICE_KEY);

    if (!supabaseUrl || !supabaseKey) {
        return createErrorResponse(500, 'Eroare configurare Supabase', corsHeaders);
    }

    try {
        const encodedUsername = encodeURIComponent(username);
        const resUrl = `${supabaseUrl}/rest/v1/results?or=(student_username.ilike.${encodedUsername},student_name.ilike.${encodedUsername})&order=created_at.asc`;
        
        const pastResults = await fetchAllSupabaseRows(resUrl, supabaseKey);

        // Fetch all questions metadata with pagination
        const allQuestions = await fetchAllSupabaseRows(`${supabaseUrl}/rest/v1/questions?select=id,category,subcategory`, supabaseKey);
        const questionsMap = new Map();
        (allQuestions || []).forEach(q => {
            if (q && q.id !== undefined) questionsMap.set(Number(q.id), q);
        });

        // Compute mastery based on all questions encountered (Tests + Lucru Individual / category_coverage)
        const canonicalCategories = ['Fundamente', 'Organizarea Datelor', 'Subprograme', 'Backtracking', 'Grafuri si Arbori'];
        const mastery = {};
        canonicalCategories.forEach(cat => {
            mastery[cat] = { seen: 0, correct: 0, percentage: 0, subcategories: {} };
        });

        let lastActiveTimestamp = null;
        let lastScores = [];
        
        let hasDailyToday = false;
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' });
        const todayRomaniaStr = formatter.format(new Date()); // "YYYY-MM-DD"

        // Map tracking unique question status: qId -> { isCorrect: boolean, studentAnswer: any }
        const questionStatusMap = new Map();

        // 1. Process category_coverage row (Lucru Individual)
        const covRows = (pastResults || []).filter(r => r.test_type === 'category_coverage');
        covRows.forEach(covRow => {
            const masteredList = Array.isArray(covRow.details_json) ? covRow.details_json : [];
            masteredList.forEach(id => {
                const qId = Number(id);
                if (!isNaN(qId)) questionStatusMap.set(qId, { isCorrect: true, studentAnswer: null });
            });

            let pWrongs = covRow.answers_json;
            if (typeof pWrongs === 'string') {
                try { pWrongs = JSON.parse(pWrongs); } catch (e) { pWrongs = []; }
            }
            if (Array.isArray(pWrongs)) {
                pWrongs.forEach(item => {
                    if (item && (item.id !== undefined || item.question_id !== undefined)) {
                        const qId = Number(item.id !== undefined ? item.id : item.question_id);
                        if (!isNaN(qId) && (!questionStatusMap.has(qId) || !questionStatusMap.get(qId).isCorrect)) {
                            questionStatusMap.set(qId, { isCorrect: false, studentAnswer: item.studentAnswer });
                        }
                    }
                });
            } else if (pWrongs && typeof pWrongs === 'object') {
                Object.entries(pWrongs).forEach(([key, val]) => {
                    const qId = Number(key);
                    if (!isNaN(qId) && (!questionStatusMap.has(qId) || !questionStatusMap.get(qId).isCorrect)) {
                        questionStatusMap.set(qId, { isCorrect: false, studentAnswer: typeof val === 'object' && val !== null ? val.studentAnswer : val });
                    }
                });
            }
        });

        // 2. Process all regular tests
        pastResults.forEach(res => {
            // track last active
            const resDate = new Date(res.created_at);
            if (!lastActiveTimestamp || resDate > lastActiveTimestamp) {
                lastActiveTimestamp = resDate;
            }
            
            const resDateStr = formatter.format(resDate);
            const rawType = (res.test_type || '').toLowerCase();
            if (rawType.includes('zilnic') && resDateStr === todayRomaniaStr) {
                hasDailyToday = true;
            }

            if (res.test_type && (res.test_type.startsWith('progress_') || res.test_type === 'category_coverage' || res.test_type === 'lead_diagnostic')) {
                return;
            }

            lastScores.push(res.score || 0);

            const details = Array.isArray(res.details_json) 
                ? res.details_json 
                : (typeof res.details_json === 'string' ? JSON.parse(res.details_json || '[]') : []);

            details.forEach(d => {
                if (!d) return;
                const qId = Number(d.id !== undefined ? d.id : d.number);
                if (isNaN(qId)) return;

                const isCor = !!(d.isCorrect === true || d.is_correct === true || d.correct === true || (d.studentAnswer !== null && d.studentAnswer !== undefined && d.correctAnswer !== undefined && d.studentAnswer === d.correctAnswer));
                
                const prev = questionStatusMap.get(qId);
                if (isCor) {
                    questionStatusMap.set(qId, { isCorrect: true, studentAnswer: d.studentAnswer });
                } else {
                    if (!prev || !prev.isCorrect) {
                        questionStatusMap.set(qId, { isCorrect: false, studentAnswer: d.studentAnswer });
                    }
                }
            });
        });

        // 3. Aggregate unique questions into mastery
        questionStatusMap.forEach((status, qId) => {
            const qInfo = questionsMap.get(qId);
            const cat = (qInfo ? qInfo.category : '').trim();
            if (!cat || !mastery[cat]) return;

            mastery[cat].seen += 1;
            if (status.isCorrect) mastery[cat].correct += 1;

            const sub = (qInfo ? qInfo.subcategory : '').trim();
            if (sub) {
                if (!mastery[cat].subcategories[sub]) {
                    mastery[cat].subcategories[sub] = { seen: 0, correct: 0, percentage: 0 };
                }
                mastery[cat].subcategories[sub].seen += 1;
                if (status.isCorrect) mastery[cat].subcategories[sub].correct += 1;
            }
        });

        // Compute percentages (număr de răspunsuri corecte din totalul de întrebări la care userul a răspuns din acea categorie)
        for (const cat in mastery) {
            mastery[cat].percentage = mastery[cat].seen > 0 
                ? Math.round((mastery[cat].correct / mastery[cat].seen) * 100) 
                : 0;
            
            for (const sub in mastery[cat].subcategories) {
                const subObj = mastery[cat].subcategories[sub];
                subObj.percentage = subObj.seen > 0 
                    ? Math.round((subObj.correct / subObj.seen) * 100) 
                    : 0;
            }
        }

        const daysSinceActive = lastActiveTimestamp 
            ? Math.floor((new Date() - lastActiveTimestamp) / (1000 * 60 * 60 * 24))
            : -1;

        const avgRecentScore = lastScores.slice(-2).reduce((a, b) => a + b, 0) / (Math.min(lastScores.length, 2) || 1);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                username,
                mastery,
                lastActiveTimestamp,
                daysSinceActive,
                avgRecentScore,
                totalTests: pastResults.length,
                hasDailyToday
            })
        };
    } catch (e) {
        return createErrorResponse(500, 'Eroare la calcularea profilului', corsHeaders, e);
    }
};
