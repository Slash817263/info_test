const fs = require('fs');
const utils = require('../netlify/functions/_utils.js');

const rawQuestions = JSON.parse(fs.readFileSync('waiting_questions_from_db.json', 'utf8'));

// Format C++ snippet nicely
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

    // Normalize spaces
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

    // Indent lines
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

// Clean OCR typos
function cleanText(t) {
    if (!t || typeof t !== 'string') return t;
    return t
        .replace(/(^|[\s(])într\s*-\s*un([\s).,;:]|$)/gi, '$1într-un$2')
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
        .replace(/obținându\s*-\s*se/gi, 'obținându-se')
        .replace(/\bp\s*-\s*s\b/gi, 'p-s')
        .replace(/\bafiș\s+area\b/gi, 'afișarea')
        .replace(/\bafis\s+area\b/gi, 'afișarea')
        .replace(/\bdif\s+erența\b/gi, 'diferența')
        .replace(/\belement\s+e\b/gi, 'elemente')
        .replace(/\bpurtă\s+tor\b/gi, 'purtător')
        .replace(/\brepetițiea\b/gi, 'repetiția')
        .replace(/\bpafități\b/gi, 'parități')
        .replace(/\bfiecă\s+rui\b/gi, 'fiecărui')
        .replace(/\bsecven\s+ței\b/gi, 'secvenței')
        .replace(/\binstruc\s+țiunii\b/gi, 'instrucțiunii');
}

function cleanGeneralOption(opt) {
    if (!opt || typeof opt !== 'string') return opt;
    let s = opt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    // Remove leading semicolons or commas
    s = s.replace(/^[;,\s]+/, '');

    // Case 1: "C++/C: ... Pascal: ..."
    if (/C\+\+\/C\s*:\s*/i.test(s) && /Pascal\s*:/i.test(s)) {
        let parts = s.split(/Pascal\s*:/i);
        s = parts[0].replace(/^C\+\+\/C\s*:\s*/i, '').trim();
    }

    // Case 2: Option starts with Pascal block ending in a) <actual_option>
    let matchA = s.match(/(?:Limbajul\s*Pascal|BEGIN)[\s\S]*?\ba\)\s*([\s\S]*)$/i);
    if (matchA) {
        s = matchA[1].trim();
    }

    // Case 3: Option contains "Limbajul Pascal" or "Limbajul C"
    if (/Limbajul\s*Pascal|Limbajul\s*C\b/i.test(s)) {
        s = s.split(/Limbajul\s*Pascal|Limbajul\s*C\b/i)[0].trim();
    }

    // Case 4: Pascal syntax if (... and ...) then c:=a else c:=b
    if (/\s+if\s+[\s\S]*?\band\b[\s\S]*?\bthen\b[\s\S]*?:=/i.test(s)) {
        s = s.split(/\s+if\s+[\s\S]*?\band\b/i)[0].trim();
    }

    // Strip trailing page number: e.g. " 56", " 112", but preserve legitimate math or words
    s = s.replace(/\s+\d{2,3}$/, '').trim();

    // Strip stray option prefix: "a) ", "b) "
    s = s.replace(/^[a-f]\)\s*/i, '').trim();

    s = cleanText(s);
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

// Special hand-crafted fixes for the 15 PDF-column artifacts
const specialFixes = {
    1146: {
        text: "Se definește funcția:\nMnk = { Mn-1k + k * Mn-1k-1 pentru k > 0\n      1 pentru k = 0\nDacă se citesc numerele naturale n, k (n >= k) și se apelează funcția recursivă scrisă în limbajul C++ care evaluează funcția definită mai sus, valoarea calculată reprezintă:",
        code: null,
        type: "choice",
        options_json: [
            "produsul cartezian",
            "numărul submulțimilor unei mulțimi cu n elemente",
            "afișarea tuturor aranjamentelor mulțimii {1,2,...n} luate câte k",
            "numărul submulțimilor cu k elemente ale unei mulțimi cu n elemente",
            "afișarea tuturor combinărilor mulțimii {1,2,..,n} luate câte k",
            "nici una dintre aceste variante"
        ]
    },
    1147: {
        type: "code",
        code: "int a = ... , n;\nn = 16327;\nwhile (n != 0) {\n    switch (n % 10) {\n        case 0: case 2: case 4: case 6: case 8:\n            a = a + n % 2;\n            break;\n        case 1: case 3: case 5: case 7: case 9:\n            a = a - n % 2;\n            break;\n    }\n    n = n / 10;\n}\ncout << a << endl;",
        options_json: ["8", "nici una dintre variante", "9", "13", "10", "5"]
    },
    1155: {
        text: "Se definește recursiv o funcție care calculează numărul combinărilor de n luate câte k astfel:\nCnk = { (n-k+1)/k * Cnk-1 pentru k > 0\n      1 pentru k = 0\nDacă se citesc numerele naturale n, k (n >= k) și se apelează funcția recursivă scrisă în limbajul C++ care evaluează funcția definită mai sus, precizați care este numărul apelurilor necesare pentru a calcula Cnk:",
        code: null,
        type: "choice",
        options_json: ["n", "k", "k-1", "n+1", "n+k", "k+1"]
    },
    1157: {
        type: "code",
        code: "int a = 0, n;\ncin >> n;\ndo {\n    switch (n % 10) {\n        case 0: case 2: case 4: case 6: case 8:\n            a = a - (n % 2) * (n % 10);\n            break;\n        case 1: case 3: case 5: case 7: case 9:\n            a = a + (n % 2) * (n % 10);\n            break;\n    }\n    n = n / 10;\n} while (n != 0);\ncout << a << endl;",
        options_json: [
            "suma cifrelor numărului n",
            "numărul cifrelor impare din numărul n",
            "diferența dintre suma cifrelor pare și suma cifrelor impare din numărul n",
            "numărul cifrelor prime din numărul n",
            "suma cifrelor impare din numărul n",
            "diferența dintre suma cifrelor impare și suma cifrelor pare din numărul n"
        ]
    },
    1183: {
        type: "code",
        options_json: [
            "if (a > b && a % 2 == 0 || b >= a && b % 2 == 0)\n    c = a;\nelse\n    c = b;",
            "if (a > b && a % 2 == 0 || b % 2 == 0)\n    c = a;\nelse\n    c = b;",
            "if (a > b && a % 2 == 0 && b >= a && b % 2 == 0)\n    c = a;\nelse\n    c = b;",
            "if (a > b || a % 2 == 0 && b % 2 == 0)\n    c = a;\nelse\n    c = b;",
            "if (a > b || a % 2 == 0)\n    c = a;\nelse\n    c = b;",
            "if (a % 2 == 0 && b % 2 == 0)\n    c = a;\nelse\n    c = b;"
        ]
    },
    1190: {
        text: "Precizați valoarea variabilei a la finalul executării secvenței următoare de program.",
        type: "code",
        code: "char a[50] = \"dicarapetacul\";\nint i = 0, j = strlen(a) - 1;\nwhile (i <= j) {\n    if (a[i] == a[j]) {\n        a[i] = a[i + 1];\n        a[j] = a[j] + 1;\n    }\n    i++;\n    j--;\n}",
        options_json: [
            "diarraeetbdul",
            "diarrafetbdul",
            "diarraeetuuul",
            "diarraeetuuul",
            "diaraeetuuul",
            "diarrraeetuuul"
        ]
    },
    1192: {
        type: "code",
        options_json: [
            "n și i = i - 1;",
            "1 și i = i + 1;",
            "n și i = i + 1;",
            "0 și i = i + 1;",
            "n + 1 și i = i + 1;",
            "0 și i = i - 1;"
        ]
    },
    1193: {
        type: "code",
        options_json: [
            "if (a > b && a % 2 == 0 && b % 2 == 0)\n    c = a;\nif (a > b && a % 2 == 0 && b % 2 != 0)\n    c = b;",
            "if (a > b && a % 2 == 0 && b % 2 == 0)\n    c = a;\nelse\n    c = b;",
            "if (a > b && a % 2 == 0 && b % 2 == 0)\n    c = a;\nif (a < b && a % 2 != 0 && b % 2 != 0)\n    c = b;",
            "if (a > b && a % 2 == 0 && b % 2 == 0)\n    c = a;\nif (a <= b && a % 2 != 0 && b % 2 != 0)\n    c = b;",
            "if (a > b && a % 2 == 0 && b % 2 == 0)\n    c = a;",
            "if (a <= b && a % 2 != 0 && b % 2 != 0)\n    c = b;"
        ]
    },
    1199: {
        text: "Indicați valoarea variabilei a la finalul executării secvenței următoare de program.",
        type: "code",
        code: "char a[] = \"15iunie1970\";\nchar v[] = \"aeiouAEIOUn\";\nint i;\nfor (i = 0; i < strlen(a); i++)\n    if (a[i] >= '0' && a[i] <= '9')\n        a[i] = v[a[i] - '0'];",
        options_json: [
            "Eroare de compilare",
            "iEiunieinOe",
            "eAiunieeUIa",
            "152410211970",
            "EiunieinO",
            "AiunieeUI"
        ]
    },
    1207: {
        type: "code",
        options_json: [
            "int x, int y",
            "int &x, int &y",
            "int &x, int y",
            "int x, int &y",
            "int y, int &x",
            "int y, int x"
        ]
    },
    1228: {
        type: "choice",
        options_json: [
            "(x % 1000 == 0) || (x % 100 != 0)",
            "(x / 10 == 0) && (x / 100 == 0)",
            "(x % 10 == 0) && (x / 10 == 0)",
            "(x / 1000 == 0) && (x / 100 != 0)",
            "(x / 1000 == 0) || (x / 100 == 0)",
            "!((x / 1000 == 0) && (x / 100 != 0))"
        ]
    },
    1231: {
        type: "code",
        code: "struct coordonate {\n    int abscisa, ordonata;\n};\nint main() {\n    coordonate abscisa;\n    abscisa.abscisa = 100;\n    abscisa.ordonata = 200;\n    cout << abscisa.abscisa << \" \";\n    cout << abscisa.ordonata;\n    return 0;\n}",
        options_json: [
            "Programul nu va afișa nimic, va genera eroare de compilare deoarece numele variabilei de tip struct nu poate coincide cu numele câmpului.",
            "0 0",
            "100 200",
            "200 100",
            "100 100",
            "200 200"
        ]
    },
    1234: {
        type: "code",
        code: "int a = 5, b = 10, c = 15;\nvoid f(int a, int &b, int &c) {\n    a = a + 5;\n    b = b + 10;\n    c = c + 15;\n}\nint main() {\n    f(a, b, c);\n    f(a, a, b);\n    cout << \"a=\" << a;\n    cout << \"b=\" << b;\n    cout << \"c=\" << c;\n    return 0;\n}",
        options_json: [
            "a=5  b=5  c=20",
            "a=15 b=35 c=30",
            "a=10 b=20 c=30",
            "a=5  b=10 c=15",
            "a=15 b=5  c=30",
            "a=10 b=5  c=30"
        ]
    },
    1243: {
        type: "code",
        code: "int f() {\n    cout << 1 << \" \";\n    return 3;\n}\nint main() {\n    int s = 0, i;\n    for (i = 1; i <= f(); i++)\n        s = s + i;\n    cout << s;\n    return 0;\n}",
        options_json: [
            "Programul nu va afișa nimic, va genera eroare de compilare deoarece nu este permis apelul unei funcții ca valoare finală a contorului.",
            "1 1 1 1 6",
            "1 1 1 6",
            "1 1 6",
            "1 10",
            "1 0"
        ]
    },
    1244: {
        text: "Ce se va afișa pe ecran în urma execuției următorului program dacă de la tastatură se citește cuvântul caiet?",
        type: "code",
        code: "char a[255];\nint i, j, l, n;\ncin.get(a, 255);\ni = 0;\nn = strlen(a);\nwhile (i < n) {\n    if (strchr(\"aeiou\", a[i])) {\n        for (l = 1; l <= 2; l++) {\n            n++;\n            for (j = n; j > i; j--)\n                a[j] = a[j - 1];\n        }\n        a[i + 1] = 'p';\n        a[i + 2] = a[i];\n        i = i + 3;\n    } else {\n        i++;\n    }\n}\ncout << a;\nreturn 0;",
        options_json: [
            "cpapipet",
            "ct",
            "cpcapaipiepetpt",
            "capaipiepet",
            "tepeipiapac",
            "pcpaieptp"
        ]
    },
    1249: {
        type: "choice",
        options_json: [
            "a/c*2 < 5+c*4%5",
            "c%b == a%c",
            "b+a/10 != b%c*a/c",
            "(b>c) && !(b*c%7 == 2*a-b*b)",
            "c%b*10 < a*2",
            "c/b*b/c == 1"
        ]
    },
    1261: {
        type: "code",
        code: "void f(int &a, int b) {\n    int x = 3;\n    a--;\n    b++;\n    x--;\n    cout << a << ' ' << b << ' ' << x << ' ';\n}\nint main() {\n    int i, x = 4, y = 6;\n    for (i = 1; i <= 3; i++)\n        f(x, x + y);\n    cout << x << ' ' << y;\n    return 0;\n}",
        options_json: [
            "3 11 2 3 6",
            "3 11 2 4 6",
            "3 11 3 2 10 2 1 9 1 1 6",
            "2 11 2 0 9 0 -2 7 -2 -2 6",
            "3 11 2 3 11 2 3 11 2 4 6",
            "3 11 2 2 10 2 1 9 2 1 6"
        ]
    },
    1288: {
        text: "Știind că variabila i este de tip întreg și variabila a de tip șir de caractere reține cuvântul politehnica, în urma executării instrucțiunilor se va afișa:",
        type: "code",
        code: "for (i = 0; i <= 7; i++)\n    if (a[i] < 'n')\n        a[i] = 'A' - 'a' + a[i];\ncout << a;",
        options_json: [
            "poLItEHnICA",
            "POliTehnica",
            "POliTehnica",
            "POliTehNICA",
            "poliTEHNICA",
            "poLItEHnica"
        ]
    },
    1293: {
        text: "Știind că i, j, s și a sunt patru variabile de tip întreg, pentru orice valoare naturală nenulă a variabilei a, după executarea instrucțiunilor, valoarea afișată corespunde formulei matematice:",
        type: "code",
        code: "s = 0;\nfor (i = 1; i <= a; i++) {\n    j = 1;\n    while (j <= i) {\n        s++;\n        j++;\n    }\n    j = i + 1;\n    do {\n        s++;\n        j++;\n    } while (j <= a);\n}\ncout << s--;",
        options_json: [
            "a(a+1)",
            "a^2+1",
            "a^2",
            "a^2-1",
            "a(a-1)",
            "2a^2-1"
        ]
    },
    1354: {
        type: "choice",
        options_json: [
            "a = f(b, f(c, d));",
            "a = f(f(b, c), d);",
            "a = (b + c + d) / 2;",
            "a = f(b, c) + f(b, d);",
            "a = f(b, d) + c;",
            "a = (f(b, c) + f(b, d)) / 2;"
        ]
    },
    1397: {
        text: "Se consideră următoarea secvență de cod. Identificați ce se va afișa dacă de la tastatură se vor introduce, în ordine, șirurile de caractere student, carte și birou:",
        type: "code",
        code: "char a[256], b[256];\nint i;\nstrcpy(b, \"\");\nfor (i = 0; i < 3; i++) {\n    cin >> a;\n    strcat(b, a + i);\n}\ncout << b;",
        options_json: [
            "scb",
            "studencartbiro",
            "studentarterou",
            "studentcartbir",
            "tudenartiro",
            "tudentrteou"
        ]
    }
};

const perfectedQuestions = rawQuestions.map(q => {
    // Check if special fix exists
    if (specialFixes[q.id]) {
        const fix = specialFixes[q.id];
        if (fix.text !== undefined) q.text = fix.text;
        if (fix.code !== undefined) q.code = fix.code;
        if (fix.type !== undefined) q.type = fix.type;
        if (fix.options_json !== undefined) q.options_json = fix.options_json;
    } else {
        // General cleaning
        q.text = cleanText(q.text);

        // Options cleaning
        q.options_json = (q.options_json || []).map(opt => cleanGeneralOption(opt));

        // Format code in options if code
        const hasCodeOpts = q.options_json.some(opt => isCode(opt));
        if (hasCodeOpts) {
            q.type = 'code';
            q.options_json = q.options_json.map(opt => isCode(opt) ? formatCode(opt) : opt);
        }

        // Format question code if present
        if (q.code) {
            q.code = formatCode(q.code);
            q.type = 'code';
        }
    }

    // Always ensure exam_type is Poli
    q.exam_type = 'Poli';

    return q;
});

fs.writeFileSync('waiting_questions_perfected.json', JSON.stringify(perfectedQuestions, null, 2));
console.log('Processed all 320 questions into waiting_questions_perfected.json');
