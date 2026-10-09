const fs = require('fs');

const questions = JSON.parse(fs.readFileSync('cleaned_questions.json', 'utf8'));
const answers = JSON.parse(fs.readFileSync('parsed_answers.json', 'utf8'));

let sqlStatements = [];
sqlStatements.push(`-- Extracted questions from Varianta 11+`);

for (let q of questions) {
    // Find answer
    const ans = answers.find(a => a.varianta === q.varianta && a.numar === q.numar);
    if (!ans) {
        console.log(`Answer not found for V${q.varianta} Q${q.numar}`);
        continue;
    }
    
    let text = q.text.replace(/'/g, "''").trim();
    let code = q.code ? q.code.replace(/'/g, "''").trim() : null;
    let hint = ans.hint ? ans.hint.replace(/'/g, "''").trim() : "Analizeaza cu atentie cerinta problemei si alege varianta corecta.";
    let optionsJson = JSON.stringify(q.options).replace(/'/g, "''");
    
    let examType = `Varianta ${q.varianta}`;
    let type = q.code ? 'code' : 'choice'; // simplified
    
    // Check if code has multiple lines
    if (code && code.split('\\n').length > 1) {
        type = 'code';
    }
    
    let sql = `INSERT INTO waiting_questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, hint) VALUES (
        '${q.difficulty}',
        '${type}',
        '${q.category}',
        '${q.subcategory}',
        '${examType}',
        '${text}',
        NULL,
        ${code ? `'${code}'` : 'NULL'},
        '${optionsJson}'::jsonb,
        ${ans.correct_index},
        '${hint}'
    );`;
    
    sqlStatements.push(sql);
}

fs.writeFileSync('waiting.sql', sqlStatements.join('\n\n'));
console.log(`Generated SQL for ${sqlStatements.length - 1} questions.`);
