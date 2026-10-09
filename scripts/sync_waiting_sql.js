const fs = require('fs');

const qs = JSON.parse(fs.readFileSync('waiting_questions_finalized.json', 'utf8'));

let sqlStatements = [];
sqlStatements.push(`-- Extracted questions from Varianta 11+ (Perfected & Unwrapped)`);

for (let q of qs) {
    let text = q.text ? q.text.replace(/'/g, "''").trim() : '';
    let code = q.code ? q.code.replace(/'/g, "''").trim() : null;
    let hint = q.hint ? q.hint.replace(/'/g, "''").trim() : "Analizează cu atenție cerința problemei și alege varianta corectă.";
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
console.log(`Updated waiting.sql with ${qs.length} finalized questions.`);
