const fs = require('fs');

const dump = fs.readFileSync('pdf_dump.txt', 'utf8');
const inDb = JSON.parse(fs.readFileSync('waiting_questions_455_raw.json', 'utf8'));
const cleaned = JSON.parse(fs.readFileSync('cleaned_questions.json', 'utf8'));
const recovered = JSON.parse(fs.readFileSync('newly_recovered_questions.json', 'utf8'));
const answers = JSON.parse(fs.readFileSync('parsed_answers.json', 'utf8'));

// 1. Build master lookup from PDF dump answers section
const ansIdx = 420504;
const answersText = dump.substring(ansIdx).replace(/Varianta\s*1\s*8/g, 'Varianta 18');

// Parse answers from raw text with regex
let rawBookAnswers = {};

for (let v = 11; v <= 46; v++) {
    const startStr = `Varianta ${v}`;
    const endStr = `Varianta ${v + 1}`;

    let startIndex = answersText.indexOf(startStr);
    let endIndex = v === 46 ? answersText.length : answersText.indexOf(endStr, startIndex + startStr.length);

    if (startIndex === -1) continue;
    let vText = answersText.substring(startIndex, endIndex);

    for (let q = 1; q <= 15; q++) {
        const qRegex = new RegExp(`(?:^|\\n)\\s*${q}\\.\\s*(?:[\\s\\S]*?R[aă]spuns corect\\s*:?\\s*([a-f])(?:\\)|\\s))`, 'i');
        let m = vText.match(qRegex);
        if (m) {
            let letter = m[1].toLowerCase();
            let idx = letter.charCodeAt(0) - 97;
            rawBookAnswers[`${v}_${q}`] = { letter, index: idx };
        }
    }
}

// Add manual known edge case in raw answers text (e.g. 29_3 where EXEMPLU preceded Răspuns corect)
rawBookAnswers['29_3'] = { letter: 'c', index: 2 };

console.log(`Loaded ${Object.keys(rawBookAnswers).length} raw book answers for variants 11-46.`);

// 2. Map every single DB question to (varianta, numar)
const first320CleanedWithAns = [];
for (let q of cleaned) {
    const ans = answers.find(a => a.varianta === q.varianta && a.numar === q.numar);
    if (ans) first320CleanedWithAns.push(q);
}

let mismatches = [];

for (let i = 0; i < 455; i++) {
    let dbQ = inDb[i];
    let v, nr;

    if (i < 320) {
        v = first320CleanedWithAns[i].varianta;
        nr = first320CleanedWithAns[i].numar;
    } else {
        v = recovered[i - 320].varianta;
        nr = recovered[i - 320].numar;
    }

    dbQ.varianta = v;
    dbQ.numar = nr;

    let bookAns = rawBookAnswers[`${v}_${nr}`];
    if (!bookAns) {
        mismatches.push({ id: dbQ.id, v, nr, reason: 'Book answer not found in raw dump' });
    } else if (dbQ.correct_index !== bookAns.index) {
        mismatches.push({
            id: dbQ.id,
            v,
            nr,
            dbIndex: dbQ.correct_index,
            bookLetter: bookAns.letter,
            bookIndex: bookAns.index,
            reason: 'Index mismatch'
        });
    }
}

console.log(`Answer Mismatches vs. Book: ${mismatches.length}`);
if (mismatches.length > 0) {
    console.log(JSON.stringify(mismatches, null, 2));
} else {
    console.log('ALL 455 QUESTIONS MATCH THE BOOK ANSWER KEY 100% PERFECTLY!');
}
