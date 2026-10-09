/**
 * Applies the 646 targeted updates directly to Supabase REST API safely.
 * Only updates fields that have changed.
 * Runs in controlled concurrent batches with error tracking.
 */

const fs = require('fs');
const path = require('path');
const utils = require('../netlify/functions/_utils.js');

async function applyPatch(dryRun = false) {
    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL');
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY') || utils.getLiveEnv('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase environment variables are missing.');
    }

    const backupPath = path.resolve(__dirname, '../supabase_questions_backup.json');
    const auditedPath = path.resolve(__dirname, '../supabase_questions_audited.json');

    const backupQuestions = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const auditedQuestions = JSON.parse(fs.readFileSync(auditedPath, 'utf8'));

    const auditedMap = new Map();
    auditedQuestions.forEach(q => auditedMap.set(q.id, q));

    const diffList = [];

    backupQuestions.forEach(oldQ => {
        const newQ = auditedMap.get(oldQ.id);
        if (!newQ) return;

        const updatePayload = {};
        if (oldQ.difficulty !== newQ.difficulty) updatePayload.difficulty = newQ.difficulty;
        if (oldQ.category !== newQ.category) updatePayload.category = newQ.category;
        if (oldQ.subcategory !== newQ.subcategory) updatePayload.subcategory = newQ.subcategory;
        if (oldQ.code !== newQ.code) updatePayload.code = newQ.code;
        if ((oldQ.hint || '') !== (newQ.hint || '')) updatePayload.hint = newQ.hint;
        if (oldQ.correct_index !== newQ.correct_index) updatePayload.correct_index = newQ.correct_index;
        if (JSON.stringify(oldQ.options_json) !== JSON.stringify(newQ.options_json)) {
            updatePayload.options_json = newQ.options_json;
        }

        if (Object.keys(updatePayload).length > 0) {
            diffList.push({ id: oldQ.id, payload: updatePayload });
        }
    });

    console.log(`Found ${diffList.length} questions requiring update.`);

    if (dryRun) {
        console.log('DRY RUN complete. No changes made to Supabase.');
        return;
    }

    console.log(`Starting live update of ${diffList.length} questions to Supabase...`);

    const batchSize = 10;
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (let i = 0; i < diffList.length; i += batchSize) {
        const chunk = diffList.slice(i, i + batchSize);
        await Promise.all(chunk.map(async item => {
            try {
                const url = `${supabaseUrl}/rest/v1/questions?id=eq.${item.id}`;
                const res = await fetch(url, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(item.payload)
                });

                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`HTTP ${res.status}: ${errText}`);
                }
                successCount++;
            } catch (err) {
                failCount++;
                errors.push({ id: item.id, error: err.message });
            }
        }));

        if ((i + batchSize) % 50 === 0 || i + batchSize >= diffList.length) {
            console.log(`Progress: ${Math.min(i + batchSize, diffList.length)}/${diffList.length} questions processed... (Success: ${successCount}, Fails: ${failCount})`);
        }
    }

    console.log('--- LIVE UPDATE EXECUTION SUMMARY ---');
    console.log(`Total questions targeted: ${diffList.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Failures: ${failCount}`);

    if (errors.length > 0) {
        console.error('Errors encountered:', errors);
    } else {
        console.log('ALL QUESTIONS UPDATED SUCCESSFULLY WITH ZERO ERRORS!');
    }

    // Write final execution log to disk
    const logPath = path.resolve(__dirname, '../supabase_update_execution.log');
    const logData = {
        timestamp: new Date().toISOString(),
        totalTargeted: diffList.length,
        successCount,
        failCount,
        errors
    };
    fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), 'utf8');
    console.log(`Execution log written to: ${logPath}`);
}

const isDry = process.argv.includes('--dry-run');
applyPatch(isDry).catch(console.error);
