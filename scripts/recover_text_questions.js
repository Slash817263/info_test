const fs = require('fs');

const withImages = JSON.parse(fs.readFileSync('questions_with_images.json', 'utf8'));
const answers = JSON.parse(fs.readFileSync('parsed_answers.json', 'utf8'));
const inDb = JSON.parse(fs.readFileSync('waiting_questions_finalized.json', 'utf8'));

// Check for real visual references
function hasVisualImage(q) {
    let text = q.text || '';
    let code = q.code || '';
    let all = (text + ' ' + code).toLowerCase();

    // Explicit visual indicators
    if (/figur[aă]|desen|din desen|în desen|tabelul al[aă]turat|graful al[aă]turat|matricea al[aă]turat[aă]|arborele din|arborele al[aă]turat/i.test(all)) {
        return { hasImg: true, reason: 'visual keyword' };
    }

    // If options are missing or less than 4
    if (!q.options || q.options.length < 4) {
        return { hasImg: true, reason: 'incomplete options' };
    }

    // If options are matrices/diagrams that couldn't be parsed properly
    let optStr = q.options.join(' ');
    if (/^\s*[a-f]\)\s*$/m.test(optStr)) {
        return { hasImg: true, reason: 'empty options' };
    }

    return { hasImg: false };
}

let images = [];
let recoverable = [];

withImages.forEach(q => {
    let res = hasVisualImage(q);
    if (res.hasImg) {
        images.push({ ...q, imgReason: res.reason });
    } else {
        recoverable.push(q);
    }
});

console.log('Real Image Questions:', images.length);
console.log('Recoverable Text/Code Questions:', recoverable.length);

fs.writeFileSync('true_image_questions.json', JSON.stringify(images, null, 2));
fs.writeFileSync('recoverable_text_questions.json', JSON.stringify(recoverable, null, 2));
