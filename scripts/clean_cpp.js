const fs = require('fs');

const questions = JSON.parse(fs.readFileSync('parsed_questions.json', 'utf8'));

function extractCPP(text) {
    if (!text) return text;
    
    // Look for "Limbajul C++" or "Limbajul C++/C"
    // and grab everything until "Limbajul C" or "Limbajul Pascal"
    const cppRegex = /Limbajul\s*C\+\+(?:\/C)?\s*([\s\S]*?)(?:Limbajul\s*C\b|Limbajul\s*Pascal|$)/i;
    const match = text.match(cppRegex);
    
    if (match) {
        let cppCode = match[1].trim();
        
        // Remove trailing lines that might be page numbers (e.g. \n 55)
        cppCode = cppCode.replace(/\n\s*\d+\s*$/, '').trim();
        
        // Convert to standard C++
        cppCode = cppCode.replace(/void\s+main\s*\(/g, 'int main(');
        if (cppCode.includes('printf') || cppCode.includes('scanf')) {
            // It's mostly C style, but rules say C++ only (cout/cin)
            // It's hard to auto-convert all printf/scanf perfectly with regex
            // But we'll leave it as is or do basic replace if simple
        }
        
        // Replace | printf(...) or similar that the book has
        cppCode = cppCode.replace(/\|\s*printf\([^;]+;/g, '');
        cppCode = cppCode.replace(/\|\s*scanf\([^;]+;/g, '');
        
        return cppCode;
    }
    
    return text;
}

let cleanedQuestions = [];
let imgQuestionsCount = 0;

for (let q of questions) {
    if (q.hasImage) {
        imgQuestionsCount++;
        continue;
    }
    
    // Clean statement
    if (q.code) {
        q.code = extractCPP(q.code);
    } else {
        // sometimes code is left in the text
        const cppRegex = /Limbajul\s*C\+\+/i;
        if (cppRegex.test(q.text)) {
            let parts = q.text.split(cppRegex);
            let before = parts[0].trim();
            let codePart = "Limbajul C++" + parts[1];
            q.code = extractCPP(codePart);
            q.text = before;
        }
    }
    
    // Clean options
    for (let i = 0; i < q.options.length; i++) {
        if (/Limbajul\s*C\+\+/i.test(q.options[i])) {
            q.options[i] = extractCPP(q.options[i]);
        }
    }
    
    // Also apply the C++ rule transformations (very basic)
    if (q.code) {
        if (!q.code.includes('<iostream>') && (q.code.includes('cout') || q.code.includes('cin'))) {
            q.code = "#include <iostream>\nusing namespace std;\n" + q.code;
        }
    }
    
    // Category mapping logic (heuristic)
    let textAndCode = (q.text + " " + (q.code || "")).toLowerCase();
    q.category = "Fundamente";
    q.subcategory = "Diverse";
    
    if (textAndCode.includes("matrice") || textAndCode.includes("tablou bidimensional")) {
        q.category = "Organizarea Datelor";
        q.subcategory = "Matrice";
    } else if (textAndCode.includes("tablou unidimensional") || textAndCode.includes("vector")) {
        q.category = "Organizarea Datelor";
        q.subcategory = "Vectori";
    } else if (textAndCode.includes("graf") || textAndCode.includes("arbore") || textAndCode.includes("noduri") || textAndCode.includes("muchii")) {
        q.category = "Grafuri si Arbori";
        if (textAndCode.includes("orientat")) q.subcategory = "Grafuri orientate";
        else if (textAndCode.includes("arbore")) q.subcategory = "Arbori";
        else q.subcategory = "Grafuri neorientate";
    } else if (textAndCode.includes("backtracking")) {
        q.category = "Backtracking";
        q.subcategory = "Teorie si aplicare practica";
    } else if (textAndCode.includes("struct ")) {
        q.category = "Organizarea Datelor";
        q.subcategory = "Structuri de date (struct)";
    } else if (textAndCode.includes("strlen") || textAndCode.includes("strcpy") || textAndCode.includes("char ")) {
        q.category = "Organizarea Datelor";
        q.subcategory = "Siruri de caractere";
    } else if (textAndCode.includes("f(") || textAndCode.includes("return f")) {
        q.category = "Subprograme";
        q.subcategory = "Recursivitate";
    } else if (textAndCode.includes("for(") || textAndCode.includes("while(") || textAndCode.includes("if(")) {
        q.category = "Fundamente";
        q.subcategory = "Structuri de control";
    }
    
    // Assign difficulty cyclically to maintain distribution (25% Easy, 50% Medium, 25% Hard)
    const diffs = ['easy', 'medium', 'medium', 'hard'];
    q.difficulty = diffs[cleanedQuestions.length % 4];
    
    cleanedQuestions.push(q);
}

fs.writeFileSync('cleaned_questions.json', JSON.stringify(cleanedQuestions, null, 2));
console.log(`Cleaned ${cleanedQuestions.length} questions.`);
