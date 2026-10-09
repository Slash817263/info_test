const fs = require('fs');
const utils = require('../netlify/functions/_utils.js');
const special29 = require('./special29_clean.js');

// Load freshest 455 questions
const allQs = JSON.parse(fs.readFileSync('waiting_questions_audited_and_fixed.json', 'utf8'));

// 1. FIX THE 2 VERIFIED ANSWER INDEX MISMATCHES:
const q1201 = allQs.find(q => q.id === 1201);
if (q1201) {
    q1201.correct_index = 0; // Book says a) 864
    console.log('Fixed ID 1201 correct_index -> 0 (864)');
}

const q1203 = allQs.find(q => q.id === 1203);
if (q1203) {
    q1203.correct_index = 2; // Book says c) O(2^n)
    console.log('Fixed ID 1203 correct_index -> 2 (O(2^n))');
}

// 2. Comprehensive dictionary of word fixes
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

// 3. Mathematical Superscript Normalizer (e.g. O(2n) -> O(2^n), O(n2) -> O(n^2), O(n3) -> O(n^3))
function normalizeMathOption(opt) {
    if (!opt || typeof opt !== 'string') return opt;
    let s = opt;

    // Fix Big-O notation powers
    s = s.replace(/\bO\(2n\)/g, 'O(2^n)');
    s = s.replace(/\bO\(n2\)/g, 'O(n^2)');
    s = s.replace(/\bO\(n3\)/g, 'O(n^3)');
    s = s.replace(/\bO\(n4\)/g, 'O(n^4)');
    s = s.replace(/\bθ\(2n\)/g, 'θ(2^n)');
    s = s.replace(/\bθ\(n2\)/g, 'θ(n^2)');
    s = s.replace(/\bθ\(n3\)/g, 'θ(n^3)');

    // Fix n2, n3 in math choices like (n3)p, p-n3
    s = s.replace(/\(n3\)p/g, '(n^3)^p');
    s = s.replace(/p∙n3/g, 'p∙n^3');
    s = s.replace(/p∙n2/g, 'p∙n^2');
    s = s.replace(/\(p\+1\)∙n3/g, '(p+1)∙n^3');
    s = s.replace(/\(p-1\)∙n3/g, '(p-1)∙n^3');
    s = s.replace(/^n3$/g, 'n^3');
    s = s.replace(/^n2$/g, 'n^2');
    s = s.replace(/^n2\s*-1$/g, 'n^2 - 1');

    return s;
}

// 4. Process all 455 questions
let modifiedCount = 0;

const perfectedList = allQs.map(q => {
    let changed = false;

    // If it's one of the 29 special questions with trapped code
    if (special29[q.id]) {
        const spec = special29[q.id];
        if (q.text !== spec.text) { q.text = spec.text; changed = true; }
        if (q.code !== spec.code) { q.code = spec.code; changed = true; }
        if (q.type !== spec.type) { q.type = spec.type; changed = true; }
    } else {
        // Clean text
        let oldText = q.text;
        let newText = cleanRomanianWords(q.text);

        // Remove any remaining stray Pascal headers or inline Pascal blocks
        newText = newText.replace(/Limbajul\s*Pascal[\s\S]*?(?=(?:Indicați|Precizați|Cu ce|Care|Ce|Pentru|\n\n|$))/gi, ' ');
        newText = newText.replace(/(?:Limbajul\s*C\+\+|Limbajul\s*C\/C\+\+|Limbajul\s*C\b|Limbajul\s*Pascal\b)/gi, '').trim();

        // Strip stray page numbers inside text: e.g. " 143 ", " 113 "
        newText = newText.replace(/\s+\d{2,3}\s+/g, ' ');

        // Clean spaces before punctuation
        newText = newText.replace(/([a-zăâîșțA-ZĂÂÎȘȚ0-9\}\)])\s+([.,;:!?])/g, '$1$2');
        newText = newText.replace(/[ \t]+/g, ' ').trim();

        if (newText !== oldText) {
            q.text = newText;
            changed = true;
        }

        // Clean code if present
        if (q.code) {
            let oldCode = q.code;
            let newCode = q.code.replace(/(?:Limbajul\s*C\b|Limbajul\s*Pascal\b)[\s\S]*$/i, '').trim();
            newCode = newCode.replace(/i\s*--/g, 'i--')
                             .replace(/j\s*--/g, 'j--')
                             .replace(/i\s*\+\+/g, 'i++')
                             .replace(/j\s*\+\+/g, 'j++');
            if (newCode !== oldCode) {
                q.code = newCode;
                changed = true;
            }
        }
    }

    // Clean and normalize options
    let oldOpts = JSON.stringify(q.options_json);
    q.options_json = (q.options_json || []).map(opt => {
        let o = cleanRomanianWords(opt);
        o = normalizeMathOption(o);
        o = o.replace(/i\s*--/g, 'i--')
             .replace(/j\s*--/g, 'j--')
             .replace(/i\s*\+\+/g, 'i++')
             .replace(/j\s*\+\+/g, 'j++');
        return o.trim();
    });

    if (JSON.stringify(q.options_json) !== oldOpts) {
        changed = true;
    }

    if (changed) modifiedCount++;
    return q;
});

console.log(`Master quality pass modified ${modifiedCount} questions.`);

fs.writeFileSync('waiting_questions_master_perfected.json', JSON.stringify(perfectedList, null, 2));

// Push updates to Supabase
async function updateSupabase() {
    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL');
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY') || utils.getLiveEnv('SUPABASE_KEY');

    console.log(`Pushing perfected questions to Supabase waiting_questions...`);

    let successCount = 0;
    const concurrency = 20;

    for (let i = 0; i < perfectedList.length; i += concurrency) {
        const chunk = perfectedList.slice(i, i + concurrency);
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
                        options_json: item.options_json,
                        correct_index: item.correct_index,
                        hint: item.hint
                    })
                });
                if (res.ok) successCount++;
                else console.error(`Error on ID ${item.id}:`, await res.text());
            } catch (err) {
                console.error(`Error on ID ${item.id}:`, err);
            }
        }));
        process.stdout.write(`Updated ${Math.min(i + concurrency, perfectedList.length)} / ${perfectedList.length}...\r`);
    }

    console.log(`\nAll done! Successfully updated ${successCount} / ${perfectedList.length} questions.`);
}

updateSupabase().catch(console.error);
