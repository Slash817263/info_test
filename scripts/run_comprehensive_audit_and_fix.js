const fs = require('fs');
const utils = require('../netlify/functions/_utils.js');
const special29 = require('./special29_clean.js');

const rawQuestions = JSON.parse(fs.readFileSync('waiting_questions_455_raw.json', 'utf8'));

// Dictionary of known Romanian OCR deformities
const wordReplacements = [
    [/\bbackt\s+racking\b/gi, 'backtracking'],
    [/\bSecven[țt]\s+a\b/gi, 'Secvența'],
    [/\bsecven[țt]\s+a\b/gi, 'secvența'],
    [/\bc\s+âte\b/gi, 'câte'],
    [/\bex\s+presii\b/gi, 'expresii'],
    [/\bex\s+presie\b/gi, 'expresie'],
    [/\bv\s+ariabila\b/gi, 'variabila'],
    [/\bv\s+ariabilele\b/gi, 'variabilele'],
    [/\bv\s+ariabile\b/gi, 'variabile'],
    [/\bV\s+aloarea\b/gi, 'Valoarea'],
    [/\bva\s+loarea\b/gi, 'valoarea'],
    [/\bva\s+loare\b/gi, 'valoare'],
    [/\breu\s+șit\b/gi, 'reușit'],
    [/\bprom\s*o\s*vat\b/gi, 'promovat'],
    [/\bprom\s+ovat\b/gi, 'promovat'],
    [/\bafiș\s+area\b/gi, 'afișarea'],
    [/\bafis\s+area\b/gi, 'afișarea'],
    [/\bdif\s+erența\b/gi, 'diferența'],
    [/\bdiferenț\s+a\b/gi, 'diferența'],
    [/\belement\s+e\b/gi, 'elemente'],
    [/\bele\s+mente\b/gi, 'elemente'],
    [/\bstrst\s*r\b/gi, 'strstr'],
    [/\bsubmul[ţț]imi\s*l\s*or\b/gi, 'submulțimilor'],
    [/\baranjamentel\s*or\b/gi, 'aranjamentelor'],
    [/\bcombinărilo\s*r\b/gi, 'combinărilor'],
    [/\binstruc\s+țiunii\b/gi, 'instrucțiunii'],
    [/\binstruc\s+țiune\b/gi, 'instrucțiune'],
    [/\bsecven\s+ței\b/gi, 'secvenței'],
    [/\bpurtă\s+tor\b/gi, 'purtător'],
    [/\brepetițiea\b/gi, 'repetiția'],
    [/\bpafități\b/gi, 'parități'],
    [/\bfiecă\s+rui\b/gi, 'fiecărui'],
    [/\bne\s+orientat\b/gi, 'neorientat'],
    [/\bcom\s+plet\b/gi, 'complet'],
    [/\bcomp\s+let\b/gi, 'complet'],
    [/\bcom\s+parații\b/gi, 'comparații'],
    [/\bcom\s+ponente\b/gi, 'componente'],
    [/\bori\s+care\b/gi, 'oricare'],
    [/\bpro\s+gram\b/gi, 'program'],
    [/\biden\s+tice\b/gi, 'identice'],
    [/\bcoloa\s+na\b/gi, 'coloana'],
    [/\bcalcula\s+t\b/gi, 'calculat'],
    [/\bdef\s+init\b/gi, 'definit'],
    [/\barbo\s+re\b/gi, 'arbore']
];

function cleanRomanianWords(text) {
    if (!text) return text;
    let s = text;
    for (let [regex, rep] of wordReplacements) {
        s = s.replace(regex, rep);
    }
    return s;
}

function cleanProseText(text) {
    if (!text || typeof text !== 'string') return text;

    let s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Strip stray Pascal markers and Pascal blocks from text
    s = s.replace(/Limbajul\s*Pascal[\s\S]*?(?=(?:Indicați|Precizați|Cu ce|Care|Ce|Pentru|\n\n|$))/gi, ' ');
    s = s.replace(/(?:Limbajul\s*C\+\+|Limbajul\s*C\/C\+\+|Limbajul\s*C\b|Limbajul\s*Pascal\b)/gi, '').trim();

    // Hyphenation at line ends
    s = s.replace(/([a-zăâîșțA-ZĂÂÎȘȚ]+)-\s*\n\s*([a-zăâîșțA-ZĂÂÎȘȚ]+)/g, '$1$2');

    // Hyphens with space
    s = s.replace(/(^|[\s(])într\s*-\s*un([\s).,;:]|$)/gi, '$1într-un$2')
         .replace(/(^|[\s(])dintr\s*-\s*un([\s).,;:]|$)/gi, '$1dintr-un$2')
         .replace(/(^|[\s(])printr\s*-\s*un([\s).,;:]|$)/gi, '$1printr-un$2')
         .replace(/(^|[\s(])într\s*-\s*o([\s).,;:]|$)/gi, '$1într-o$2')
         .replace(/(^|[\s(])dintr\s*-\s*o([\s).,;:]|$)/gi, '$1dintr-o$2')
         .replace(/(^|[\s(])printr\s*-\s*o([\s).,;:]|$)/gi, '$1printr-o$2')
         .replace(/(^|[\s(])s\s*-\s*a([\s).,;:]|$)/gi, '$1s-a$2')
         .replace(/(^|[\s(])s\s*-\s*au([\s).,;:]|$)/gi, '$1s-au$2')
         .replace(/(^|[\s(])le\s*-\s*a([\s).,;:]|$)/gi, '$1le-a$2')
         .replace(/(^|[\s(])l\s*-\s*a([\s).,;:]|$)/gi, '$1l-a$2')
         .replace(/(^|[\s(])de\s*-\s*a([\s).,;:]|$)/gi, '$1de-a$2')
         .replace(/(^|[\s(])a\s*-\s*l([\s).,;:]|$)/gi, '$1a-l$2')
         .replace(/(^|[\s(])de\s*-\s*al([\s).,;:]|$)/gi, '$1de-al$2')
         .replace(/obținându\s*-\s*se/gi, 'obținându-se');

    s = cleanRomanianWords(s);

    // Unwrap lines
    let rawLines = s.split('\n');
    let blocks = [];
    let curBlock = '';
    let inList = false;

    for (let i = 0; i < rawLines.length; i++) {
        let line = rawLines[i].trim();
        if (!line) {
            if (curBlock) {
                blocks.push(curBlock.trim());
                curBlock = '';
            }
            inList = false;
            continue;
        }

        let isListItem = /^(\d+\.|\-|\•|\*)\s+/.test(line);

        if (isListItem) {
            if (curBlock) {
                blocks.push(curBlock.trim());
            }
            curBlock = line;
            inList = true;
        } else if (inList) {
            curBlock += ' ' + line;
        } else {
            if (curBlock) {
                curBlock += ' ' + line;
            } else {
                curBlock = line;
            }
        }
    }
    if (curBlock) {
        blocks.push(curBlock.trim());
    }

    let joined = blocks.join('\n\n');
    joined = joined.replace(/([a-zăâîșțA-ZĂÂÎȘȚ0-9\}\)])\s+([.,;:!?])/g, '$1$2');
    joined = joined.replace(/[ \t]+/g, ' ');

    return joined.trim();
}

function cleanOptionText(opt) {
    if (!opt || typeof opt !== 'string') return opt;

    let s = opt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    // Strip trailing Pascal dumps
    if (/(?:Limbajul\s*Pascal|Limbajul\s*C)\b/i.test(s)) {
        s = s.split(/(?:Limbajul\s*Pascal|Limbajul\s*C)\b/i)[0].trim();
    }
    if (/\s+\b[a-f]\)\s*(?:if\s+.*?\band\b|n\s+div|var\s+|procedure\s+)/i.test(s)) {
        s = s.split(/\s+\b[a-f]\)\s*(?:if\s+.*?\band\b|n\s+div|var\s+|procedure\s+)/i)[0].trim();
    }

    let lines = s.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 2 && !lines[0].includes(';') && !lines[1].includes(';')) {
        if (/^[0-9𝟐𝟒]+$/.test(lines[1])) {
            s = `${lines[0]} / ${lines[1]}`;
            lines = [s];
        } else {
            s = lines.join(' ');
        }
    }

    s = cleanRomanianWords(s);

    let isCodeSnippet = s.includes(';') && /\b(int|float|char|cin|cout|for|while|if|return)\b/.test(s);

    if (!isCodeSnippet && !s.includes('{') && !s.includes('}')) {
        s = s.replace(/\n+/g, ' ');
        s = s.replace(/([a-zăâîșțA-ZĂÂÎȘȚ0-9\}\)])\s+([.,;:!?])/g, '$1$2');
        s = s.replace(/[ \t]+/g, ' ').trim();
    } else {
        s = s.replace(/(\*|\+|\-|\/|\=)\s*\n\s*/g, '$1 ');
        s = s.replace(/\n\s*(\*|\+|\-|\/|\=)/g, ' $1');
    }

    s = s.replace(/\s+\d{2,3}$/, '').trim();
    return s;
}

// Recalibrate taxonomy strictly to RULES.md
function classifyTaxonomy(text, code) {
    let combined = (text + ' ' + (code || '')).toLowerCase();

    // 1. Backtracking
    if (combined.includes("backtracking")) {
        return { category: "Backtracking", subcategory: "Teorie si aplicare practica" };
    }

    // 2. Pseudocod
    if (combined.includes("pseudocod") || combined.includes("algoritm pseudocod")) {
        return { category: "Fundamente", subcategory: "Pseudocod" };
    }

    // 3. Complexități
    if (combined.includes("complexitat") || combined.includes("timp de executare")) {
        return { category: "Fundamente", subcategory: "Complexitati" };
    }

    // 4. Grafuri si Arbori
    if (combined.includes("graf") || combined.includes("arbore") || combined.includes("noduri") || combined.includes("muchii")) {
        let sub = "Grafuri neorientate";
        if (combined.includes("orientat")) sub = "Grafuri orientate";
        else if (combined.includes("arbore")) sub = "Arbori";
        return { category: "Grafuri si Arbori", subcategory: sub };
    }

    // 5. Organizarea Datelor: Matrice
    if (combined.includes("matrice") || combined.includes("tablou bidimensional") || combined.includes("linii și") || combined.includes("linii si")) {
        return { category: "Organizarea Datelor", subcategory: "Matrice" };
    }

    // 6. Organizarea Datelor: Structuri de date
    if (combined.includes("struct ") || combined.includes("typedef struct")) {
        return { category: "Organizarea Datelor", subcategory: "Structuri de date (struct)" };
    }

    // 7. Organizarea Datelor: Șiruri de caractere
    if (combined.includes("sir de caractere") || combined.includes("șir de caractere") || combined.includes("strlen") || combined.includes("strcpy") || combined.includes("strcat") || combined.includes("strchr")) {
        return { category: "Organizarea Datelor", subcategory: "Siruri de caractere" };
    }

    // 8. Organizarea Datelor: Vectori
    if (combined.includes("vector") || combined.includes("tablou unidimensional")) {
        return { category: "Organizarea Datelor", subcategory: "Vectori" };
    }

    // 9. Subprograme: Recursivitate
    if (combined.includes("recursiv") || combined.includes("autoapel") || combined.includes("f(f(")) {
        return { category: "Subprograme", subcategory: "Recursivitate" };
    }

    // 10. Subprograme: Funcții / Transmitere prin valoare
    if (combined.includes("subprogram") || combined.includes("functie") || combined.includes("funcție") || combined.includes("parametru")) {
        return { category: "Subprograme", subcategory: "Transmitere prin valoare" };
    }

    // 11. Fundamente: Structuri de control
    if (combined.includes("for(") || combined.includes("while(") || combined.includes("if(") || combined.includes("switch(")) {
        return { category: "Fundamente", subcategory: "Structuri de control" };
    }

    return { category: "Fundamente", subcategory: "Diverse" };
}

let modifiedCount = 0;
let categoryChanges = 0;

const cleanedQuestions = rawQuestions.map(q => {
    let changed = false;

    // Apply special 29 if present
    if (special29[q.id]) {
        const spec = special29[q.id];
        q.text = spec.text;
        q.code = spec.code;
        q.type = spec.type;
        changed = true;
    } else {
        let newText = cleanProseText(q.text);
        if (newText !== q.text) {
            q.text = newText;
            changed = true;
        }

        if (q.code) {
            // Clean Pascal markers if any in code
            let cleanC = q.code.replace(/(?:Limbajul\s*C\b|Limbajul\s*Pascal\b)[\s\S]*$/i, '').trim();
            if (cleanC !== q.code) {
                q.code = cleanC;
                changed = true;
            }
        }
    }

    // Clean options
    let newOpts = (q.options_json || []).map(opt => cleanOptionText(opt));
    if (JSON.stringify(newOpts) !== JSON.stringify(q.options_json)) {
        q.options_json = newOpts;
        changed = true;
    }

    // Recalibrate taxonomy
    let tax = classifyTaxonomy(q.text, q.code);
    if (q.category !== tax.category || q.subcategory !== tax.subcategory) {
        q.category = tax.category;
        q.subcategory = tax.subcategory;
        categoryChanges++;
        changed = true;
    }

    if (q.exam_type !== 'Poli') {
        q.exam_type = 'Poli';
        changed = true;
    }

    if (changed) modifiedCount++;
    return q;
});

console.log(`Total questions processed: ${cleanedQuestions.length}`);
console.log(`Questions modified: ${modifiedCount}`);
console.log(`Category recalibrations: ${categoryChanges}`);

fs.writeFileSync('waiting_questions_audited_and_fixed.json', JSON.stringify(cleanedQuestions, null, 2));

// Push all modified questions to Supabase in concurrent batches
async function pushFixesToSupabase() {
    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL');
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY') || utils.getLiveEnv('SUPABASE_KEY');

    console.log(`Updating ${cleanedQuestions.length} questions in waiting_questions on Supabase...`);

    let successCount = 0;
    const concurrency = 20;

    for (let i = 0; i < cleanedQuestions.length; i += concurrency) {
        const chunk = cleanedQuestions.slice(i, i + concurrency);
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
                    body: JSON.stringify({
                        text: item.text,
                        code: item.code,
                        type: item.type,
                        category: item.category,
                        subcategory: item.subcategory,
                        exam_type: item.exam_type,
                        options_json: item.options_json
                    })
                });
                if (res.ok) successCount++;
                else console.error(`Error on ID ${item.id}:`, await res.text());
            } catch (err) {
                console.error(`Error on ID ${item.id}:`, err);
            }
        }));
        process.stdout.write(`Updated ${Math.min(i + concurrency, cleanedQuestions.length)} / ${cleanedQuestions.length}...\r`);
    }

    console.log(`\nSuccessfully applied fixes to ${successCount} / ${cleanedQuestions.length} questions.`);
}

pushFixesToSupabase().catch(console.error);
