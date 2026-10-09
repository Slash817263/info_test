/**
 * Deep Code Simulator & Verifier
 * Tests code snippets in an isolated VM sandbox to verify output vs options_json[correct_index].
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const questions = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../supabase_questions_audited.json'), 'utf8'));

let tested = 0;
let matched = 0;
const discrepancies = [];

questions.forEach(q => {
    if (!q.code) return;
    const code = q.code;
    const opts = q.options_json;
    const cor = opts[q.correct_index];

    // Filter for self-contained code with cout and without unresolved external inputs
    if (code.includes('cout <<') && 
        !code.includes('cin >>') && 
        !code.includes('struct ') && 
        !code.includes('void f') && 
        !code.includes('int f(') &&
        !code.includes('________') &&
        !code.includes('#include')) {
        
        try {
            let jsCode = code
                .replace(/\bint\s+/g, 'let ')
                .replace(/\bbool\s+/g, 'let ')
                .replace(/\bchar\s+/g, 'let ')
                .replace(/\bfloat\s+/g, 'let ')
                .replace(/\bdouble\s+/g, 'let ')
                .replace(/cout\s*<<\s*endl;?/g, 'out += "\\n";')
                .replace(/cout\s*<<\s*/g, 'out += String(')
                .replace(/<<\s*endl/g, ') + "\\n"')
                .replace(/<<\s*"/g, ') + "')
                .replace(/<<\s*'/g, ') + \'')
                .replace(/<<\s*([a-zA-Z0-9_+\-*/%]+)/g, ') + String($1)')
                .replace(/;\s*$/gm, ');');

            const sandbox = { 
                out: '', 
                strlen: (s) => (s ? s.length : 0),
                strcpy: (d, s) => s,
                abs: Math.abs,
                floor: Math.floor,
                ceil: Math.ceil,
                sqrt: Math.sqrt
            };
            
            vm.createContext(sandbox);
            vm.runInContext('let out = "";\n' + jsCode, sandbox, { timeout: 150 });

            tested++;
            const res = String(sandbox.out).trim();
            const expected = String(cor).trim();

            if (res === expected) {
                matched++;
            } else {
                discrepancies.push({
                    id: q.id,
                    text: q.text,
                    code: q.code,
                    simulatedOutput: res,
                    dbCorrectAnswer: expected,
                    options: opts,
                    correctIndex: q.correct_index
                });
            }
        } catch (e) {
            // Non-trivial C++ specific syntax
        }
    }
});

console.log('--- DEEP CODE SIMULATION RESULTS ---');
console.log(`Evaluated standalone snippets: ${tested}`);
console.log(`Exact matches with DB answer: ${matched}`);
console.log(`Discrepancies found: ${discrepancies.length}`);

if (discrepancies.length > 0) {
    console.log(JSON.stringify(discrepancies, null, 2));
}
