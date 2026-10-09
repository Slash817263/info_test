const fs = require('fs');
const path = require('path');

const dotenv = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8');
const env = {};
dotenv.split('\n').forEach(line => {
    const t = line.trim();
    if (t && !t.startsWith('#') && t.includes('=')) {
        const i = t.indexOf('=');
        env[t.substring(0, i).trim()] = t.substring(i + 1).trim();
    }
});

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY;

async function cleanProgressRecords() {
    // 1. Count before
    const countRes = await fetch(`${url}/rest/v1/results?test_type=like.progress_*&select=id`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const beforeList = await countRes.json();
    console.log(`Found ${beforeList.length} stale progress records to clean.`);

    if (beforeList.length > 0) {
        // Delete all progress_* rows
        const delRes = await fetch(`${url}/rest/v1/results?test_type=like.progress_*`, {
            method: 'DELETE',
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`
            }
        });
        console.log(`Delete response: HTTP ${delRes.status}`);
    }

    // 2. Count after
    const afterRes = await fetch(`${url}/rest/v1/results?test_type=like.progress_*&select=id`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const afterList = await afterRes.json();
    console.log(`Remaining progress records: ${afterList.length}`);
}

cleanProgressRecords().catch(console.error);
