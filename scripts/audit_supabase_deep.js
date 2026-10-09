const fs = require('fs');
const path = require('path');

function getEnv() {
    const dotenv = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8');
    const env = {};
    dotenv.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
        }
    });
    return env;
}

const env = getEnv();
const url = env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY;
const anonKey = env.SUPABASE_KEY;

async function fetchSb(endpoint, key = serviceKey, options = {}) {
    const res = await fetch(`${url}/rest/v1/${endpoint}`, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });
    return res;
}

async function fetchAll(endpoint, key = serviceKey) {
    let all = [];
    let from = 0;
    const limit = 1000;
    while (true) {
        const sep = endpoint.includes('?') ? '&' : '?';
        const fullUrl = `${endpoint}${sep}offset=${from}&limit=${limit}`;
        const res = await fetchSb(fullUrl, key);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Fetch error on ${fullUrl}: ${res.status} - ${text}`);
        }
        const data = await res.json();
        all = all.concat(data);
        if (data.length < limit) break;
        from += limit;
    }
    return all;
}

async function runDeepAudit() {
    console.log('========================================================================');
    console.log('🔍 AUDIT SUPABASE LIVE – ACADE-QUIZ');
    console.log('========================================================================\n');

    const report = {
        rlsSecurity: {},
        tablesCount: {},
        questionsAudit: {},
        waitingAudit: {},
        studentsAudit: {},
        resultsAudit: {},
        assignedAudit: {},
        presetAudit: {},
        storageAudit: {}
    };

    // ------------------------------------------------------------------------
    // 1. RLS TEST (ANON KEY ACCESS)
    // ------------------------------------------------------------------------
    console.log('1️⃣  VERIFICARE ROW LEVEL SECURITY (RLS) CU CHEIA PUBLICĂ ANON...');
    const tablesToCheck = ['questions', 'waiting_questions', 'students', 'results', 'assigned_tests', 'preset_tests'];
    for (const table of tablesToCheck) {
        try {
            const res = await fetchSb(`${table}?select=id&limit=1`, anonKey);
            if (res.status === 200) {
                const data = await res.json();
                if (data.length === 0) {
                    report.rlsSecurity[table] = 'BLOCAT (200 OK cu 0 rânduri returnate - Politica RLS activă)';
                    console.log(`  🔒 ${table}: BLOCAT (0 rânduri pentru anon)`);
                } else {
                    report.rlsSecurity[table] = `⚠️ VULNERABIL: anon poate citi ${data.length} rânduri!`;
                    console.log(`  ⚠️ ${table}: VULNERABIL: anon poate citi date!`);
                }
            } else if (res.status === 401 || res.status === 403) {
                report.rlsSecurity[table] = `🔒 BLOCAT (${res.status} ${res.statusText})`;
                console.log(`  🔒 ${table}: BLOCAT (${res.status})`);
            } else {
                report.rlsSecurity[table] = `Status ${res.status}`;
                console.log(`  ℹ️  ${table}: Status ${res.status}`);
            }
        } catch (e) {
            report.rlsSecurity[table] = `Eroare verificare: ${e.message}`;
            console.log(`  ❌ ${table}: ${e.message}`);
        }
    }

    // ------------------------------------------------------------------------
    // 2. TOTALURI TABELE (SERVICE ROLE)
    // ------------------------------------------------------------------------
    console.log('\n2️⃣  EXTRAGERE TOTALURI TABELE (SERVICE ROLE)...');
    for (const table of tablesToCheck) {
        try {
            const res = await fetchSb(`${table}?select=id`, serviceKey, {
                headers: { 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' }
            });
            const contentRange = res.headers.get('content-range');
            if (contentRange && contentRange.includes('/')) {
                const total = contentRange.split('/')[1];
                report.tablesCount[table] = parseInt(total, 10);
                console.log(`  📊 ${table}: ${total} rânduri totale`);
            } else {
                const rows = await fetchAll(`${table}?select=id`);
                report.tablesCount[table] = rows.length;
                console.log(`  📊 ${table}: ${rows.length} rânduri (numărate direct)`);
            }
        } catch (e) {
            report.tablesCount[table] = `Eroare: ${e.message}`;
            console.log(`  ❌ ${table}: ${e.message}`);
        }
    }

    // Check leads table if exists
    try {
        const res = await fetchSb('leads?select=id&limit=1', serviceKey);
        if (res.ok) {
            const data = await res.json();
            console.log(`  📊 leads: Tabela există (verificat)`);
            report.tablesCount['leads'] = 'Exista';
        }
    } catch(e) {}

    // ------------------------------------------------------------------------
    // 3. AUDIT PROFUND TABELA QUESTIONS
    // ------------------------------------------------------------------------
    console.log('\n3️⃣  AUDIT APROFUNDAT: TABELA "questions"...');
    try {
        const questions = await fetchAll('questions?select=*', serviceKey);
        report.questionsAudit.total = questions.length;

        const categories = {};
        const subcategories = {};
        const difficulties = {};
        const examTypes = {};
        let missingText = 0;
        let invalidOptions = 0;
        let invalidCorrectIndex = 0;
        let withCode = 0;
        let withImages = 0;
        let withHints = 0;
        let shortHints = 0;
        let mathQuestions = 0;
        const textDuplicates = {};

        const CANONICAL_TAXONOMY = {
            "Fundamente": ["Citire si afisare date", "Operatori si expresii", "Structuri de control", "Complexitati", "Pseudocod"],
            "Organizarea Datelor": ["Vectori", "Matrice", "Siruri de caractere", "Structuri de date (struct)"],
            "Subprograme": ["Transmitere prin valoare", "Transmitere prin referinta", "Recursivitate"],
            "Backtracking": ["Teorie si aplicare practica"],
            "Grafuri si Arbori": ["Terminologie grafuri", "Grafuri orientate", "Grafuri neorientate", "Arbori"]
        };

        const taxonomyViolations = [];

        questions.forEach(q => {
            const cat = q.category || 'Lipsa';
            const sub = q.subcategory || 'Lipsa';
            const diff = q.difficulty || 'Lipsa';
            const et = q.exam_type || 'Lipsa';

            categories[cat] = (categories[cat] || 0) + 1;
            subcategories[`${cat} -> ${sub}`] = (subcategories[`${cat} -> ${sub}`] || 0) + 1;
            difficulties[diff] = (difficulties[diff] || 0) + 1;
            examTypes[et] = (examTypes[et] || 0) + 1;

            if (!CANONICAL_TAXONOMY[cat]) {
                taxonomyViolations.push({ id: q.id, issue: `Categorie necunoscuta: "${cat}"` });
            } else if (!CANONICAL_TAXONOMY[cat].includes(sub)) {
                taxonomyViolations.push({ id: q.id, issue: `Subcategorie necanonica "${sub}" in categoria "${cat}"` });
            }

            if (!q.text || q.text.trim().length === 0) missingText++;

            let opts = q.options_json;
            if (typeof opts === 'string') {
                try { opts = JSON.parse(opts); } catch (e) { opts = []; }
            }
            if (!Array.isArray(opts) || opts.length < 2 || opts.length > 6) {
                invalidOptions++;
            } else {
                const ci = parseInt(q.correct_index, 10);
                if (isNaN(ci) || ci < 0 || ci >= opts.length) {
                    invalidCorrectIndex++;
                }
            }

            if (q.code && q.code.trim().length > 0) withCode++;
            if (q.image_url && q.image_url.trim().length > 0) withImages++;
            if (q.hint && q.hint.trim().length > 0) {
                withHints++;
                if (q.hint.trim().length < 15) shortHints++;
            }
            if ((q.text && q.text.includes('$')) || (opts && opts.some(o => typeof o === 'string' && o.includes('$')))) {
                mathQuestions++;
            }

            // Duplicates check
            if (q.text) {
                const cleanText = q.text.trim().toLowerCase().replace(/\s+/g, ' ');
                if (!textDuplicates[cleanText]) textDuplicates[cleanText] = [];
                textDuplicates[cleanText].push(q.id);
            }
        });

        const realDuplicates = Object.entries(textDuplicates).filter(([k, ids]) => ids.length > 1);

        report.questionsAudit.categories = categories;
        report.questionsAudit.difficulties = difficulties;
        report.questionsAudit.examTypes = examTypes;
        report.questionsAudit.taxonomyViolationsCount = taxonomyViolations.length;
        report.questionsAudit.taxonomyViolations = taxonomyViolations.slice(0, 10);
        report.questionsAudit.invalidOptions = invalidOptions;
        report.questionsAudit.invalidCorrectIndex = invalidCorrectIndex;
        report.questionsAudit.withCode = withCode;
        report.questionsAudit.withImages = withImages;
        report.questionsAudit.withHints = withHints;
        report.questionsAudit.shortHints = shortHints;
        report.questionsAudit.mathQuestions = mathQuestions;
        report.questionsAudit.duplicatesCount = realDuplicates.length;
        report.questionsAudit.duplicateClusters = realDuplicates.map(([k, ids]) => ids);

        console.log(`  Total întrebări active: ${questions.length}`);
        console.log(`  Categorii:`, categories);
        console.log(`  Dificultăți:`, difficulties);
        console.log(`  Tipuri de examen:`, examTypes);
        console.log(`  Violări taxonomie canonică: ${taxonomyViolations.length}`);
        console.log(`  Opțiuni invalide (<2 sau >6): ${invalidOptions}`);
        console.log(`  Indici corecți invalizi (out-of-bounds): ${invalidCorrectIndex}`);
        console.log(`  Întrebări cu cod C++: ${withCode}`);
        console.log(`  Întrebări cu imagini: ${withImages}`);
        console.log(`  Întrebări cu KaTeX: ${mathQuestions}`);
        console.log(`  Duplicate exacte text: ${realDuplicates.length} grupuri`);
    } catch (e) {
        console.error('  Eroare audit questions:', e);
    }

    // ------------------------------------------------------------------------
    // 4. AUDIT WAITING_QUESTIONS
    // ------------------------------------------------------------------------
    console.log('\n4️⃣  AUDIT: TABELA "waiting_questions"...');
    try {
        const waiting = await fetchAll('waiting_questions?select=*', serviceKey);
        report.waitingAudit.total = waiting.length;
        const waitingCats = {};
        const waitingExams = {};
        let waitingBadOpts = 0;
        let waitingBadIndex = 0;

        waiting.forEach(q => {
            const cat = q.category || 'Lipsa';
            const ex = q.exam_type || 'Lipsa';
            waitingCats[cat] = (waitingCats[cat] || 0) + 1;
            waitingExams[ex] = (waitingExams[ex] || 0) + 1;

            let opts = q.options_json;
            if (typeof opts === 'string') {
                try { opts = JSON.parse(opts); } catch (e) { opts = []; }
            }
            if (!Array.isArray(opts) || opts.length < 2) waitingBadOpts++;
            else {
                const ci = parseInt(q.correct_index, 10);
                if (isNaN(ci) || ci < 0 || ci >= opts.length) waitingBadIndex++;
            }
        });

        report.waitingAudit.categories = waitingCats;
        report.waitingAudit.examTypes = waitingExams;
        report.waitingAudit.badOpts = waitingBadOpts;
        report.waitingAudit.badIndex = waitingBadIndex;

        console.log(`  Total în așteptare: ${waiting.length}`);
        console.log(`  Categorii în așteptare:`, waitingCats);
        console.log(`  Tip examen în așteptare:`, waitingExams);
        console.log(`  Opțiuni defecte: ${waitingBadOpts}`);
        console.log(`  Indici corecți defecți: ${waitingBadIndex}`);
    } catch (e) {
        console.error('  Eroare audit waiting_questions:', e);
    }

    // ------------------------------------------------------------------------
    // 5. AUDIT TABELA STUDENTS
    // ------------------------------------------------------------------------
    console.log('\n5️⃣  AUDIT: TABELA "students"...');
    try {
        const students = await fetchAll('students?select=*', serviceKey);
        report.studentsAudit.total = students.length;
        let scryptCount = 0;
        let plaintextCount = 0;
        let expiredCount = 0;
        let validPhoneCount = 0;
        let malformedPhoneCount = 0;
        let nullExpiresCount = 0;

        const nowIso = new Date().toISOString().split('T')[0];

        students.forEach(s => {
            if (s.password_hash && s.password_hash.startsWith('$scrypt$')) {
                scryptCount++;
            } else {
                plaintextCount++;
            }

            if (s.phone_number) {
                if (/^07\d{8}$/.test(s.phone_number.trim())) {
                    validPhoneCount++;
                } else {
                    malformedPhoneCount++;
                }
            }

            if (!s.expires_at) {
                nullExpiresCount++;
            } else {
                const exp = String(s.expires_at);
                if (exp < nowIso) expiredCount++;
            }
        });

        report.studentsAudit.scryptCount = scryptCount;
        report.studentsAudit.plaintextCount = plaintextCount;
        report.studentsAudit.validPhoneCount = validPhoneCount;
        report.studentsAudit.malformedPhoneCount = malformedPhoneCount;
        report.studentsAudit.nullExpiresCount = nullExpiresCount;
        report.studentsAudit.expiredCount = expiredCount;

        console.log(`  Total elevi: ${students.length}`);
        console.log(`  Parole cu hash securizat scrypt: ${scryptCount}`);
        console.log(`  Parole legacy plaintext: ${plaintextCount}`);
        console.log(`  Numere de telefon validate (07XXXXXXXX): ${validPhoneCount}`);
        console.log(`  Numere de telefon ne-normalizate: ${malformedPhoneCount}`);
        console.log(`  Abonamente expirate: ${expiredCount}`);
        console.log(`  Abonamente nelimitate/fara data: ${nullExpiresCount}`);
    } catch (e) {
        console.error('  Eroare audit students:', e);
    }

    // ------------------------------------------------------------------------
    // 6. AUDIT TABELA RESULTS
    // ------------------------------------------------------------------------
    console.log('\n6️⃣  AUDIT: TABELA "results"...');
    try {
        const results = await fetchAll('results?select=id,test_type,student_username,created_at,score', serviceKey);
        report.resultsAudit.total = results.length;

        const typeBreakdown = {};
        let progressRows = 0;
        let coverageRows = 0;

        results.forEach(r => {
            const t = r.test_type || 'Fara_tip';
            typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
            if (t.startsWith('progress_')) progressRows++;
            if (t === 'category_coverage') coverageRows++;
        });

        report.resultsAudit.typeBreakdown = typeBreakdown;
        report.resultsAudit.progressRows = progressRows;
        report.resultsAudit.coverageRows = coverageRows;

        console.log(`  Total rezultate înregistrate: ${results.length}`);
        console.log(`  Rânduri temporare active (progress_*): ${progressRows}`);
        console.log(`  Rânduri acoperire materie (category_coverage): ${coverageRows}`);
        console.log(`  Distribuție tipuri de teste:`, typeBreakdown);
    } catch (e) {
        console.error('  Eroare audit results:', e);
    }

    // ------------------------------------------------------------------------
    // 7. AUDIT TABELA ASSIGNED_TESTS & PRESET_TESTS
    // ------------------------------------------------------------------------
    console.log('\n7️⃣  AUDIT: "assigned_tests" & "preset_tests"...');
    try {
        const assigned = await fetchAll('assigned_tests?select=*', serviceKey);
        const presets = await fetchAll('preset_tests?select=*', serviceKey);

        const assignedStatus = {};
        assigned.forEach(a => {
            assignedStatus[a.status || 'unknown'] = (assignedStatus[a.status || 'unknown'] || 0) + 1;
        });

        report.assignedAudit.total = assigned.length;
        report.assignedAudit.status = assignedStatus;
        report.presetAudit.total = presets.length;

        console.log(`  Total teme asignate: ${assigned.length}`);
        console.log(`  Statusuri teme:`, assignedStatus);
        console.log(`  Total teste predefinite: ${presets.length}`);
        presets.forEach(p => {
            const qCount = Array.isArray(p.questions_ids) ? p.questions_ids.length : 0;
            console.log(`    - [${p.exam_type}] "${p.title}": ${qCount} întrebări`);
        });
    } catch (e) {
        console.error('  Eroare audit assigned/presets:', e);
    }

    // ------------------------------------------------------------------------
    // 8. AUDIT STORAGE BUCKETS
    // ------------------------------------------------------------------------
    console.log('\n8️⃣  AUDIT: SUPABASE STORAGE (BUCKET "images")...');
    try {
        const storageRes = await fetch(`${url}/storage/v1/bucket/images`, {
            headers: { 'Authorization': `Bearer ${serviceKey}` }
        });
        if (storageRes.ok) {
            const bInfo = await storageRes.json();
            console.log(`  Bucket "images" există: Public = ${bInfo.public}`);
            report.storageAudit.bucket = bInfo;

            // List files in bucket
            const listRes = await fetch(`${url}/storage/v1/object/list/images`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ limit: 100, prefix: '' })
            });
            if (listRes.ok) {
                const files = await listRes.json();
                console.log(`  Fișiere găsite în bucket images: ${files.length}`);
                report.storageAudit.filesCount = files.length;
            }
        } else {
            console.log(`  Bucket "images" status: ${storageRes.status} (poate nu e configurat ca bucket separat)`);
        }
    } catch (e) {
        console.log(`  Storage audit error: ${e.message}`);
    }

    console.log('\n========================================================================');
    console.log('✅ AUDIT SUPABASE LIVE FINALIZAT');
    console.log('========================================================================');

    fs.writeFileSync(path.resolve(__dirname, '../scratch/supabase_live_audit_report.json'), JSON.stringify(report, null, 2));
}

runDeepAudit().catch(err => {
    console.error('FATAL AUDIT ERROR:', err);
    process.exit(1);
});
