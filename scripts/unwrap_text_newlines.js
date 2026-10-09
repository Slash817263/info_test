const fs = require('fs');

const qs = JSON.parse(fs.readFileSync('waiting_questions_perfected.json', 'utf8'));

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

// Unwrap regular prose text (removes arbitrary line breaks from PDF print columns)
function unwrapProse(text) {
    if (!text || typeof text !== 'string') return text;

    let s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 1. Join words broken with hyphens at line-end: e.g. "repre-\n zintă" -> "reprezintă"
    s = s.replace(/([a-zăâîșțA-ZĂÂÎȘȚ]+)-\s*\n\s*([a-zăâîșțA-ZĂÂÎȘȚ]+)/g, '$1$2');

    // 2. Fix known split words
    s = cleanRomanianWords(s);

    // 3. Process lines: preserve list items / bullet points or math blocks, unwrap normal sentences
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

        // Check if line starts a list item (e.g. "1. ", "2. ", "• ", "- ")
        let isListItem = /^(\d+\.|\-|\•|\*)\s+/.test(line);

        if (isListItem) {
            if (curBlock) {
                blocks.push(curBlock.trim());
            }
            curBlock = line;
            inList = true;
        } else if (inList) {
            // Continuation of list item or new paragraph
            curBlock += ' ' + line;
        } else {
            // Normal paragraph continuation
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

    // 4. Fix spaces before punctuation (e.g. "cuvânt ." -> "cuvânt.")
    joined = joined.replace(/([a-zăâîșțA-ZĂÂÎȘȚ0-9\}\)])\s+([.,;:!?])/g, '$1$2');

    // 5. Normalize multiple spaces
    joined = joined.replace(/[ \t]+/g, ' ');

    return joined.trim();
}

// Clean and unwrap options
function unwrapOption(opt, isQuestionCode) {
    if (!opt || typeof opt !== 'string') return opt;

    let s = opt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    // Remove any trailing Pascal options dump (e.g. "b) ... Limbajul Pascal ...")
    if (/(?:Limbajul\s*Pascal|Limbajul\s*C)\b/i.test(s)) {
        s = s.split(/(?:Limbajul\s*Pascal|Limbajul\s*C)\b/i)[0].trim();
    }
    if (/\s+\b[a-f]\)\s*(?:if\s+.*?\band\b|n\s+div|var\s+|procedure\s+)/i.test(s)) {
        s = s.split(/\s+\b[a-f]\)\s*(?:if\s+.*?\band\b|n\s+div|var\s+|procedure\s+)/i)[0].trim();
    }

    // Check if this option is a mathematical vertical fraction (e.g. "𝒄∙(𝒄+𝟏)\n𝟐" or "(𝑛−1)!\n2")
    let lines = s.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 2 && !lines[0].includes(';') && !lines[1].includes(';')) {
        // e.g. numerator on line 0, denominator on line 1
        if (lines[1].length <= 5 || /^[\d\w\s\+\-\*\/]+$/.test(lines[1])) {
            s = `${lines[0]} / ${lines[1]}`;
            lines = [s];
        }
    }

    // Clean dictionary words
    s = cleanRomanianWords(s);

    // If it's a code snippet (has semicolons and code keywords)
    let isCodeSnippet = s.includes(';') && /\b(int|float|char|cin|cout|for|while|if|return)\b/.test(s);

    if (!isCodeSnippet && !s.includes('{') && !s.includes('}')) {
        // It's a text option: unwrap all newlines into spaces!
        s = s.replace(/\n+/g, ' ');
        // Fix spaces before punctuation
        s = s.replace(/([a-zăâîșțA-ZĂÂÎȘȚ0-9\}\)])\s+([.,;:!?])/g, '$1$2');
        s = s.replace(/[ \t]+/g, ' ').trim();
    } else {
        // It's a code option: clean broken expressions within lines like `exp(1/2.0*\nlog(n))`
        s = s.replace(/(\*|\+|\-|\/|\=)\s*\n\s*/g, '$1 ');
        s = s.replace(/\n\s*(\*|\+|\-|\/|\=)/g, ' $1');
    }

    // Strip trailing page numbers: e.g. " 56"
    s = s.replace(/\s+\d{2,3}$/, '').trim();

    return s;
}

let modifiedCount = 0;

const cleanedList = qs.map(q => {
    let changed = false;

    // 1. Unwrap question text
    let newText = unwrapProse(q.text);
    if (newText !== q.text) {
        q.text = newText;
        changed = true;
    }

    // 2. Unwrap options
    let newOpts = (q.options_json || []).map(opt => unwrapOption(opt, q.type === 'code'));
    if (JSON.stringify(newOpts) !== JSON.stringify(q.options_json)) {
        q.options_json = newOpts;
        changed = true;
    }

    if (changed) modifiedCount++;
    return q;
});

console.log(`Unwrapped text & options for ${modifiedCount} / ${cleanedList.length} questions.`);

fs.writeFileSync('waiting_questions_unwrapped.json', JSON.stringify(cleanedList, null, 2));
