const fs = require('fs');

const rawText = fs.readFileSync('pdf_dump.txt', 'utf8');

// The text has "Varianta 11" to "Varianta 46"
// And later "Indicații și răspunsuri" -> "Varianta 11" ...

const variants = [];
for (let i = 11; i <= 46; i++) {
    variants.push(i);
}

// Regex to find variants in main text
// We split the document into "Main Questions" and "Answers"
const answerSectionIndex = rawText.indexOf("INDICAȚII ȘI RĂSPUNSURI");
const mainText = rawText.substring(0, answerSectionIndex);
const answersText = rawText.substring(answerSectionIndex);

let questions = [];
let questionsWithImages = [];

for (let v = 11; v <= 46; v++) {
    const startStr = `Varianta ${v}`;
    const endStr = `Varianta ${v + 1}`;
    
    let startIndex = mainText.indexOf(startStr);
    let endIndex = v === 46 ? mainText.length : mainText.indexOf(endStr, startIndex + startStr.length);
    
    if (startIndex === -1) {
        console.log(`Varianta ${v} not found!`);
        continue;
    }
    
    let variantText = mainText.substring(startIndex, endIndex);
    
    // Split by question numbers: "1. ", "2. ", ..., "15. "
    // Note: there might be lines starting with numbers, so we use a strict regex
    for (let q = 1; q <= 15; q++) {
        const qStartRegex = new RegExp(`(?:^|\\n)\\s*${q}\\.\\s+`, 'g');
        const qEndRegex = new RegExp(`(?:^|\\n)\\s*${q + 1}\\.\\s+`, 'g');
        
        qStartRegex.lastIndex = 0;
        let matchStart = qStartRegex.exec(variantText);
        if (!matchStart) {
            console.log(`Question ${q} from Varianta ${v} not found!`);
            continue;
        }
        
        let qStartIndex = matchStart.index + matchStart[0].length;
        let qEndIndex = variantText.length;
        
        if (q < 15) {
            qEndRegex.lastIndex = 0;
            let matchEnd = qEndRegex.exec(variantText.substring(qStartIndex));
            if (matchEnd) {
                qEndIndex = qStartIndex + matchEnd.index;
            }
        }
        
        let qText = variantText.substring(qStartIndex, qEndIndex).trim();
        
        // Extract C++ code
        let cppCode = null;
        let hasImage = false;
        
        // Check for image keywords
        const imageKeywords = ['alaturat', 'alăturat', 'figura', 'desen', 'graficul', 'mai jos', 'tabelul alaturat'];
        const lowerQText = qText.toLowerCase();
        for (const kw of imageKeywords) {
            if (lowerQText.includes(kw)) {
                hasImage = true;
                break;
            }
        }
        
        // Find options: a) b) c) d) e) f)
        const optionsRegex = /a\)(.*?)b\)(.*?)c\)(.*?)d\)(.*?)e\)(.*?)f\)(.*)/is;
        const optionsMatch = qText.match(optionsRegex);
        
        let options = [];
        let statement = qText;
        
        if (optionsMatch) {
            statement = qText.substring(0, optionsMatch.index).trim();
            options = [
                optionsMatch[1].trim(),
                optionsMatch[2].trim(),
                optionsMatch[3].trim(),
                optionsMatch[4].trim(),
                optionsMatch[5].trim(),
                optionsMatch[6].trim()
            ];
        } else {
            hasImage = true; // If we can't parse options easily, it's likely complex formatting/images
        }
        
        // Extract C++ logic from statement
        let finalStatement = statement;
        const cpppRegex = /Limbajul C\+\+\/C|Limbajul C\+\+|C\+\+\/C/i;
        const cppMatch = statement.match(cpppRegex);
        
        if (cppMatch) {
            let codeStart = cppMatch.index + cppMatch[0].length;
            // Stop at Limbajul Pascal or Limbajul C
            const endCodeRegex = /Limbajul Pascal|Limbajul C\b/i;
            const endCodeMatch = statement.substring(codeStart).match(endCodeRegex);
            
            if (endCodeMatch) {
                cppCode = statement.substring(codeStart, codeStart + endCodeMatch.index).trim();
            } else {
                cppCode = statement.substring(codeStart).trim();
            }
            finalStatement = statement.substring(0, cppMatch.index).trim();
        }
        
        const questionObj = {
            varianta: v,
            numar: q,
            text: finalStatement,
            code: cppCode,
            options: options,
            hasImage: hasImage
        };
        
        if (hasImage) {
            questionsWithImages.push(questionObj);
        } else {
            questions.push(questionObj);
        }
    }
}

console.log(`Parsed ${questions.length} text questions and ${questionsWithImages.length} image questions.`);
fs.writeFileSync('parsed_questions.json', JSON.stringify(questions, null, 2));
fs.writeFileSync('questions_with_images.json', JSON.stringify(questionsWithImages, null, 2));

// Parse answers
let answersList = [];
for (let v = 11; v <= 46; v++) {
    const startStr = `Varianta ${v}`;
    const endStr = `Varianta ${v + 1}`;
    
    let startIndex = answersText.indexOf(startStr);
    let endIndex = v === 46 ? answersText.length : answersText.indexOf(endStr, startIndex + startStr.length);
    
    if (startIndex === -1) continue;
    let vAnswersText = answersText.substring(startIndex, endIndex);
    
    for (let q = 1; q <= 15; q++) {
        const qStartRegex = new RegExp(`(?:^|\\n)\\s*${q}\\.\\s+R.spuns corect\\s*:?\\s*([a-f])(?:\\)|\\s)`, 'i');
        let match = vAnswersText.match(qStartRegex);
        if (!match) {
            // Try without the dot after number
            const altRegex = new RegExp(`(?:^|\\n)\\s*${q}\\s*R.spuns corect\\s*:?\\s*([a-f])(?:\\)|\\s)`, 'i');
            match = vAnswersText.match(altRegex);
        }
        if (match) {
            let correctLetter = match[1].toLowerCase();
            let correctIndex = correctLetter.charCodeAt(0) - 97; // a -> 0
            
            // Extract hint
            let hint = null;
            let nextLineIndex = vAnswersText.indexOf('\n', match.index);
            let nextQIndex = vAnswersText.length;
            const nextQRegex = new RegExp(`(?:^|\\n)\\s*${q + 1}\\.\\s+R.spuns`, 'i');
            let nextQMatch = vAnswersText.substring(nextLineIndex).match(nextQRegex);
            if (nextQMatch) {
                nextQIndex = nextLineIndex + nextQMatch.index;
            }
            
            let possibleHint = vAnswersText.substring(nextLineIndex, nextQIndex).trim();
            if (possibleHint.toLowerCase().startsWith('indica?ii:') || possibleHint.toLowerCase().startsWith('indica?ie:')) {
                hint = possibleHint.replace(/^indica\?ii?:/i, '').trim();
            }
            
            answersList.push({
                varianta: v,
                numar: q,
                correct_index: correctIndex,
                hint: hint
            });
        }
    }
}

fs.writeFileSync('parsed_answers.json', JSON.stringify(answersList, null, 2));
console.log(`Parsed ${answersList.length} answers.`);
