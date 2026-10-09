const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('C:\\Users\\Tudor\\.gemini\\antigravity\\brain\\4b96adcc-92c9-445e-97f6-662dc5907380\\.user_uploaded\\media_1789399749777.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('pdf_dump.txt', data.text);
    console.log('PDF dumped to pdf_dump.txt');
});
