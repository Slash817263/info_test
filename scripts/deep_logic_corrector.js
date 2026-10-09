/**
 * Deep Logic Corrector
 * Ingests questions and applies all factual, mathematical, and algorithmic corrections.
 */

const fs = require('fs');
const path = require('path');
const { loadQuestions, auditBatch } = require('./batch_audit_engine');

function runDeepLogicCorrection() {
    const questions = loadQuestions();
    console.log(`Auditing ${questions.length} questions for deep logic errors...`);

    // Run baseline batch audit (difficulty recalibration, formatting, hint standardization)
    const baseAudit = auditBatch(questions, 'ALL');
    const auditMap = new Map();
    baseAudit.items.forEach(item => auditMap.set(item.id, item));

    const finalQuestions = [];
    const logicFixLog = [];

    questions.forEach(q => {
        const audited = auditMap.get(q.id);
        let category = audited ? audited.category : q.category;
        let subcategory = audited ? audited.subcategory : q.subcategory;
        let difficulty = audited ? audited.newDifficulty : q.difficulty;
        let code = (audited && audited.newCode !== undefined) ? audited.newCode : q.code;
        let hint = audited ? audited.newHint : q.hint;
        let options_json = q.options_json;
        let correct_index = q.correct_index;

        if (typeof options_json === 'string') {
            try { options_json = JSON.parse(options_json); } catch (e) {}
        } else {
            options_json = Array.isArray(options_json) ? [...options_json] : options_json;
        }

        // 1. SPECIFIC LOGIC FIX: ID 93 (Matrix zero-count below and on main diagonal)
        if (q.id === 93) {
            // Function fun counts matrix[i][j] == 0 for j <= i.
            // Row 0: [1] -> 0 zeros
            // Row 1: [4, 5] -> 0 zeros
            // Row 2: [0, 0, 0] -> 3 zeros
            // Row 3: [1, 0, 0, 5] -> 2 zeros
            // Total = 5 zeros. Option index 1 is "5".
            correct_index = 1;
            hint = "Evaluează condiția j <= i: buclele contorizează zerourile situate pe diagonala principală și sub aceasta. Linia 2 conține 3 zerouri, iar linia 3 conține 2 zerouri (total 5).";
            logicFixLog.push({
                id: 93,
                issue: "Valoare returnată greșită în DB (2 în loc de 5)",
                fix: "correct_index setat la 1 ('5')"
            });
        }

        // 2. SPECIFIC LOGIC FIX: ID 188 (Matrix 2025x2025 secondary diagonal ambiguous options)
        if (q.id === 188) {
            // Secondary diagonal indexed 0..2024 requires i + j == 2024.
            // Option 0: m[1999][25] -> sum 2024 (valid)
            // Option 3 was m[25][1999] -> sum 2024 (also valid!).
            // Turn Option 3 into a distractor with sum 2025 to keep Option 0 uniquely correct.
            options_json[3] = 'm[25][2000]';
            hint = "Pentru o matrice cu indexare de la 0 la n-1, elementele de pe diagonala secundară respectă relația i + j == n - 1 (aici 2024).";
            logicFixLog.push({
                id: 188,
                issue: "Două opțiuni simultan corecte pe diagonala secundară (m[1999][25] și m[25][1999])",
                fix: "Opțiunea 3 transformată în distractorul 'm[25][2000]'"
            });
        }

        // 3. SPECIFIC LOGIC FIX: ID 861 (Directed graph vertices where d+ == d-)
        if (q.id === 861) {
            // Graph vertices 1..5:
            // Node 2 has d+=1, d-=1; Node 4 has d+=1, d-=1; Node 5 is isolated: d+=0, d-=0.
            // Total vertices with d+ == d- is 3.
            // Options: ['2', '3', '1', '0']. Index 1 corresponds to '3'.
            correct_index = 1;
            hint = "Verifică gradele pentru fiecare nod, inclusiv pentru cele izolate. Un nod izolat are d+ = 0 și d- = 0 (egale), astfel încât nodurile 2, 4 și 5 respectă condiția (total 3 noduri).";
            logicFixLog.push({
                id: 861,
                issue: "Nodul izolat 5 a fost omis din calculul egalității d+ == d-",
                fix: "correct_index setat la 1 ('3')"
            });
        }

        // 4. SPECIFIC LOGIC FIX: ID 858 (Directed graph vertices with in-degree d- == 2)
        if (q.id === 858) {
            // Graph has vertices 1 and 3 both with in-degree 2:
            // Node 1 receives from 3 and 5 (d-=2).
            // Node 3 receives from 2 and 5 (d-=2).
            // Total vertices with d- == 2 is 2.
            // Options: ['3', '1', '0', '2']. Index 3 corresponds to '2'.
            correct_index = 3;
            hint = "Gradul intern d- reprezintă numărul de arce care intră în nod. Vârfurile 1 și 3 au fiecare exact 2 arce incidente spre interior (total 2 noduri).";
            logicFixLog.push({
                id: 858,
                issue: "Doar un nod a fost numărat cu grad intern 2, deși atât nodul 1 cât și nodul 3 au d- = 2",
                fix: "correct_index setat la 3 ('2')"
            });
        }

        // 5. SPECIFIC LOGIC FIX: ID 158 (Malformed category)
        if (q.id === 158) {
            category = 'Organizarea Datelor';
            subcategory = 'Siruri de caractere';
            logicFixLog.push({
                id: 158,
                issue: "Categorie invalidă 'Siruri de caractere' / 'C++'",
                fix: "Mutat în 'Organizarea Datelor' / 'Siruri de caractere'"
            });
        }

        // 6. SPECIFIC LOGIC FIX: ID 525 (C Syntax void main)
        if (q.id === 525) {
            code = code.replace(/void\s+main\s*\(\s*\)/g, 'int main()');
            logicFixLog.push({
                id: 525,
                issue: "Sintaxă C interzisă void main()",
                fix: "Înlocuit cu int main()"
            });
        }

        // 7. SPECIFIC LOGIC FIX: ID 1086 (C Syntax printf)
        if (q.id === 1086) {
            code = code.replace(/printf\s*\(\s*"%d"\s*,\s*i\s*\);\s*\/\/\s*cout<<i;/g, 'cout << i;');
            code = code.replace(/printf\s*\(\s*"%d"\s*,\s*j\s*\);\s*\/\/\s*cout<<j;/g, 'cout << j;');
            code = code.replace(/printf\s*\(\s*"%d"\s*,\s*([a-zA-Z0-9_]+)\s*\);/g, 'cout << $1;');
            logicFixLog.push({
                id: 1086,
                issue: "Sintaxă C reziduală printf()",
                fix: "Înlocuit cu cout << i / cout << j"
            });
        }

        finalQuestions.push({
            ...q,
            category,
            subcategory,
            difficulty,
            code,
            hint,
            options_json,
            correct_index
        });
    });

    console.log(`Applied ${logicFixLog.length} critical logic & category fixes.`);
    console.log(JSON.stringify(logicFixLog, null, 2));

    // Save final audited dataset
    const auditedJsonPath = path.resolve(__dirname, '../supabase_questions_audited.json');
    fs.writeFileSync(auditedJsonPath, JSON.stringify(finalQuestions, null, 2), 'utf8');
    console.log(`Saved updated questions to: ${auditedJsonPath}`);

    return { finalQuestions, logicFixLog };
}

if (require.main === module) {
    runDeepLogicCorrection();
}

module.exports = { runDeepLogicCorrection };
