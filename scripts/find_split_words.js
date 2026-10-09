const fs = require('fs');

const qs = JSON.parse(fs.readFileSync('waiting_questions_perfected.json', 'utf8'));

let potentialSplits = new Set();
let hyphenSplits = new Set();

qs.forEach(q => {
    let allText = q.text + ' ' + (q.options_json || []).join(' ');
    
    // Check hyphenated words: word - word
    let hMatches = allText.matchAll(/([a-zăâîșțA-ZĂÂÎȘȚ]{2,})\s+-\s+([a-zăâîșțA-ZĂÂÎȘȚ]{2,})/g);
    for (let m of hMatches) {
        hyphenSplits.add(m[0]);
    }

    // Check single letter separated from word: e.g. "reu șit", "diferenț a", "instrucțiun e"
    let sMatches = allText.matchAll(/\b([a-zăâîșțA-ZĂÂÎȘȚ]{1,3})\s+([a-zăâîșțA-ZĂÂÎȘȚ]{2,})\b/g);
    for (let m of sMatches) {
        let combined = (m[1] + m[2]).toLowerCase();
        // Check if combined is a common Romanian word
        const knownWords = ['reusit', 'reușit', 'promovat', 'elemente', 'afisat', 'afișat', 'afisare', 'afișare',
                            'diferenta', 'diferența', 'secventa', 'secvența', 'instrucțiune', 'instructiune',
                            'algoritm', 'valoarea', 'variabila', 'program', 'cuvinte', 'functie', 'funcție',
                            'grafuri', 'arbori', 'vectori', 'matrice', 'linie', 'coloana', 'coloană',
                            'numar', 'număr', 'numere', 'cifre', 'siruri', 'șiruri', 'caractere', 'subprogram'];
        if (knownWords.includes(combined)) {
            potentialSplits.add(m[0] + ' -> ' + combined);
        }
    }
});

console.log('Hyphen splits:', Array.from(hyphenSplits));
console.log('Potential word splits:', Array.from(potentialSplits));
