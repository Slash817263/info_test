const fs = require('fs');
const utils = require('../netlify/functions/_utils.js');

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

    // 2. Fix hyphenation glitches with space
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

    // 3. Fix known split words
    s = cleanRomanianWords(s);

    // 4. Process lines: preserve list items / bullet points or math blocks, unwrap normal sentences
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

    // 5. Fix spaces before punctuation (e.g. "cuvânt ." -> "cuvânt.")
    joined = joined.replace(/([a-zăâîșțA-ZĂÂÎȘȚ0-9\}\)])\s+([.,;:!?])/g, '$1$2');

    // 6. Normalize multiple spaces
    joined = joined.replace(/[ \t]+/g, ' ');

    return joined.trim();
}

// Clean and unwrap options
function unwrapOption(opt, isQuestionCode) {
    if (!opt || typeof opt !== 'string') return opt;

    let s = opt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    // Remove any trailing Pascal options dump
    if (/(?:Limbajul\s*Pascal|Limbajul\s*C)\b/i.test(s)) {
        s = s.split(/(?:Limbajul\s*Pascal|Limbajul\s*C)\b/i)[0].trim();
    }
    if (/\s+\b[a-f]\)\s*(?:if\s+.*?\band\b|n\s+div|var\s+|procedure\s+)/i.test(s)) {
        s = s.split(/\s+\b[a-f]\)\s*(?:if\s+.*?\band\b|n\s+div|var\s+|procedure\s+)/i)[0].trim();
    }

    // Check if this option is a mathematical vertical fraction (e.g. "𝒄∙(𝒄+𝟏)\n𝟐" or "(𝑛−1)!\n2")
    let lines = s.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 2 && !lines[0].includes(';') && !lines[1].includes(';')) {
        // ONLY if the second line is purely a number (like 2, 4, 𝟐, 𝟒)
        if (/^[0-9𝟐𝟒]+$/.test(lines[1])) {
            s = `${lines[0]} / ${lines[1]}`;
            lines = [s];
        } else {
            s = lines.join(' ');
        }
    }

    // Clean dictionary words
    s = cleanRomanianWords(s);

    // If it's a code snippet (has semicolons and code keywords)
    let isCodeSnippet = s.includes(';') && /\b(int|float|char|cin|cout|for|while|if|return)\b/.test(s);

    if (!isCodeSnippet && !s.includes('{') && !s.includes('}')) {
        // It's a text option: unwrap all newlines into spaces!
        s = s.replace(/\n+/g, ' ');
        s = s.replace(/([a-zăâîșțA-ZĂÂÎȘȚ0-9\}\)])\s+([.,;:!?])/g, '$1$2');
        s = s.replace(/[ \t]+/g, ' ').trim();
    } else {
        // It's a code option: clean broken expressions within lines like `exp(1/2.0*\nlog(n))`
        s = s.replace(/(\*|\+|\-|\/|\=)\s*\n\s*/g, '$1 ');
        s = s.replace(/\n\s*(\*|\+|\-|\/|\=)/g, ' $1');
    }

    // Strip trailing page numbers: e.g. " 56", " 172"
    s = s.replace(/\s+\d{2,3}$/, '').trim();

    return s;
}

// Special individual overrides for known edge cases
const extraSpecialFixes = {
    1171: {
        text: "Indicați care expresie dintre următoarele are valoarea 1 dacă și numai dacă valorile variabilelor a și b sunt numere întregi impare consecutive.",
        code: "1. (a%2==1) && !(b%2) && abs(a-b)==2\n2. !(a%2) && !(b%2) && abs(a-b)==2\n3. !(!(a%2) && !(b%2)) && abs(a-b)==2\n4. (a%2==1 && b%2!=1) && (a-b==2 || b-a==2)\n5. !(a%2) && !(b%2) && !(abs(a-b)==2)\n6. (a%2) && (b%2) && abs(a-b)!=2",
        type: "code",
        options_json: ["1", "2", "3", "4", "5", "6"]
    },
    1327: {
        options_json: ["4", "5", "6", "7", "8", "9"]
    }
};

const finalizedList = qs.map(q => {
    if (extraSpecialFixes[q.id]) {
        const fix = extraSpecialFixes[q.id];
        if (fix.text) q.text = fix.text;
        if (fix.code) q.code = fix.code;
        if (fix.type) q.type = fix.type;
        if (fix.options_json) q.options_json = fix.options_json;
    }

    q.text = unwrapProse(q.text);
    q.options_json = (q.options_json || []).map(opt => unwrapOption(opt, q.type === 'code'));

    return q;
});

fs.writeFileSync('waiting_questions_finalized.json', JSON.stringify(finalizedList, null, 2));
console.log('Saved waiting_questions_finalized.json');

// Apply directly to Supabase
async function updateSupabase() {
    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL');
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY') || utils.getLiveEnv('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials missing.');
    }

    console.log(`Updating ${finalizedList.length} questions in waiting_questions on Supabase...`);

    let successCount = 0;
    const concurrency = 15;

    for (let i = 0; i < finalizedList.length; i += concurrency) {
        const chunk = finalizedList.slice(i, i + concurrency);
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
                        options_json: item.options_json,
                        exam_type: item.exam_type
                    })
                });
                if (res.ok) successCount++;
                else console.error(`Error on ID ${item.id}:`, await res.text());
            } catch (err) {
                console.error(`Error on ID ${item.id}:`, err);
            }
        }));
        process.stdout.write(`Updated ${Math.min(i + concurrency, finalizedList.length)} / ${finalizedList.length}...\r`);
    }

    console.log(`\nDone! Successfully updated ${successCount} / ${finalizedList.length} questions.`);
}

updateSupabase().catch(console.error);
