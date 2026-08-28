const utils = require('./_utils');

exports.handler = async function(event, context) {
    const headers = utils.getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return utils.createErrorResponse(405, 'Method Not Allowed', headers);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return utils.createErrorResponse(500, 'Supabase env variables missing', headers);
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { username } = body;
        const cleanUsername = (username || '').trim().toLowerCase();
        if (!cleanUsername) {
            return utils.createErrorResponse(400, 'Username is required', headers);
        }

        const decoded = utils.parseJwt(event);
        if (!decoded) {
            return utils.createErrorResponse(401, 'Token invalid sau lipsa', headers);
        }
        
        if ((decoded.username || '').toLowerCase() !== cleanUsername) {
            return utils.createErrorResponse(401, 'Token mismatch cu username', headers);
        }

        const safeUsername = cleanUsername.replace(/[%_]/g, '\\$&');
        const encodedUsername = encodeURIComponent(cleanUsername);
        
        // Verificam hash-ul parolei si statusul abonamentului (expires_at) + date gamificare
        let stdUrl = `${supabaseUrl}/rest/v1/students?username=ilike.${encodeURIComponent(safeUsername)}&select=password,phone_number,expires_at,current_streak,last_active_date,xp`;
        let stdRes = await fetch(stdUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
        if (!stdRes.ok) {
            // Fallback for schemas missing newer columns
            stdUrl = `${supabaseUrl}/rest/v1/students?username=ilike.${encodeURIComponent(safeUsername)}&select=password,phone_number,expires_at,xp`;
            stdRes = await fetch(stdUrl, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (!stdRes.ok) {
                // Final fallback WITH expires_at
                stdUrl = `${supabaseUrl}/rest/v1/students?username=ilike.${encodeURIComponent(safeUsername)}&select=password,phone_number,expires_at`;
                stdRes = await fetch(stdUrl, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (!stdRes.ok) {
                    // Ultimate fallback WITHOUT expires_at (if column doesn't exist)
                    stdUrl = `${supabaseUrl}/rest/v1/students?username=ilike.${encodeURIComponent(safeUsername)}&select=password,phone_number`;
                    stdRes = await fetch(stdUrl, {
                        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                    });
                }
            }
        }

        let phoneNumber = null;
        let expiresAt = null;
        let isExpired = false;
        let currentStreak = 0;
        let lastActiveDate = null;
        let xp = 0;

        if (stdRes.ok) {
            const stdData = await stdRes.json();
            if (stdData.length > 0) {
                const currentHashPrefix = (stdData[0].password || '').substring(0, 15);
                if (currentHashPrefix !== decoded.hashPrefix) {
                    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Parola a fost modificata. Va rugam sa va relogati.' }) };
                }
                phoneNumber = stdData[0].phone_number;
                expiresAt = stdData[0].expires_at || null;
                currentStreak = stdData[0].current_streak || 0;
                lastActiveDate = stdData[0].last_active_date || null;
                xp = stdData[0].xp || 0;

                if (expiresAt) {
                    let expDate;
                    if (expiresAt.includes('/')) {
                        const parts = expiresAt.split('/');
                        if (parts.length === 3) {
                            expDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
                        } else {
                            expDate = new Date(expiresAt);
                        }
                    } else {
                        expDate = new Date(expiresAt);
                    }
                    
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    if (!isNaN(expDate.getTime())) {
                        expDate.setHours(0, 0, 0, 0);
                        if (expDate < today) {
                            isExpired = true;
                        }
                    }
                }
            } else {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Utilizatorul nu mai exista' }) };
            }
        }

        // Query results for this student (lightweight metadata)
        const url = `${supabaseUrl}/rest/v1/results?or=(student_username.ilike.${encodeURIComponent(safeUsername)},student_name.ilike.${encodeURIComponent(safeUsername)})&select=id,student_name,test_type,score,total_points,created_at&order=created_at.desc`;
        const response = await fetch(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        const data = response.ok ? await response.json() : [];
        const finalData = data.filter(d => !d.test_type || !d.test_type.startsWith('progress_')); // excludem salvari partiale

        const hasCompletedInitial = finalData.some(d => {
            if (!d.test_type) return false;
            const t = d.test_type.toLowerCase().trim();
            if (t === 'category_coverage' || t === 'lead_diagnostic' || t.startsWith('progress_')) return false;
            return t === 'initial' || t.startsWith('initial');
        });

        const studentDisplayName = (finalData.length > 0 && finalData[0].student_name) ? finalData[0].student_name : cleanUsername;

        // Calculate Grade (0-10) based on average score
        let grade = 0;
        if (finalData.length > 0) {
            let totalScore = 0;
            finalData.forEach(d => { totalScore += (d.score || 0); });
            grade = (totalScore / finalData.length) / 10;
        }

        // Calculate Effective Streak (Europe/Bucharest timezone)
        let effectiveStreak = currentStreak;
        if (lastActiveDate) {
            const getBucharestDateStr = (dateObj) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(dateObj);
            const today = new Date();
            const todayStr = getBucharestDateStr(today);
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            const yesterdayStr = getBucharestDateStr(yesterday);
            
            if (lastActiveDate !== todayStr && lastActiveDate !== yesterdayStr) {
                effectiveStreak = 0;
            }
        }

        // Calculate Leaderboard Percentile (approximate for now based on a random factor or real query if we want)
        // Since we don't have all users fetched, we will do a quick count query for percentile
        let percentile = 15; // default
        try {
            const countUrl = `${supabaseUrl}/rest/v1/students?select=id&xp=gt.${xp}`;
            const countRes = await fetch(countUrl, {
                method: 'HEAD',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Prefer': 'count=exact' }
            });
            const allUrl = `${supabaseUrl}/rest/v1/students?select=id`;
            const allRes = await fetch(allUrl, {
                method: 'HEAD',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Prefer': 'count=exact' }
            });
            
            const betterCount = parseInt(countRes.headers.get('content-range')?.split('/')[1] || countRes.headers.get('content-range')?.split('-')[1]?.split('/')[0] || 0);
            const totalCount = parseInt(allRes.headers.get('content-range')?.split('/')[1] || 100);
            
            if (totalCount > 0) {
                const perc = (betterCount / totalCount) * 100;
                percentile = Math.max(1, Math.round(perc));
            }
        } catch(e) { console.error('Percentile error', e); }

        // Calculate Daily Test Completion Today (Europe/Bucharest timezone)
        const todayBucharestStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date());
        const hasDailyToday = finalData.some(d => {
            if (!d.test_type || !d.created_at) return false;
            const t = d.test_type.toLowerCase();
            const dDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date(d.created_at));
            return t.includes('zilnic') && dDate === todayBucharestStr;
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                exists: true,
                is_expired: isExpired,
                expires_at: expiresAt,
                name: studentDisplayName,
                phone_number: phoneNumber,
                hasCompletedInitial: hasCompletedInitial,
                hasDailyToday: hasDailyToday,
                gamification: {
                    xp: xp,
                    streak: effectiveStreak,
                    grade: grade.toFixed(2),
                    percentile: percentile
                },
                history: finalData.slice(0, 10).map(d => ({
                    test_type: d.test_type,
                    score: d.score,
                    total_points: d.total_points,
                    created_at: d.created_at
                }))
            })
        };
    } catch (error) {
        console.error('check-user error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
