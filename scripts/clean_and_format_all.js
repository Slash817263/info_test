const fs = require('fs');

const qs = JSON.parse(fs.readFileSync('waiting_questions_from_db.json', 'utf8'));

// C++ code formatter utility
function formatCppSnippet(code) {
    if (!code || typeof code !== 'string') return code;

    let s = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Remove '| printf(...)' or '| scanf(...)' alternative columns
    s = s.replace(/\|\s*printf\s*\([^;]*\);?/g, '');
    s = s.replace(/\|\s*scanf\s*\([^;]*\);?/g, '');
    s = s.replace(/│\s*printf\s*\([^;]*\);?/g, '');
    s = s.replace(/│\s*scanf\s*\([^;]*\);?/g, '');

    // Remove Pascal / C markers if any
    s = s.replace(/(?:Limbajul\s*C\b|Limbajul\s*Pascal\b)[\s\S]*$/i, '');

    // Fix void main() -> int main()
    s = s.replace(/void\s+main\s*\(\s*\)/g, 'int main()');

    // Normalize spacing around operators for clarity
    s = s.replace(/\bcin\s*>>/g, 'cin >> ');
    s = s.replace(/\bcout\s*<</g, 'cout << ');

    // Break lines after semicolons (unless inside for header for(...;...;...))
    // We can do this with a token-aware or parenthesis-depth aware pass:
    let formatted = '';
    let parenDepth = 0;
    let braceDepth = 0;
    let inFor = false;

    // Split into tokens / lines first
    // First, let's normalize spaces
    s = s.replace(/[ \t]+/g, ' ').trim();

    let lines = [];
    let currentLine = '';

    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const next = s[i + 1] || '';

        if (ch === '(') {
            parenDepth++;
            currentLine += ch;
        } else if (ch === ')') {
            parenDepth = Math.max(0, parenDepth - 1);
            currentLine += ch;
            // If we just closed a for() or while() or if() without a brace, maybe line break if next is not '{'
            if (parenDepth === 0 && (/\b(for|while|if)\s*\(.*?\)$/.test(currentLine.trim()))) {
                let rest = s.substring(i + 1).trim();
                if (rest.startsWith('{')) {
                    // keep with brace
                } else if (!rest.startsWith(';')) {
                    lines.push(currentLine.trim());
                    currentLine = '';
                }
            }
        } else if (ch === '{') {
            braceDepth++;
            currentLine += ' {';
            lines.push(currentLine.trim());
            currentLine = '';
        } else if (ch === '}') {
            if (currentLine.trim()) {
                lines.push(currentLine.trim());
                currentLine = '';
            }
            braceDepth = Math.max(0, braceDepth - 1);
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

    // Now re-indent lines based on control structures and braces
    let indentedLines = [];
    let indentLevel = 0;

    for (let idx = 0; idx < lines.length; idx++) {
        let line = lines[idx].trim();
        if (!line) continue;

        // Clean leading semicolons or junk
        line = line.replace(/^[;,\s]+/, '');
        if (!line) continue;

        if (line.startsWith('}')) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        // Apply indentation
        let indent = '    '.repeat(indentLevel);
        indentedLines.push(indent + line);

        if (line.endsWith('{')) {
            indentLevel++;
        } else if (/\b(for|while|if)\s*\(.*?\)$/.test(line)) {
            // Check if next line is not a block opening
            let nextLine = lines[idx + 1] ? lines[idx + 1].trim() : '';
            if (!nextLine.startsWith('{')) {
                // Next line is single statement body
                if (lines[idx + 1]) {
                    idx++;
                    let subLine = lines[idx].trim();
                    if (subLine) {
                        indentedLines.push(indent + '    ' + subLine);
                        // Check if subLine itself is a nested if/for
                        if (/\b(for|while|if)\s*\(.*?\)$/.test(subLine) && lines[idx + 1]) {
                            idx++;
                            let subSubLine = lines[idx].trim();
                            if (subSubLine) {
                                indentedLines.push(indent + '        ' + subSubLine);
                            }
                        }
                    }
                }
            }
        }
    }

    return indentedLines.join('\n');
}

// Clean common OCR and Romanian typos
function cleanTextTypo(text) {
    if (!text || typeof text !== 'string') return text;
    let t = text;

    // Hyphenation glitches from line-breaks in PDF
    t = t.replace(/\bîntr\s+-\s*un\b/gi, 'într-un');
    t = t.replace(/\bdintr\s+-\s*un\b/gi, 'dintr-un');
    t = t.replace(/\bprintr\s+-\s*un\b/gi, 'printr-un');
    t = t.replace(/\bîntr\s+-\s*o\b/gi, 'într-o');
    t = t.replace(/\bdintr\s+-\s*o\b/gi, 'dintr-o');
    t = t.replace(/\bprintr\s+-\s*o\b/gi, 'printr-o');
    t = t.replace(/\bs\s+-\s*a\b/gi, 's-a');
    t = t.replace(/\bs\s+-\s*au\b/gi, 's-au');
    t = t.replace(/\ble\s+-\s*a\b/gi, 'le-a');
    t = t.replace(/\bl\s+-\s*a\b/gi, 'l-a');
    t = t.replace(/\bp\s+-\s*s\b/gi, 'p-s');

    // Split word glitches
    t = t.replace(/\bafiș\s+area\b/gi, 'afișarea');
    t = t.replace(/\bafis\s+area\b/gi, 'afișarea');
    t = t.replace(/\bdif\s+erența\b/gi, 'diferența');
    t = t.replace(/\belement\s+e\b/gi, 'elemente');
    t = t.replace(/\bpurtă\s+tor\b/gi, 'purtător');
    t = t.replace(/\brepetițiea\b/gi, 'repetiția');
    t = t.replace(/\bpafități\b/gi, 'parități');
    t = t.replace(/\bfiecă\s+rui\b/gi, 'fiecărui');
    t = t.replace(/\bsecven\s+ței\b/gi, 'secvenței');
    t = t.replace(/\binstruc\s+țiunii\b/gi, 'instrucțiunii');

    return t;
}

// Clean options
function cleanOption(opt) {
    if (!opt || typeof opt !== 'string') return opt;
    let s = opt.trim();

    // Remove leading semicolons or commas
    s = s.replace(/^[;,\s]+/, '');

    // Case 1: "C++/C: ... Pascal: ..."
    if (/C\+\+\/C:\s*/i.test(s) && /Pascal:\s*/i.test(s)) {
        let parts = s.split(/Pascal:\s*/i);
        s = parts[0].replace(/^C\+\+\/C:\s*/i, '').trim();
    }

    // Case 2: Option starts with Pascal code ending in "a) <real option>"
    // E.g. "; Limbajul Pascal ... END. \r\n a) 8"
    let matchA = s.match(/(?:Limbajul\s*Pascal|BEGIN)[\s\S]*?\ba\)\s*(.*)$/i);
    if (matchA) {
        s = matchA[1].trim();
    }

    // Case 3: Option contains "Limbajul Pascal" or "Limbajul C" and extra options
    let matchEndLang = s.match(/[\s\S]*?(?=(?:Limbajul\s*Pascal|Limbajul\s*C)\b)/i);
    if (matchEndLang && matchEndLang[0].trim().length > 0 && /Limbajul\s*Pascal|Limbajul\s*C/i.test(s)) {
        // If the match at beginning has code/text, take that
        s = matchEndLang[0].trim();
    }

    // Remove Pascal comments or Pascal tags
    s = s.replace(/\{Pascal\}|\/\/Pascal/gi, '').trim();

    // Remove trailing page numbers: "variante 56", "variante 77", " 56", " 192"
    s = s.replace(/\s+(?:variante\s+)?\d{2,3}$/i, '').trim();

    // Remove stray leading "a) ", "b) ", etc. if mistakenly captured inside the option string
    s = s.replace(/^[a-f]\)\s*/i, '').trim();

    // Clean OCR typos
    s = cleanTextTypo(s);

    return s;
}

// Test detection of code in option
function isCodeOption(opt) {
    if (!opt || typeof opt !== 'string') return false;
    // Check if it looks like C++ statement or block
    if (opt.includes(';') && (
        /\b(int|float|char|double|long|unsigned|void)\b/.test(opt) ||
        /\b(cout|cin|for|while|return|if|else)\b/.test(opt) ||
        /\b(strcpy|strlen|strcat|strchr)\b/.test(opt) ||
        /\b(break|continue)\b/.test(opt)
    )) {
        return true;
    }
    return false;
}

let modifiedCount = 0;
let codeQuestionsCount = 0;

const cleanedQs = qs.map(q => {
    let changed = false;

    // 1. Text typo cleaning
    let newText = cleanTextTypo(q.text);
    if (newText !== q.text) {
        q.text = newText;
        changed = true;
    }

    // 2. Fix Fake Code in Question 1146 and 1155
    if (q.code && (/sau Pascal\s*\)/i.test(q.code) || /\/Pascal\s*\)/i.test(q.code))) {
        // Merge code into text
        let merged = q.code.replace(/sau Pascal\s*\)/i, 'C++)')
                           .replace(/\/Pascal\s*\)/i, 'C++)');
        q.text = (q.text.trim() + ' C++) ' + merged).replace(/\(\s*C\+\+\)/g, '(C++)');
        q.text = cleanTextTypo(q.text);
        q.code = null;
        q.type = 'choice';
        changed = true;
    }

    // 3. Clean options
    let opts = (q.options_json || []).map(opt => cleanOption(opt));
    
    // Check if options contain code
    let optionsHaveCode = opts.some(opt => isCodeOption(opt));

    if (optionsHaveCode) {
        // Format each code option line by line
        opts = opts.map(opt => {
            if (isCodeOption(opt)) {
                return formatCppSnippet(opt);
            }
            return opt;
        });
        // Make sure question is marked as code so student UI renders with monospace code-option style
        if (q.type !== 'code') {
            q.type = 'code';
            changed = true;
        }
    }

    if (JSON.stringify(opts) !== JSON.stringify(q.options_json)) {
        q.options_json = opts;
        changed = true;
    }

    // 4. Format question code if present
    if (q.code) {
        let formattedCode = formatCppSnippet(q.code);
        if (formattedCode !== q.code) {
            q.code = formattedCode;
            changed = true;
        }
        if (q.type !== 'code') {
            q.type = 'code';
            changed = true;
        }
    }

    // 5. Ensure exam_type is Poli
    if (q.exam_type !== 'Poli') {
        q.exam_type = 'Poli';
        changed = true;
    }

    if (q.type === 'code') codeQuestionsCount++;
    if (changed) modifiedCount++;

    return q;
});

console.log(`Total questions: ${cleanedQs.length}`);
console.log(`Questions modified: ${modifiedCount}`);
console.log(`Questions with type='code': ${codeQuestionsCount}`);

fs.writeFileSync('waiting_questions_fixed.json', JSON.stringify(cleanedQs, null, 2));
