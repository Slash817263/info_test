const fs = require('fs');
const utils = require('../netlify/functions/_utils.js');

async function syncAll() {
    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL');
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY') || utils.getLiveEnv('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials missing.');
    }

    const masterQs = JSON.parse(fs.readFileSync('waiting_questions_master_perfected.json', 'utf8'));
    console.log('Total questions in master:', masterQs.length);

    // Fetch all current waiting_questions from Supabase (handling 1000 limit)
    const res = await fetch(`${supabaseUrl}/rest/v1/waiting_questions?select=*&limit=1000`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    if (!res.ok) {
        throw new Error('Failed to fetch waiting_questions: ' + res.statusText);
    }

    const dbQs = await res.json();
    console.log('Fetched from DB:', dbQs.length);

    const dbMap = new Map();
    dbQs.forEach(q => dbMap.set(q.id, q));

    const updates = [];
    for (const mq of masterQs) {
        const dq = dbMap.get(mq.id);
        if (!dq) {
            console.log('Question missing in DB, needs insert:', mq.id);
            continue;
        }

        const payload = {};
        if (mq.text !== dq.text) payload.text = mq.text;
        if (mq.code !== dq.code) payload.code = mq.code;
        if (mq.category !== dq.category) payload.category = mq.category;
        if (mq.subcategory !== dq.subcategory) payload.subcategory = mq.subcategory;
        if (mq.difficulty !== dq.difficulty) payload.difficulty = mq.difficulty;
        if (mq.type !== dq.type) payload.type = mq.type;
        if (mq.correct_index !== dq.correct_index) payload.correct_index = mq.correct_index;
        if (JSON.stringify(mq.options_json) !== JSON.stringify(dq.options_json)) payload.options_json = mq.options_json;
        if (mq.exam_type !== dq.exam_type) payload.exam_type = mq.exam_type;
        if (mq.hint && mq.hint !== dq.hint) payload.hint = mq.hint;

        if (Object.keys(payload).length > 0) {
            updates.push({ id: mq.id, payload });
        }
    }

    console.log(`Questions with updates: ${updates.length}`);
    let success = 0;
    const concurrency = 15;
    for (let i = 0; i < updates.length; i += concurrency) {
        const batch = updates.slice(i, i + concurrency);
        await Promise.all(batch.map(async item => {
            try {
                const patchRes = await fetch(`${supabaseUrl}/rest/v1/waiting_questions?id=eq.${item.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(item.payload)
                });
                if (patchRes.ok) success++;
                else console.error(`Failed ID ${item.id}:`, await patchRes.text());
            } catch (e) {
                console.error(`Error ID ${item.id}:`, e.message);
            }
        }));
    }

    console.log(`Successfully updated ${success} / ${updates.length} questions in Supabase waiting_questions!`);
}

syncAll().catch(console.error);
