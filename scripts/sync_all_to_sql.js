const fs = require('fs');
const utils = require('../netlify/functions/_utils.js');

async function syncAllSql() {
    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL');
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY') || utils.getLiveEnv('SUPABASE_KEY');

    const res = await fetch(`${supabaseUrl}/rest/v1/waiting_questions?select=*&order=id.asc`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const allQs = await res.json();

    let sqlStatements = [];
    sqlStatements.push('-- Extracted questions from Varianta 11+ (455 Cleaned & Formatted Questions)');

    for (let q of allQs) {
        let text = q.text ? q.text.replace(/'/g, "''").trim() : '';
        let code = q.code ? q.code.replace(/'/g, "''").trim() : null;
        let hint = q.hint ? q.hint.replace(/'/g, "''").trim() : 'Analizează cu atenție cerința problemei și alege varianta corectă.';
        let optionsJson = JSON.stringify(q.options_json).replace(/'/g, "''");

        let sql = `INSERT INTO waiting_questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, hint) VALUES (
    '${q.difficulty}',
    '${q.type}',
    '${q.category}',
    '${q.subcategory}',
    '${q.exam_type}',
    '${text}',
    NULL,
    ${code ? `'${code}'` : 'NULL'},
    '${optionsJson}'::jsonb,
    ${q.correct_index},
    '${hint}'
);`;

        sqlStatements.push(sql);
    }

    fs.writeFileSync('waiting.sql', sqlStatements.join('\n\n'));
    console.log(`Successfully synced waiting.sql with ${allQs.length} questions!`);
}

syncAllSql().catch(console.error);
