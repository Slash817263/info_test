const fs = require('fs');
const utils = require('../netlify/functions/_utils.js');

const dump = fs.readFileSync('pdf_dump.txt', 'utf8');
const recoverable = JSON.parse(fs.readFileSync('recoverable_text_questions.json', 'utf8'));

// 1. Ensure full answers dictionary for all variants 11-46
const ansIdx = 420504;
const answersText = dump.substring(ansIdx);

// Fix "Varianta 1 8" in answers text
const normalizedAnswersText = answersText.replace(/Varianta\s*1\s*8/g, 'Varianta 18');

let allAnswers = {};

for (let v = 11; v <= 46; v++) {
    const startStr = `Varianta ${v}`;
    const endStr = `Varianta ${v + 1}`;

    let startIndex = normalizedAnswersText.indexOf(startStr);
    let endIndex = v === 46 ? normalizedAnswersText.length : normalizedAnswersText.indexOf(endStr, startIndex + startStr.length);

    if (startIndex === -1) continue;
    let vText = normalizedAnswersText.substring(startIndex, endIndex);

    for (let q = 1; q <= 15; q++) {
        // Regex to capture "q. ... Răspuns corect ... x)"
        const qRegex = new RegExp(`(?:^|\\n)\\s*${q}\\.\\s*(?:[\\s\\S]*?R[aă]spuns corect\\s*:?\\s*([a-f])(?:\\)|\\s))`, 'i');
        let m = vText.match(qRegex);
        if (m) {
            let letter = m[1].toLowerCase();
            let correctIndex = letter.charCodeAt(0) - 97;

            // Extract hint if present
            let hint = null;
            let afterM = vText.substring(m.index + m[0].length);
            let nextQRegex = new RegExp(`(?:^|\\n)\\s*${q + 1}\\.`, 'i');
            let nextQMatch = afterM.match(nextQRegex);
            let qSection = nextQMatch ? afterM.substring(0, nextQMatch.index) : afterM;

            let hintMatch = qSection.match(/Indica[țt]ii?\s*:\s*([\s\S]*)/i);
            if (hintMatch) {
                hint = hintMatch[1].replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
                // Clean page numbers from hint
                hint = hint.replace(/\s+\d{2,3}$/, '').trim();
            }

            allAnswers[`${v}_${q}`] = {
                correct_index: correctIndex,
                hint: hint || "Analizează cu atenție cerința problemei și alege varianta corectă."
            };
        }
    }
}

// Manual additions for known edge cases in answers
if (!allAnswers['29_3']) allAnswers['29_3'] = { correct_index: 2, hint: "Două dame nu se atacă între ele dacă nu se află pe aceeași coloană, pe aceeași diagonală sau pe același rând." };

console.log('Total answers loaded:', Object.keys(allAnswers).length);

// Dictionary of known Romanian word break fixes
const wordReplacements = [
    [/\breu\s+șit\b/gi, 'reușit'],
    [/\bprom\s*o\s*vat\b/gi, 'promovat'],
    [/\bprom\s+ovat\b/gi, 'promovat'],
    [/\bv\s+ariabila\b/gi, 'variabila'],
    [/\bV\s+aloarea\b/gi, 'Valoarea'],
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
    [/\bsecven\s+ța\b/gi, 'secvența'],
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
    [/\bcoloa\s+na\b/gi, 'coloana']
];

function cleanRomanianWords(text) {
    if (!text) return text;
    let s = text;
    for (let [regex, rep] of wordReplacements) {
        s = s.replace(regex, rep);
    }
    return s;
}

// C++ code formatter utility
function formatCode(code) {
    if (!code || typeof code !== 'string') return code;

    let s = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    // Remove '| printf(...)' or '| scanf(...)' alternative columns
    s = s.replace(/\|\s*printf\s*\([^;]*\);?/g, '');
    s = s.replace(/\|\s*scanf\s*\([^;]*\);?/g, '');
    s = s.replace(/│\s*printf\s*\([^;]*\);?/g, '');
    s = s.replace(/│\s*scanf\s*\([^;]*\);?/g, '');

    // Remove Pascal / C markers
    s = s.replace(/(?:Limbajul\s*C\b|Limbajul\s*Pascal\b)[\s\S]*$/i, '');

    // Fix void main() -> int main()
    s = s.replace(/void\s+main\s*\(\s*\)/g, 'int main()');

    // Remove leading/trailing stray symbols
    s = s.replace(/^[;,\s]+/, '').replace(/[;,\s]+$/, ';').trim();
    if (!s.endsWith(';') && !s.endsWith('}') && !s.endsWith('>')) s += ';';

    s = s.replace(/[ \t]+/g, ' ');

    let lines = [];
    let currentLine = '';
    let parenDepth = 0;

    for (let i = 0; i < s.length; i++) {
        const ch = s[i];

        if (ch === '(') {
            parenDepth++;
            currentLine += ch;
        } else if (ch === ')') {
            parenDepth = Math.max(0, parenDepth - 1);
            currentLine += ch;
            if (parenDepth === 0 && /\b(for|while|if)\s*\(.*?\)$/.test(currentLine.trim())) {
                let rest = s.substring(i + 1).trim();
                if (!rest.startsWith('{') && !rest.startsWith(';')) {
                    lines.push(currentLine.trim());
                    currentLine = '';
                }
            }
        } else if (ch === '{') {
            currentLine += ' {';
            lines.push(currentLine.trim());
            currentLine = '';
        } else if (ch === '}') {
            if (currentLine.trim()) {
                lines.push(currentLine.trim());
                currentLine = '';
            }
            lines.push('}');
        } else if (ch === ';' && parenDepth === 0) {
            currentLine += ';';
            lines.push(currentLine.trim());
            currentLine = '';
        } else if (ch === '\n') {
            if (currentLine.trim()) {
                lines.push(currentLine.trim());
                currentLine = '';
            }
        } else {
            currentLine += ch;
        }
    }
    if (currentLine.trim()) {
        lines.push(currentLine.trim());
    }

    let indentedLines = [];
    let indentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('}')) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        let prefix = '    '.repeat(indentLevel);
        indentedLines.push(prefix + line);

        if (line.endsWith('{')) {
            indentLevel++;
        } else if (/\b(for|while|if)\s*\(.*?\)$/.test(line)) {
            let nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
            if (nextLine && !nextLine.startsWith('{')) {
                i++;
                let subLine = lines[i].trim();
                indentedLines.push(prefix + '    ' + subLine);
                if (/\b(for|while|if)\s*\(.*?\)$/.test(subLine) && lines[i + 1]) {
                    i++;
                    indentedLines.push(prefix + '        ' + lines[i].trim());
                }
            }
        }
    }

    return indentedLines.join('\n');
}

// Unwrap regular prose text
function unwrapProse(text) {
    if (!text || typeof text !== 'string') return text;

    let s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Remove language headers if trapped in text
    s = s.replace(/Limbajul\s*C\+\+\s*\/\s*Limbajul\s*C|Limbajul\s*C\+\+|Limbajul\s*C\b|Limbajul\s*Pascal\b/gi, '').trim();

    s = s.replace(/([a-zăâîșțA-ZĂÂÎȘȚ]+)-\s*\n\s*([a-zăâîșțA-ZĂÂÎȘȚ]+)/g, '$1$2');

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

// Clean and unwrap options
function unwrapOption(opt) {
    if (!opt || typeof opt !== 'string') return opt;

    let s = opt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

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

function isCode(str) {
    if (!str || typeof str !== 'string') return false;
    return str.includes(';') && (
        /\b(int|float|char|double|long|unsigned|void)\b/.test(str) ||
        /\b(cout|cin|for|while|return|if|else)\b/.test(str) ||
        /\b(strcpy|strlen|strcat|strchr)\b/.test(str)
    );
}

// Prepare items to insert
const processedItems = [];
const diffs = ['easy', 'medium', 'medium', 'hard'];

recoverable.forEach((q, idx) => {
    let key = `${q.varianta}_${q.numar}`;
    let ans = allAnswers[key];
    if (!ans) {
        console.warn(`No answer found for V${q.varianta} Q${q.numar}, skipping.`);
        return;
    }

    let text = unwrapProse(q.text);
    let code = q.code ? formatCode(q.code) : null;
    let options = (q.options || []).map(opt => unwrapOption(opt));

    // Determine if question is code
    let hasCodeOpts = options.some(opt => isCode(opt));
    let type = (code || hasCodeOpts) ? 'code' : 'choice';

    if (hasCodeOpts) {
        options = options.map(opt => isCode(opt) ? formatCode(opt) : opt);
    }

    // Category assignment
    let combined = (text + ' ' + (code || '')).toLowerCase();
    let category = "Fundamente";
    let subcategory = "Diverse";

    if (combined.includes("pseudocod") || combined.includes("algoritm pseudocod")) {
        category = "Fundamente";
        subcategory = "Pseudocod";
    } else if (combined.includes("complexitat")) {
        category = "Fundamente";
        subcategory = "Complexitati";
    } else if (combined.includes("matrice") || combined.includes("tablou bidimensional")) {
        category = "Organizarea Datelor";
        subcategory = "Matrice";
    } else if (combined.includes("tablou unidimensional") || combined.includes("vector")) {
        category = "Organizarea Datelor";
        subcategory = "Vectori";
    } else if (combined.includes("graf") || combined.includes("arbore") || combined.includes("noduri") || combined.includes("muchii")) {
        category = "Grafuri si Arbori";
        if (combined.includes("orientat")) subcategory = "Grafuri orientate";
        else if (combined.includes("arbore")) subcategory = "Arbori";
        else subcategory = "Grafuri neorientate";
    } else if (combined.includes("backtracking")) {
        category = "Backtracking";
        subcategory = "Teorie si aplicare practica";
    } else if (combined.includes("struct ")) {
        category = "Organizarea Datelor";
        subcategory = "Structuri de date (struct)";
    } else if (combined.includes("strlen") || combined.includes("strcpy") || combined.includes("sir de caractere") || combined.includes("char ")) {
        category = "Organizarea Datelor";
        subcategory = "Siruri de caractere";
    } else if (combined.includes("recursiv") || combined.includes("autoapel")) {
        category = "Subprograme";
        subcategory = "Recursivitate";
    } else if (combined.includes("parametru") || combined.includes("subprogram") || combined.includes("functie")) {
        category = "Subprograme";
        subcategory = "Transmitere prin valoare";
    } else if (combined.includes("for(") || combined.includes("while(") || combined.includes("if(")) {
        category = "Fundamente";
        subcategory = "Structuri de control";
    }

    processedItems.push({
        varianta: q.varianta,
        numar: q.numar,
        difficulty: diffs[idx % diffs.length],
        type: type,
        category: category,
        subcategory: subcategory,
        exam_type: "Poli",
        text: text,
        image_url: null,
        code: code,
        options_json: options,
        correct_index: ans.correct_index,
        hint: ans.hint
    });
});

console.log(`Successfully prepared ${processedItems.length} questions for insertion!`);
fs.writeFileSync('newly_recovered_questions.json', JSON.stringify(processedItems, null, 2));

// Insert into Supabase waiting_questions
async function insertNewQuestions() {
    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL');
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY') || utils.getLiveEnv('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials missing.');
    }

    console.log(`Inserting ${processedItems.length} new questions to Supabase waiting_questions...`);

    const batchSize = 25;
    let inserted = 0;

    for (let i = 0; i < processedItems.length; i += batchSize) {
        const batch = processedItems.slice(i, i + batchSize).map(item => ({
            difficulty: item.difficulty,
            type: item.type,
            category: item.category,
            subcategory: item.subcategory,
            exam_type: item.exam_type,
            text: item.text,
            image_url: item.image_url,
            code: item.code,
            options_json: item.options_json,
            correct_index: item.correct_index,
            hint: item.hint
        }));

        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/waiting_questions`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(batch)
            });

            if (res.ok) {
                inserted += batch.length;
                process.stdout.write(`Inserted ${inserted} / ${processedItems.length}...\r`);
            } else {
                console.error(`Error on batch ${i / batchSize}:`, await res.text());
            }
        } catch (err) {
            console.error(`Fetch exception on batch ${i / batchSize}:`, err);
        }
    }

    console.log(`\nFinished! Successfully inserted ${inserted} questions.`);
}

insertNewQuestions().catch(console.error);
