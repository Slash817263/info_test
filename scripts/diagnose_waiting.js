const fs = require('fs');
const qs = JSON.parse(fs.readFileSync('waiting_questions_from_db.json', 'utf8'));

let stats = {
  total: qs.length,
  hasCode: 0,
  fakeCode: [],
  pascalInOptions: [],
  pageNumbersInOptions: [],
  codeInOptions: [],
  ocrHyphenGlitches: []
};

qs.forEach(q => {
  if (q.code) {
    stats.hasCode++;
    if (/sau Pascal|care evaluează|reprezintă|următoarea secvență/i.test(q.code)) {
      stats.fakeCode.push(q.id);
    }
  }
  let opts = q.options_json || [];
  let optsStr = JSON.stringify(opts);
  if (/Pascal|begin|end;|readln|writeln/i.test(optsStr)) {
    stats.pascalInOptions.push(q.id);
  }
  opts.forEach((opt, idx) => {
    if (/\s+\d{2,3}$/.test(opt.trim())) {
      stats.pageNumbersInOptions.push({ id: q.id, optIdx: idx, opt });
    }
  });
  if (/cin>>|cout<<|for\s*\(|while\s*\(|int\s+|void\s+|return\s+/i.test(optsStr)) {
    stats.codeInOptions.push(q.id);
  }
  if (/într\s+-un|dintr\s+-un|s\s+-a|le\s+-a/i.test(q.text + ' ' + (q.code || ''))) {
    stats.ocrHyphenGlitches.push(q.id);
  }
});

console.log({
  total: stats.total,
  hasCode: stats.hasCode,
  fakeCodeCount: stats.fakeCode.length,
  fakeCodeIds: stats.fakeCode,
  pascalInOptionsCount: stats.pascalInOptions.length,
  pascalInOptionsIds: stats.pascalInOptions,
  pageNumbersCount: stats.pageNumbersInOptions.length,
  codeInOptionsCount: stats.codeInOptions.length,
  ocrHyphenCount: stats.ocrHyphenGlitches.length
});
