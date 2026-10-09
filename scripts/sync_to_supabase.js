
const fs = require("fs");
const utils = require("../netlify/functions/_utils.js");

async function main() {
    const supabaseUrl = utils.getLiveEnv("SUPABASE_URL");
    const supabaseKey = utils.getLiveEnv("SUPABASE_SERVICE_KEY") || utils.getLiveEnv("SUPABASE_KEY");

    console.log("Connecting to Supabase at", supabaseUrl);
    const masterQs = JSON.parse(fs.readFileSync("waiting_questions_master_perfected.json", "utf8"));

    // Fetch current rows
    const res = await fetch(supabaseUrl + "/rest/v1/waiting_questions?select=*&limit=1000", {
        headers: {
            "apikey": supabaseKey,
            "Authorization": "Bearer " + supabaseKey
        }
    });

    if (!res.ok) {
        throw new Error("HTTP error " + res.status + " " + res.statusText);
    }

    const dbQs = await res.json();
    console.log("Loaded " + dbQs.length + " questions from Supabase waiting_questions");

    const dbMap = new Map();
    dbQs.forEach(q => dbMap.set(q.id, q));

    const updates = [];
    for (const mq of masterQs) {
        const dq = dbMap.get(mq.id);
        if (!dq) {
            console.warn("Question not in DB: " + mq.id);
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

        if (Object.keys(payload).length > 0) {
            updates.push({ id: mq.id, payload: payload });
        }
    }

    console.log("Total questions needing updates: " + updates.length);
    let okCount = 0;
    const batchSize = 10;
    for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        await Promise.all(batch.map(async item => {
            const patchRes = await fetch(supabaseUrl + "/rest/v1/waiting_questions?id=eq." + item.id, {
                method: "PATCH",
                headers: {
                    "apikey": supabaseKey,
                    "Authorization": "Bearer " + supabaseKey,
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                body: JSON.stringify(item.payload)
            });
            if (patchRes.ok) {
                okCount++;
            } else {
                const errText = await patchRes.text();
                console.error("Failed ID " + item.id + ": " + patchRes.status + " " + errText);
            }
        }));
    }

    console.log("Updated " + okCount + " / " + updates.length + " questions successfully in Supabase!");
}

main().catch(console.error);
