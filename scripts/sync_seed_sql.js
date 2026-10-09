/**
 * Syncs seed.sql with audited questions.
 */
const fs = require('fs');
const path = require('path');

const questions = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../supabase_questions_audited.json'), 'utf8'));

function escapeSql(str) {
    if (str === null || str === undefined) return 'NULL';
    return "'" + String(str).replace(/'/g, "''") + "'";
}

function escapeJsonSql(obj) {
    if (!obj) return 'NULL';
    const jsonStr = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return "'" + jsonStr.replace(/'/g, "''") + "'::jsonb";
}

const header = [
    '-- ========================================================',
    '-- SEED DATA: ' + questions.length + ' Intrebari AcaDE-QUIZ (Supabase Synced & Audited)',
    '-- ========================================================',
    '',
    'TRUNCATE TABLE questions;',
    'INSERT INTO questions (id, difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, hint)',
    'VALUES'
].join('\n');

const rows = questions.map((q, idx) => {
    const isLast = idx === questions.length - 1;
    const term = isLast ? ';' : ',';
    return `(${q.id}, ${escapeSql(q.difficulty)}, ${escapeSql(q.type)}, ${escapeSql(q.category)}, ${escapeSql(q.subcategory)}, ${escapeSql(q.exam_type)}, ${escapeSql(q.text)}, ${escapeSql(q.image_url)}, ${escapeSql(q.code)}, ${escapeJsonSql(q.options_json)}, ${q.correct_index}, ${escapeSql(q.hint)})${term}`;
});

fs.writeFileSync(path.resolve(__dirname, '../seed.sql'), header + '\n' + rows.join('\n') + '\n', 'utf8');
console.log('seed.sql updated with ' + questions.length + ' audited questions.');
