const fs = require('fs');

const sql = fs.readFileSync('waiting.sql', 'utf8');
const lines = sql.split('\n');

const questions = [];
let currentItem = null;
let id = 1;

for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("('")) continue;
    
    // Parse line: ('difficulty', 'type', 'category', 'subcategory', 'text', code, 'options_json'::jsonb, correct_index, 'explanation')
    // We can extract fields by splitting or matching
    try {
        const fullMatch = trimmed.match(/^\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'((?:[^']|'')+)',\s*(NULL|'[\s\S]*?'|"[^"]*"),\s*'((?:[^']|'')+)'::jsonb,\s*(\d+),\s*'((?:[^']|'')+)'\)[;,]?$/);
        if (fullMatch) {
            const difficulty = fullMatch[1];
            const type = fullMatch[2];
            const category = fullMatch[3];
            const subcategory = fullMatch[4];
            const text = fullMatch[5].replace(/''/g, "'");
            let rawCode = fullMatch[6];
            let code = null;
            if (rawCode !== 'NULL') {
                if (rawCode.startsWith("'") && rawCode.endsWith("'")) {
                    code = rawCode.slice(1, -1).replace(/''/g, "'");
                } else if (rawCode.startsWith('"') && rawCode.endsWith('"')) {
                    code = rawCode.slice(1, -1);
                } else {
                    code = rawCode;
                }
            }
            const options_json = JSON.parse(fullMatch[7].replace(/''/g, "'"));
            const correct_index = parseInt(fullMatch[8]);
            const explanation = fullMatch[9].replace(/''/g, "'");
            
            questions.push({
                id: id++,
                difficulty,
                type,
                category,
                subcategory,
                text,
                code,
                options_json,
                correct_index,
                explanation
            });
        } else {
            console.log('Failed line:', trimmed);
        }
    } catch(e) {
        console.error('Failed on line:', trimmed, e);
    }
}

console.log('Successfully parsed questions:', questions.length);
fs.writeFileSync('waiting_questions.json', JSON.stringify(questions, null, 2), 'utf8');
