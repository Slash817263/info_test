/**
 * Generates SQL patch comparing backup vs audited questions.
 */

const fs = require('fs');
const path = require('path');

function escapeSql(str) {
    if (str === null || str === undefined) return 'NULL';
    return "'" + String(str).replace(/'/g, "''") + "'";
}

function escapeJsonSql(obj) {
    if (!obj) return 'NULL';
    const jsonStr = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return "'" + jsonStr.replace(/'/g, "''") + "'::jsonb";
}

function generatePatch() {
    const backupPath = path.resolve(__dirname, '../supabase_questions_backup.json');
    const auditedPath = path.resolve(__dirname, '../supabase_questions_audited.json');

    const backupQuestions = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const auditedQuestions = JSON.parse(fs.readFileSync(auditedPath, 'utf8'));

    const auditedMap = new Map();
    auditedQuestions.forEach(q => auditedMap.set(q.id, q));

    const updateStatements = [];

    backupQuestions.forEach(oldQ => {
        const newQ = auditedMap.get(oldQ.id);
        if (!newQ) return;

        const diffChanged = oldQ.difficulty !== newQ.difficulty;
        const catChanged = oldQ.category !== newQ.category || oldQ.subcategory !== newQ.subcategory;
        const codeChanged = oldQ.code !== newQ.code;
        const hintChanged = (oldQ.hint || '') !== (newQ.hint || '');
        const corChanged = oldQ.correct_index !== newQ.correct_index;
        const optsChanged = JSON.stringify(oldQ.options_json) !== JSON.stringify(newQ.options_json);

        if (diffChanged || catChanged || codeChanged || hintChanged || corChanged || optsChanged) {
            const setClauses = [];
            if (diffChanged) setClauses.push(`difficulty = ${escapeSql(newQ.difficulty)}`);
            if (catChanged) {
                setClauses.push(`category = ${escapeSql(newQ.category)}`);
                setClauses.push(`subcategory = ${escapeSql(newQ.subcategory)}`);
            }
            if (codeChanged) setClauses.push(`code = ${escapeSql(newQ.code)}`);
            if (hintChanged) setClauses.push(`hint = ${escapeSql(newQ.hint)}`);
            if (corChanged) setClauses.push(`correct_index = ${newQ.correct_index}`);
            if (optsChanged) setClauses.push(`options_json = ${escapeJsonSql(newQ.options_json)}`);

            updateStatements.push(`UPDATE questions SET ${setClauses.join(', ')} WHERE id = ${oldQ.id};`);
        }
    });

    console.log(`Generated ${updateStatements.length} targeted UPDATE statements.`);

    const patchPath = path.resolve(__dirname, '../patch_supabase_questions.sql');
    const patchContent = [
        '-- ========================================================',
        '-- AcaDE-QUIZ: Supabase Full Audit & Logic Correction Patch',
        `-- Total updates: ${updateStatements.length}`,
        '-- ========================================================',
        'BEGIN;',
        '',
        updateStatements.join('\n'),
        '',
        'COMMIT;'
    ].join('\n');

    fs.writeFileSync(patchPath, patchContent, 'utf8');
    console.log(`SQL Patch written to: ${patchPath}`);
}

generatePatch();
