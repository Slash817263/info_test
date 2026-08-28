const fs = require('fs');
const path = require('path');

let rateLimitCache = {};
const RATE_LIMIT_MS = 60000;
const MAX_REQUESTS_PER_MIN = 10;

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
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
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

    if (rateLimitCache[ip].count > MAX_REQUESTS_PER_MIN) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'Ai trimis prea multe cereri. Te rugăm să aștepți un minut.' }) };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const supabaseUrl = getLiveEnv('SUPABASE_URL', process.env.SUPABASE_URL);
    const supabaseKey = getLiveEnv('SUPABASE_SERVICE_KEY', process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase credentials missing.' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const {
            first_name,
            last_name,
            phone,
            time_taken_ms,
            blur_count,
            answers_json,
            question_ids
        } = body;

        // Validation
        const cleanFirst = (first_name || '').trim();
        const cleanLast = (last_name || '').trim();
        const fullName = `${cleanFirst} ${cleanLast}`.trim();
        let cleanPhone = (phone || '').trim().replace(/\s+/g, '').replace(/[-().]/g, '');

        if (!cleanFirst || !cleanLast) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Vă rugăm să introduceți atât numele, cât și prenumele.' })
            };
        }

        if (!cleanPhone || cleanPhone.length < 8) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Vă rugăm să introduceți un număr de telefon WhatsApp valid.' })
            };
        }

        // Normalize phone number to 07...
        if (cleanPhone.startsWith('+40')) {
            cleanPhone = '0' + cleanPhone.substring(3);
        } else if (cleanPhone.startsWith('40') && cleanPhone.length === 11) {
            cleanPhone = '0' + cleanPhone.substring(2);
        } else if (cleanPhone.startsWith('7') && cleanPhone.length === 9) {
            cleanPhone = '0' + cleanPhone;
        }

        if (!Array.isArray(answers_json) || !Array.isArray(question_ids) || answers_json.length !== question_ids.length) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Payload de răspunsuri invalid.' })
            };
        }

        // Fetch questions from Supabase for server-side grading
        const idsParam = question_ids.join(',');
        const qRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=in.(${idsParam})&select=id,text,code,options_json,correct_index,difficulty,category,subcategory,image_url,hint`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });

        if (!qRes.ok) {
            throw new Error(`Failed to fetch questions for evaluation: ${await qRes.text()}`);
        }

        const questionsDb = await qRes.json();
        const qMap = new Map();
        questionsDb.forEach(q => qMap.set(Number(q.id), q));

        let score = 0;
        let totalPoints = 100;
        const ptsPerQuestion = 10 / 3;
        const stats = {
            easy: { c: 0, t: 0 },
            medium: { c: 0, t: 0 },
            hard: { c: 0, t: 0 }
        };

        const evaluatedDetails = question_ids.map((qid, idx) => {
            const q = qMap.get(Number(qid));
            if (!q) return null;

            let opts = q.options_json;
            if (typeof opts === 'string') {
                try { opts = JSON.parse(opts); } catch (e) { opts = []; }
            }

            const studentAns = answers_json[idx];
            const isCorrect = (studentAns !== null && studentAns !== undefined && studentAns !== '') && (Number(studentAns) === Number(q.correct_index));
            const diff = (q.difficulty || 'medium').toLowerCase();

            if (stats[diff]) stats[diff].t += 1;

            if (isCorrect) {
                score += ptsPerQuestion;
                if (stats[diff]) stats[diff].c += 1;
            }

            return {
                number: idx + 1,
                id: q.id,
                text: q.text,
                code: q.code,
                options: opts,
                studentAnswer: studentAns,
                correctAnswer: q.correct_index,
                isCorrect: isCorrect,
                difficulty: diff,
                category: q.category,
                subcategory: q.subcategory,
                image_url: q.image_url,
                hint: q.hint
            };
        }).filter(Boolean);

        score = Math.round(score);
        const timeNum = Number(time_taken_ms) || 0;
        const blurNum = Number(blur_count) || 0;

        // Save into results table as a lead_diagnostic record
        const insertRes = await fetch(`${supabaseUrl}/rest/v1/results`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                student_name: fullName,
                student_username: cleanPhone,
                test_type: 'lead_diagnostic',
                score: score,
                total_points: totalPoints,
                time_taken_ms: timeNum,
                blur_count: blurNum,
                answers_json: answers_json,
                details_json: evaluatedDetails
            })
        });

        if (!insertRes.ok) {
            const errText = await insertRes.text();
            throw new Error(`Failed to save lead: ${errText}`);
        }

        const savedData = await insertRes.json();
        const leadRecord = savedData && savedData[0];

        // Trigger automatic email report delivery
        try {
            const emailHandler = require('./send-report-email.js').handler;
            await emailHandler({
                httpMethod: 'POST',
                headers: { 
                    origin: corsOrigin,
                    'x-internal-secret': getLiveEnv('INTERNAL_API_SECRET', process.env.INTERNAL_API_SECRET || '')
                },
                body: JSON.stringify({
                    student_name: fullName,
                    phone: cleanPhone,
                    score: score,
                    total_points: totalPoints,
                    time_taken_ms: timeNum,
                    blur_count: blurNum,
                    details: evaluatedDetails,
                    stats: stats
                })
            }, {});
            console.log(`[submit-lead] Email report dispatched successfully for ${fullName}`);
        } catch (e) {
            console.error('[submit-lead] Error invoking send-report-email:', e);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Rezultatul a fost salvat cu succes!',
                lead_id: leadRecord ? leadRecord.id : null,
                student_name: fullName,
                phone: cleanPhone,
                score: score,
                totalPoints: totalPoints,
                stats: stats,
                evaluatedDetails: evaluatedDetails
            })
        };

    } catch (err) {
        console.error('submit-lead error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Eroare internă la salvarea lead-ului.' })
        };
    }
};
