const { getCorsHeaders, verifyAdminToken, parseJwt, getLiveEnv, createErrorResponse } = require('./_utils');

exports.handler = async function(event, context) {
    const corsHeaders = getCorsHeaders(event);
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    const username = event.queryStringParameters.username;
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
        
        const response = await fetch(resUrl, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Supabase request failed: ${response.status}`);
        }

        const pastResults = await response.json();

        // Fetch questions metadata to backfill any results missing category/subcategory
        const qUrl = `${supabaseUrl}/rest/v1/questions?select=id,category,subcategory`;
        const qResponse = await fetch(qUrl, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const allQuestions = qResponse.ok ? await qResponse.json() : [];
        const questionsMap = new Map();
        (allQuestions || []).forEach(q => {
            if (q && q.id !== undefined) questionsMap.set(Number(q.id), q);
        });

        // Compute mastery
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

            if (res.test_type && (res.test_type.startsWith('progress_') || res.test_type === 'category_coverage')) {
                return;
            }

            lastScores.push(res.score || 0);

            const details = Array.isArray(res.details_json) 
                ? res.details_json 
                : (typeof res.details_json === 'string' ? JSON.parse(res.details_json || '[]') : []);

            details.forEach(d => {
                if (!d) return;
                const qId = Number(d.id !== undefined ? d.id : d.number);
                const qInfo = !isNaN(qId) ? questionsMap.get(qId) : null;
                const cat = (d.category || (qInfo ? qInfo.category : null) || '').trim();
                if (!cat) return;

                // User must have answered this question
                const hasAnswered = (d.studentAnswer !== null && d.studentAnswer !== undefined) || d.isCorrect !== undefined || d.is_correct !== undefined;
                if (!hasAnswered) return;

                if (!mastery[cat]) {
                    mastery[cat] = { seen: 0, correct: 0, percentage: 0, subcategories: {} };
                }
                mastery[cat].seen += 1;

                const isCor = !!(d.isCorrect === true || d.is_correct === true || d.correct === true || (d.studentAnswer !== null && d.studentAnswer !== undefined && d.correctAnswer !== undefined && d.studentAnswer === d.correctAnswer));
                if (isCor) mastery[cat].correct += 1;

                const sub = (d.subcategory || (qInfo ? qInfo.subcategory : null) || '').trim();
                if (sub) {
                    if (!mastery[cat].subcategories[sub]) {
                        mastery[cat].subcategories[sub] = { seen: 0, correct: 0, percentage: 0 };
                    }
                    mastery[cat].subcategories[sub].seen += 1;
                    if (isCor) mastery[cat].subcategories[sub].correct += 1;
                }
            });
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
