const fs = require('fs');
const utils = require('../netlify/functions/_utils.js');

async function applyPerfections() {
    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL');
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY') || utils.getLiveEnv('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials missing.');
    }

    const oldQs = JSON.parse(fs.readFileSync('waiting_questions_from_db.json', 'utf8'));
    const newQs = JSON.parse(fs.readFileSync('waiting_questions_perfected.json', 'utf8'));

    const updates = [];
    for (let i = 0; i < newQs.length; i++) {
        const nq = newQs[i];
        const oq = oldQs.find(x => x.id === nq.id) || oldQs[i];

        const textChanged = nq.text !== oq.text;
        const codeChanged = nq.code !== oq.code;
        const typeChanged = nq.type !== oq.type;
        const optsChanged = JSON.stringify(nq.options_json) !== JSON.stringify(oq.options_json);
        const examChanged = nq.exam_type !== oq.exam_type;

        if (textChanged || codeChanged || typeChanged || optsChanged || examChanged) {
            updates.push({
                id: nq.id,
                payload: {
                    text: nq.text,
                    code: nq.code,
                    type: nq.type,
                    options_json: nq.options_json,
                    exam_type: nq.exam_type
                }
            });
        }
    }

    console.log(`Found ${updates.length} questions to update in waiting_questions.`);

    let successCount = 0;
    // Update concurrently in batches of 10
    const concurrency = 10;
    for (let i = 0; i < updates.length; i += concurrency) {
        const chunk = updates.slice(i, i + concurrency);
        await Promise.all(chunk.map(async item => {
            try {
                const res = await fetch(`${supabaseUrl}/rest/v1/waiting_questions?id=eq.${item.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(item.payload)
                });
                if (res.ok) {
                    successCount++;
                } else {
                    console.error(`Failed to update ID ${item.id}:`, await res.text());
                }
            } catch (err) {
                console.error(`Error updating ID ${item.id}:`, err);
            }
        }));
        process.stdout.write(`Updated ${Math.min(i + concurrency, updates.length)} / ${updates.length}...\r`);
    }

    console.log(`\nSuccessfully updated ${successCount} / ${updates.length} questions.`);
}

applyPerfections().catch(console.error);
