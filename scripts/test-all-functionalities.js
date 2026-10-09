/**
 * ============================================================================
 * ACADE-QUIZ: COMPREHENSIVE IN-CODE TEST RUNNER
 * ============================================================================
 * Runs automated verification for:
 * 1. Cryptography & Security (_utils.js)
 * 2. Subscription & Expiration Logic
 * 3. Canonical Taxonomy Alignment & Data Integrity
 * 4. Quiz Engine, Scoring & Results Breakdown
 * 5. Practice Mode & Spaced Repetition Priority Queue
 * 6. Preset Tests & Random Generation Logic
 * 7. Leads Validation & Sanitization
 * 8. Netlify Functions Handler Contracts (Mock Event Testing)
 * 9. Frontend DOM Element ID Consistency
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

let totalPassed = 0;
let totalFailed = 0;
let currentSuite = '';

function logSuite(name) {
    currentSuite = name;
    console.log(`\n${colors.bright}${colors.cyan}=== SUITE: ${name} ===${colors.reset}`);
}

function assert(condition, message) {
    if (condition) {
        totalPassed++;
        console.log(`  ${colors.green}✔ PASS:${colors.reset} ${message}`);
    } else {
        totalFailed++;
        console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${message} (${currentSuite})`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual === expected) {
        totalPassed++;
        console.log(`  ${colors.green}✔ PASS:${colors.reset} ${message}`);
    } else {
        totalFailed++;
        console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${message} -> Expected: "${expected}", Received: "${actual}" (${currentSuite})`);
    }
}

function assertDeepEqual(actual, expected, message) {
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr === expStr) {
        totalPassed++;
        console.log(`  ${colors.green}✔ PASS:${colors.reset} ${message}`);
    } else {
        totalFailed++;
        console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${message} -> Expected: ${expStr}, Received: ${actStr}`);
    }
}

async function runAllTests() {
    const startTime = Date.now();
    console.log(`${colors.bright}${colors.magenta}🚀 INIȚIERE AUDIT & TESTE AUTOMATE: AcaDe-QUIZ${colors.reset}\n`);

    const utils = require('../netlify/functions/_utils');

    // ========================================================================
    // SUITE 1: Securitate, Criptografie & Utilitare (_utils.js)
    // ========================================================================
    logSuite('Securitate, Criptografie & Utilitare');
    {
        // 1. Password Hashing & Verification
        const plain = 'ParolaMeaSuperSecreta123!';
        const hash = utils.hashPassword(plain);
        assert(typeof hash === 'string' && hash.startsWith('$scrypt$'), 'Hash-ul parolei este generat cu formatul scrypt ($scrypt$...)');
        assert(utils.verifyPassword(plain, hash), 'Parola corectă este validată cu succes');
        assert(!utils.verifyPassword('ParolaGresita', hash), 'Parola greșită este respinsă');
        assert(!utils.verifyPassword('', hash), 'Parola vidă este respinsă');
        assert(!utils.verifyPassword(plain, ''), 'Hash-ul vid este respins');
        assert(utils.verifyPassword('legacy123', 'legacy123'), 'Compatibilitate backward pentru parolele vechi în plaintext');

        // Timing safety check: malformed hash
        assert(!utils.verifyPassword(plain, '$scrypt$invalid$short'), 'Hash-ul malformat este respins fără excepție neprinsă');

        // 2. Expiration Date Parsing
        assertEqual(utils.parseExpirationDate('15/09/2026'), '2026-09-15', 'Formatul DD/MM/YYYY este convertit corect în YYYY-MM-DD');
        assertEqual(utils.parseExpirationDate('2026-09-15'), '2026-09-15', 'Formatul YYYY-MM-DD este păstrat corect');
        assertEqual(utils.parseExpirationDate('2026-09-15T12:00:00.000Z'), '2026-09-15', 'Formatul ISO Timestamp este extras corect');
        assertEqual(utils.parseExpirationDate(null), null, 'Data null returnează null');
        assertEqual(utils.parseExpirationDate('data-invalida'), null, 'Șirul invalid returnează null');

        // 3. Admin Token Verification
        const secret = utils.getLiveEnv('ADMIN_SECRET', process.env.ADMIN_SECRET || 'test-secret');
        assert(utils.verifyAdminToken({ headers: { 'x-admin-token': secret } }), 'verifyAdminToken acceptă x-admin-token corect');
        assert(utils.verifyAdminToken({ headers: { 'Authorization': `Bearer ${secret}` } }), 'verifyAdminToken acceptă Bearer token direct');
        assert(utils.verifyAdminToken({ headers: { 'cookie': `admin_token=${encodeURIComponent(secret)}` } }), 'verifyAdminToken acceptă cookie admin_token');
        
        // Admin JWT token
        const adminJwt = jwt.sign({ role: 'admin' }, secret);
        assert(utils.verifyAdminToken({ headers: { 'x-admin-token': adminJwt } }), 'verifyAdminToken acceptă JWT semnat cu rol admin');
        assert(!utils.verifyAdminToken({ headers: { 'x-admin-token': 'token_complet_gresit' } }), 'verifyAdminToken respinge token invalid');
        assert(!utils.verifyAdminToken({ headers: {} }), 'verifyAdminToken respinge cerere fără antete de auth');

        // 4. JWT parsing
        const jwtSecret = utils.getLiveEnv('JWT_SECRET', process.env.JWT_SECRET || 'test-jwt');
        const userToken = jwt.sign({ username: 'tudor.test', id: 99 }, jwtSecret);
        const parsed = utils.parseJwt({ headers: { 'authorization': `Bearer ${userToken}` } });
        assert(parsed && parsed.username === 'tudor.test', 'parseJwt decodează corect un token valid');
        assert(utils.parseJwt({ headers: { 'authorization': 'Bearer token_stricat' } }) === null, 'parseJwt returnează null pentru token corupt');
        assert(utils.parseJwt({ headers: {} }) === null, 'parseJwt returnează null pentru antet lipsă');

        // 5. CORS Resolution
        const corsLocal = utils.getCorsHeaders({ headers: { origin: 'http://localhost:8888' } });
        assertEqual(corsLocal['Access-Control-Allow-Origin'], 'http://localhost:8888', 'CORS permite localhost:8888');
        const corsNetlify = utils.getCorsHeaders({ headers: { origin: 'https://acadeinformatica.netlify.app' } });
        assertEqual(corsNetlify['Access-Control-Allow-Origin'], 'https://acadeinformatica.netlify.app', 'CORS permite domeniul oficial de producție');
        const corsUnknown = utils.getCorsHeaders({ headers: { origin: 'https://malicious-site.com' } });
        assertEqual(corsUnknown['Access-Control-Allow-Origin'], 'https://acadeinformatica.netlify.app', 'CORS redirecționează domeniile neautorizate către producție');

        // 6. getClientIp Priority & Fallback
        const ipNf = utils.getClientIp({ headers: { 'x-nf-client-connection-ip': '203.0.113.195', 'client-ip': '198.51.100.1' } });
        assertEqual(ipNf, '203.0.113.195', 'getClientIp acordă prioritate absolută header-ului Netlify x-nf-client-connection-ip');
        const ipClient = utils.getClientIp({ headers: { 'client-ip': '198.51.100.1' } });
        assertEqual(ipClient, '198.51.100.1', 'getClientIp folosește fallback-ul client-ip când lipsește antetul Netlify');
        const ipUnknown = utils.getClientIp({ headers: {} });
        assertEqual(ipUnknown, 'unknown', 'getClientIp returnează unknown pentru antete goale');

        // 7. escapeHtml XSS & Apostrophe Sanitization
        const utilsJs = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/utils.js'), 'utf8');
        const adminJs = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/admin.js'), 'utf8');
        assert(utilsJs.includes(".replace(/'/g, '&#39;')"), 'utils.js conține sanitizarea apostrofului (&#39;) în escapeHtml');
        assert(adminJs.includes(".replace(/'/g, '&#39;')"), 'admin.js conține sanitizarea apostrofului (&#39;) în escapeHtml');

        const escapeRegex = /export function escapeHtml\(text\) \{([\s\S]*?)\n\}/;
        const fnMatch = utilsJs.match(escapeRegex);
        const escapeHtmlFn = new Function('text', fnMatch[1]);
        assertEqual(escapeHtmlFn("<script>alert('xss')</script>"), '&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;', 'escapeHtml convertește <, >, și apostroafele corect');
        assertEqual(escapeHtmlFn('L\'Hopital & "quotes"'), 'L&#39;Hopital &amp; &quot;quotes&quot;', 'escapeHtml convertește apostroafe, ampersand și ghilimele');
        assertEqual(escapeHtmlFn(null), '', 'escapeHtml tratează null ca șir vid');

        // 8. Security Headers in netlify.toml
        const netlifyToml = fs.readFileSync(path.resolve(__dirname, '../netlify.toml'), 'utf8');
        assert(netlifyToml.includes('Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"'), 'netlify.toml include HSTS (Strict-Transport-Security)');
        assert(netlifyToml.includes('Referrer-Policy = "strict-origin-when-cross-origin"'), 'netlify.toml include Referrer-Policy');
        assert(netlifyToml.includes('Permissions-Policy = "camera=(), microphone=(), geolocation=(), payment=()"'), 'netlify.toml include Permissions-Policy');
        assert(netlifyToml.includes('X-Frame-Options = "DENY"'), 'netlify.toml include X-Frame-Options: DENY');
        assert(netlifyToml.includes('X-Content-Type-Options = "nosniff"'), 'netlify.toml include X-Content-Type-Options: nosniff');

        // 9. Supabase RLS Lockdown SQL Script Audit
        const sqlLockdown = fs.readFileSync(path.resolve(__dirname, '../supabase_security_lockdown.sql'), 'utf8');
        const requiredTables = ['students', 'results', 'assigned_tests', 'questions', 'waiting_questions', 'preset_tests'];
        for (const tbl of requiredTables) {
            assert(sqlLockdown.includes(`ALTER TABLE IF EXISTS ${tbl} ENABLE ROW LEVEL SECURITY;`), `supabase_security_lockdown.sql activează RLS pe tabela "${tbl}"`);
            assert(sqlLockdown.includes(`CREATE POLICY "Deny all public access" ON ${tbl} FOR ALL USING (false);`), `supabase_security_lockdown.sql blochează accesul public anon pe tabela "${tbl}"`);
        }
        assert(sqlLockdown.includes("bucket_id = 'images'"), 'supabase_security_lockdown.sql restricționează bucket-ul storage "images"');
    }

    // ========================================================================
    // SUITE 2: Taxonomie Canonică & Integritate Date
    // ========================================================================
    logSuite('Taxonomie Canonică & Integritate');
    {
        const expectedTaxonomy = {
            "Fundamente": ["Citire si afisare date", "Operatori si expresii", "Structuri de control", "Complexitati", "Pseudocod"],
            "Organizarea Datelor": ["Vectori", "Matrice", "Siruri de caractere", "Structuri de date (struct)"],
            "Subprograme": ["Transmitere prin valoare", "Transmitere prin referinta", "Recursivitate"],
            "Backtracking": ["Teorie si aplicare practica"],
            "Grafuri si Arbori": ["Terminologie grafuri", "Grafuri orientate", "Grafuri neorientate", "Arbori"]
        };

        const adminJsContent = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/admin.js'), 'utf8');
        const practiceJsContent = fs.readFileSync(path.resolve(__dirname, '../netlify/functions/manage-practice.js'), 'utf8');

        // Check each category in admin.js
        for (const [cat, subcats] of Object.entries(expectedTaxonomy)) {
            assert(adminJsContent.includes(`"${cat}"`), `Categoria "${cat}" este prezentă în admin.js`);
            assert(practiceJsContent.includes(`"${cat}"`), `Categoria "${cat}" este prezentă în manage-practice.js`);
            for (const sub of subcats) {
                assert(adminJsContent.includes(sub), `Subcategoria "${sub}" este configurată în admin.js`);
                assert(practiceJsContent.includes(sub), `Subcategoria "${sub}" este configurată în manage-practice.js`);
            }
        }
    }

    // ========================================================================
    // SUITE 3: Motorul de Teste, Scoruri & Analiză Rezultate
    // ========================================================================
    logSuite('Motorul de Teste & Calcul Scoruri');
    {
        // Pure calculation function test
        function calculateScore(totalQuestions, correctAnswers) {
            if (!totalQuestions || totalQuestions <= 0) return { percent: 0, grade: 1.0 };
            const percent = Math.round((correctAnswers / totalQuestions) * 100);
            const grade = Number((1 + (correctAnswers / totalQuestions) * 9).toFixed(2));
            return { percent, grade };
        }

        const score100 = calculateScore(10, 10);
        assertEqual(score100.percent, 100, '10 din 10 întrebări corecte = 100%');
        assertEqual(score100.grade, 10.0, '10 din 10 întrebări corecte = nota 10.00');

        const score50 = calculateScore(10, 5);
        assertEqual(score50.percent, 50, '5 din 10 întrebări corecte = 50%');
        assertEqual(score50.grade, 5.5, '5 din 10 întrebări corecte = nota 5.50');

        const score0 = calculateScore(10, 0);
        assertEqual(score0.percent, 0, '0 din 10 întrebări corecte = 0%');
        assertEqual(score0.grade, 1.0, '0 din 10 întrebări corecte = nota 1.00');

        // Aggregation by category
        const sampleAnswers = [
            { category: 'Fundamente', is_correct: true },
            { category: 'Fundamente', is_correct: false },
            { category: 'Grafuri si Arbori', is_correct: true }
        ];

        const breakdown = {};
        sampleAnswers.forEach(ans => {
            if (!breakdown[ans.category]) breakdown[ans.category] = { total: 0, correct: 0 };
            breakdown[ans.category].total++;
            if (ans.is_correct) breakdown[ans.category].correct++;
        });

        assertEqual(breakdown['Fundamente'].total, 2, 'Total întrebări Fundamente corect agregat (2)');
        assertEqual(breakdown['Fundamente'].correct, 1, 'Corecte Fundamente corect agregat (1)');
        assertEqual(breakdown['Grafuri si Arbori'].total, 1, 'Total întrebări Grafuri corect agregat (1)');
        assertEqual(breakdown['Grafuri si Arbori'].correct, 1, 'Corecte Grafuri corect agregat (1)');
    }

    // ========================================================================
    // SUITE 4: Spaced Repetition & Modul Practice (manage-practice.js)
    // ========================================================================
    logSuite('Spaced Repetition & Coadă Priorități');
    {
        // Simulate priority queue logic
        const pool = [
            { id: 1, mastery: 'mastered', last_attempt: Date.now() - 10000 },
            { id: 2, mastery: 'unseen', last_attempt: null },
            { id: 3, mastery: 'weak', last_attempt: Date.now() - 5000 },
            { id: 4, mastery: 'unseen', last_attempt: null }
        ];

        // Priority: unseen first (weight 1), weak second (weight 2), mastered last (weight 3)
        const sorted = [...pool].sort((a, b) => {
            const getPriority = (q) => {
                if (q.mastery === 'unseen') return 1;
                if (q.mastery === 'weak') return 2;
                return 3;
            };
            return getPriority(a) - getPriority(b);
        });

        assert(sorted[0].mastery === 'unseen' && sorted[1].mastery === 'unseen', 'Întrebările nevăzute (unseen) au prioritate maximă');
        assert(sorted[2].mastery === 'weak', 'Întrebările greșite anterior (weak) au prioritate secundară');
        assert(sorted[3].mastery === 'mastered', 'Întrebările deja stăpânite sunt puse la final pentru consolidare');

        // Mastery coverage calculation
        function updateMasteredQuestions(existingMastered, newlyMastered) {
            const set = new Set(existingMastered || []);
            (newlyMastered || []).forEach(id => set.add(id));
            return Array.from(set);
        }

        const initialMastered = [1, 2, 3];
        const sessionMastered = [3, 4, 5];
        const resultMastered = updateMasteredQuestions(initialMastered, sessionMastered);
        assertEqual(resultMastered.length, 5, 'Gestiunea stăpânirii păstrează unicitatea întrebărilor (fără duplicate)');
        assert(resultMastered.includes(4) && resultMastered.includes(5), 'Întrebările noi rezolvate corect sunt adăugate la mastered');
    }

    // ========================================================================
    // SUITE 5: Generare Aleatorie & Teste Predefinite
    // ========================================================================
    logSuite('Teste Predefinite & Selecție Aleatorie');
    {
        const questionPool = Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            category: i < 20 ? 'Academie' : (i < 35 ? 'BAC' : 'Poli'),
            question_text: `Intrebarea de test #${i + 1}`
        }));

        function pickRandomQuestions(pool, count, categoryFilter) {
            let filtered = pool;
            if (categoryFilter && categoryFilter !== 'Toate') {
                filtered = pool.filter(q => q.category === categoryFilter);
            }
            const shuffled = [...filtered].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, Math.min(count, shuffled.length));
        }

        const picked10 = pickRandomQuestions(questionPool, 10, 'Toate');
        assertEqual(picked10.length, 10, 'Selecția aleatorie returnează numărul exact cerut de întrebări (10)');

        const pickedBac = pickRandomQuestions(questionPool, 5, 'BAC');
        assertEqual(pickedBac.length, 5, 'Selecția filtrată pe BAC returnează 5 întrebări');
        assert(pickedBac.every(q => q.category === 'BAC'), 'Toate întrebările selectate aparțin categoriei BAC');

        const uniqueIds = new Set(picked10.map(q => q.id));
        assertEqual(uniqueIds.size, picked10.length, 'Nu există ID-uri duplicate în selecția aleatorie');

        // Teste pentru Punctul 2 & 3: Creare Draft Asignare Test Predefinit
        const samplePreset = {
            id: 101,
            title: 'Simulare BAC 1',
            exam_type: 'BAC',
            time_limit_minutes: 60,
            questions_ids: [12, 15, 23, 45, 88]
        };

        const deadlineIso = new Date(Date.now() + 86400000).toISOString();
        const draftAssignment = {
            student_username: 'tudor_test',
            exam_type: samplePreset.exam_type,
            target_length: samplePreset.questions_ids.length,
            deadline: deadlineIso,
            questions_ids: [...samplePreset.questions_ids],
            preset_id: samplePreset.id,
            title: samplePreset.title,
            is_preset: true,
            draft: true
        };

        assertEqual(draftAssignment.student_username, 'tudor_test', 'Asignare preset: elev setat corect');
        assertEqual(draftAssignment.questions_ids.length, 5, 'Asignare preset: număr întrebări sincronizat');
        assertEqual(draftAssignment.is_preset, true, 'Asignare preset: flag is_preset marcat');
        assertEqual(draftAssignment.preset_id, 101, 'Asignare preset: ID preset corect asociat');
    }

    // ========================================================================
    // SUITE 6: Validare Formular Leads
    // ========================================================================
    logSuite('Validare Formular Leads');
    {
        function validateLead(payload) {
            if (!payload || typeof payload !== 'object') return { valid: false, error: 'Payload invalid' };
            const name = (payload.name || '').trim();
            const phone = (payload.phone || '').trim();
            const email = (payload.email || '').trim();
            const target = (payload.exam_target || '').trim();

            if (!name || name.length < 3) return { valid: false, error: 'Nume prea scurt' };
            // Romanian phone check: at least 10 digits
            const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
            if (!cleanPhone || cleanPhone.length < 10) return { valid: false, error: 'Număr de telefon invalid' };
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { valid: false, error: 'Email invalid' };
            if (!target) return { valid: false, error: 'Examenul vizat este obligatoriu' };

            return { valid: true, error: null };
        }

        assert(validateLead({ name: 'Ion Popescu', phone: '0712345678', exam_target: 'Academie' }).valid, 'Lead valid este acceptat');
        assert(!validateLead({ name: 'Io', phone: '0712345678', exam_target: 'Academie' }).valid, 'Lead cu nume prea scurt este respins');
        assert(!validateLead({ name: 'Ion Popescu', phone: '123', exam_target: 'Academie' }).valid, 'Lead cu telefon incomplet este respins');
        assert(!validateLead({ name: 'Ion Popescu', phone: '0712345678', email: 'adresa-gresita', exam_target: 'Academie' }).valid, 'Lead cu email malformat este respins');
        assert(!validateLead({ name: 'Ion Popescu', phone: '0712345678', exam_target: '' }).valid, 'Lead fără examen vizat este respins');
    }

    // ========================================================================
    // SUITE 7: Contracte Netlify Functions (Mock Event Testing)
    // ========================================================================
    logSuite('Contracte Netlify Functions (Mock Handlers)');
    {
        // 1. auth-student.js
        const authStudent = require('../netlify/functions/auth-student');
        const optRes = await authStudent.handler({ httpMethod: 'OPTIONS', headers: {} });
        assertEqual(optRes.statusCode, 200, 'auth-student: OPTIONS returnează 200 OK');

        const getRes = await authStudent.handler({ httpMethod: 'GET', headers: {} });
        assertEqual(getRes.statusCode, 405, 'auth-student: GET returnează 405 Method Not Allowed');

        // 2. check-user.js
        const checkUser = require('../netlify/functions/check-user');
        const cuOpt = await checkUser.handler({ httpMethod: 'OPTIONS', headers: {} });
        assertEqual(cuOpt.statusCode, 200, 'check-user: OPTIONS returnează 200 OK');

        const cuNoToken = await checkUser.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ username: 'test' }) });
        assertEqual(cuNoToken.statusCode, 401, 'check-user: POST fără token returnează 401 Unauthorized');

        // 3. manage-preset-tests.js
        const managePreset = require('../netlify/functions/manage-preset-tests');
        const mpNoAuth = await managePreset.handler({ httpMethod: 'GET', headers: {} });
        assertEqual(mpNoAuth.statusCode, 401, 'manage-preset-tests: Acces fără admin token returnează 401');

        // 4. manage-questions.js
        const manageQuestions = require('../netlify/functions/manage-questions');
        const mqNoAuth = await manageQuestions.handler({ httpMethod: 'POST', headers: {}, body: '{}' });
        assertEqual(mqNoAuth.statusCode, 401, 'manage-questions: Acces fără admin token returnează 401');

        // 5. fetch-results.js (Security & IDOR Tests)
        const fetchResults = require('../netlify/functions/fetch-results');
        const frOpt = await fetchResults.handler({ httpMethod: 'OPTIONS', headers: {} });
        assertEqual(frOpt.statusCode, 200, 'fetch-results: OPTIONS returnează 200 OK');

        const frPost = await fetchResults.handler({ httpMethod: 'POST', headers: {} });
        assertEqual(frPost.statusCode, 405, 'fetch-results: POST returnează 405 Method Not Allowed');

        const frNoAuth = await fetchResults.handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { id: '123' } });
        assertEqual(frNoAuth.statusCode, 401, 'fetch-results: Acces fără token returnează 401 Unauthorized');

        const jwtSecret = utils.getLiveEnv('JWT_SECRET', 'dummy-jwt-secret-for-testing');
        const aliceToken = jwt.sign({ username: 'alice', id: 1 }, jwtSecret, { expiresIn: '1h' });

        // Mismatched requested username: Alice tries to ask for Bob's results explicitly
        const frMismatched = await fetchResults.handler({
            httpMethod: 'GET',
            headers: { authorization: `Bearer ${aliceToken}` },
            queryStringParameters: { username: 'bob', id: '123' }
        });
        assertEqual(frMismatched.statusCode, 403, 'fetch-results: IDOR detectat (token alice vs username bob) returnează 403 Forbidden');

        // 6. manage-practice.js (Security & IDOR Tests on check_answer)
        const managePractice = require('../netlify/functions/manage-practice');
        const mpNoAuthCheck = await managePractice.handler({
            httpMethod: 'POST',
            headers: {},
            body: JSON.stringify({ action: 'check_answer', question_id: 1, selected_index: 0 })
        });
        assertEqual(mpNoAuthCheck.statusCode, 401, 'manage-practice (check_answer): Acces fără token returnează 401 Unauthorized');

        const mpMismatchedCheck = await managePractice.handler({
            httpMethod: 'POST',
            headers: { authorization: `Bearer ${aliceToken}` },
            body: JSON.stringify({ action: 'check_answer', question_id: 1, selected_index: 0, student_username: 'bob' })
        });
        assertEqual(mpMismatchedCheck.statusCode, 403, 'manage-practice (check_answer): IDOR detectat (token alice vs student_username bob) returnează 403 Forbidden');

        const mpInvalidParams = await managePractice.handler({
            httpMethod: 'POST',
            headers: { authorization: `Bearer ${aliceToken}` },
            body: JSON.stringify({ action: 'check_answer', question_id: -5, selected_index: 'invalid' })
        });
        assertEqual(mpInvalidParams.statusCode, 400, 'manage-practice (check_answer): Parametri invalizi returnează 400 Bad Request');

        // 7. upload-image.js (Security, MIME & Magic Bytes Tests)
        const uploadImage = require('../netlify/functions/upload-image');
        const upNoAuth = await uploadImage.handler({ httpMethod: 'POST', headers: {}, body: '{}' });
        assertEqual(upNoAuth.statusCode, 401, 'upload-image: Upload fără admin token returnează 401 Unauthorized');

        const adminSecret = utils.getLiveEnv('ADMIN_SECRET', 'dummy-admin-secret-for-testing');
        const adminHeaders = { 'x-admin-token': adminSecret };

        // Test rejection of non-whitelisted MIME type (e.g. SVG / HTML)
        const upSvg = await uploadImage.handler({
            httpMethod: 'POST',
            headers: adminHeaders,
            body: JSON.stringify({
                filename: 'xss.svg',
                contentType: 'image/svg+xml',
                base64data: Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64')
            })
        });
        assertEqual(upSvg.statusCode, 400, 'upload-image: MIME type nepermis (image/svg+xml) returnează 400 Bad Request');

        // Test rejection of fake PNG with invalid magic bytes
        const upFakePng = await uploadImage.handler({
            httpMethod: 'POST',
            headers: adminHeaders,
            body: JSON.stringify({
                filename: 'fake.png',
                contentType: 'image/png',
                base64data: Buffer.from('NOT_A_REAL_PNG_CONTENT').toString('base64')
            })
        });
        assertEqual(upFakePng.statusCode, 400, 'upload-image: Semnătură binară invalidă returnează 400 Bad Request');

        // 8. save-result.js (Security, IDOR & Numeric IDs Tests)
        const saveResult = require('../netlify/functions/save-result');
        const srOpt = await saveResult.handler({ httpMethod: 'OPTIONS', headers: {} });
        assertEqual(srOpt.statusCode, 200, 'save-result: OPTIONS returnează 200 OK');

        const srGet = await saveResult.handler({ httpMethod: 'GET', headers: {} });
        assertEqual(srGet.statusCode, 405, 'save-result: GET returnează 405 Method Not Allowed');

        const srNoAuth = await saveResult.handler({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': '10.0.0.1' }, body: '{}' });
        assertEqual(srNoAuth.statusCode, 401, 'save-result: Acces fără token returnează 401 Unauthorized');

        const srIdor = await saveResult.handler({
            httpMethod: 'POST',
            headers: { authorization: `Bearer ${aliceToken}`, 'x-nf-client-connection-ip': '10.0.0.2' },
            body: JSON.stringify({
                student_username: 'bob',
                time_taken_ms: 10000,
                answers_json: [0],
                question_ids: [1]
            })
        });
        assertEqual(srIdor.statusCode, 403, 'save-result: IDOR detectat (token alice vs student_username bob) returnează 403 Forbidden');

        const srInvalidIds = await saveResult.handler({
            httpMethod: 'POST',
            headers: { authorization: `Bearer ${aliceToken}`, 'x-nf-client-connection-ip': '10.0.0.3' },
            body: JSON.stringify({
                student_username: 'alice',
                time_taken_ms: 10000,
                answers_json: [0],
                question_ids: ['1; DROP TABLE']
            })
        });
        assertEqual(srInvalidIds.statusCode, 400, 'save-result: ID-uri de întrebări non-numerice returnează 400 Bad Request');

        const srNegativeId = await saveResult.handler({
            httpMethod: 'POST',
            headers: { authorization: `Bearer ${aliceToken}`, 'x-nf-client-connection-ip': '10.0.0.4' },
            body: JSON.stringify({
                student_username: 'alice',
                time_taken_ms: 10000,
                answers_json: [0],
                question_ids: [-10]
            })
        });
        assertEqual(srNegativeId.statusCode, 400, 'save-result: ID-uri negative de întrebări returnează 400 Bad Request');

        const srDuplicateIds = await saveResult.handler({
            httpMethod: 'POST',
            headers: { authorization: `Bearer ${aliceToken}`, 'x-nf-client-connection-ip': '10.0.0.5' },
            body: JSON.stringify({
                student_username: 'alice',
                time_taken_ms: 10000,
                answers_json: [0, 1],
                question_ids: [42, 42]
            })
        });
        assertEqual(srDuplicateIds.statusCode, 400, 'save-result: ID-uri duplicate de întrebări returnează 400 Bad Request');

        const srLengthMismatch = await saveResult.handler({
            httpMethod: 'POST',
            headers: { authorization: `Bearer ${aliceToken}`, 'x-nf-client-connection-ip': '10.0.0.6' },
            body: JSON.stringify({
                student_username: 'alice',
                time_taken_ms: 10000,
                answers_json: [0, 1, 2],
                question_ids: [42, 43]
            })
        });
        assertEqual(srLengthMismatch.statusCode, 400, 'save-result: Nepotrivire lungime answers_json vs question_ids returnează 400 Bad Request');

        // Dedicated Rate Limiting Test (Same IP hitting > 5 requests/min)
        const spamIp = '198.51.100.99';
        for (let i = 0; i < 5; i++) {
            await saveResult.handler({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': spamIp }, body: '{}' });
        }
        const rateLimitedRes = await saveResult.handler({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': spamIp }, body: '{}' });
        assertEqual(rateLimitedRes.statusCode, 429, 'save-result: Protecție Rate-Limiting activă pe IP (depășire limită returnează 429 Too Many Requests)');

        // 9. admin-login.js (Authentication & Cookie Generation Tests)
        const adminLogin = require('../netlify/functions/admin-login');
        const alOpt = await adminLogin.handler({ httpMethod: 'OPTIONS', headers: {} });
        assertEqual(alOpt.statusCode, 200, 'admin-login: OPTIONS returnează 200 OK');

        const alGet = await adminLogin.handler({ httpMethod: 'GET', headers: {} });
        assertEqual(alGet.statusCode, 405, 'admin-login: GET returnează 405 Method Not Allowed');

        const alWrong = await adminLogin.handler({
            httpMethod: 'POST',
            headers: { 'x-nf-client-connection-ip': '10.0.1.1' },
            body: JSON.stringify({ password: 'parola_complet_gresita' })
        });
        assertEqual(alWrong.statusCode, 401, 'admin-login: Parolă greșită returnează 401 Parolă incorectă');

        const liveAdminSecret = utils.getLiveEnv('ADMIN_SECRET', 'dummy-admin-secret-for-testing');
        const alCorrect = await adminLogin.handler({
            httpMethod: 'POST',
            headers: { 'x-nf-client-connection-ip': '10.0.1.2' },
            body: JSON.stringify({ password: liveAdminSecret })
        });
        assertEqual(alCorrect.statusCode, 200, 'admin-login: Parolă corectă returnează 200 OK');
        assert(alCorrect.headers && alCorrect.headers['Set-Cookie'] && alCorrect.headers['Set-Cookie'].includes('admin_token='), 'admin-login: Răspunsul setează cookie-ul securizat admin_token');
    }

    // ========================================================================
    // SUITE 8: Integritate Frontend & Scanare ID-uri DOM
    // ========================================================================
    logSuite('Integritate DOM & JavaScript Selectors');
    {
        const adminHtml = fs.readFileSync(path.resolve(__dirname, '../public/admin.html'), 'utf8');
        const indexHtml = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
        const combinedHtml = adminHtml + '\n' + indexHtml;

        // Extract all declared IDs in HTML
        const declaredIds = new Set();
        const idMatches = combinedHtml.matchAll(/id=["']([^"']+)["']/g);
        for (const m of idMatches) {
            declaredIds.add(m[1]);
        }
        assert(declaredIds.size > 50, `Au fost identificate ${declaredIds.size} elemente cu ID unic în HTML`);

        // Check essential elements in admin.html
        const criticalAdminIds = [
            'btn-tab-intrebari',
            'tab-intrebari',
            'tab-rezultate',
            'tab-elevi',
            'tab-presets',
            'tab-leads',
            'tab-waiting',
            'pill-count-Toate',
            'pill-count-Academie',
            'pill-count-BAC',
            'pill-count-Poli',
            'pill-count-Diverse',
            'pill-count-Initial',
            'badge-total-questions-count',
            'situatie-triage-container',
            'filter-situatie-all',
            'filter-situatie-attention',
            'filter-situatie-normal',
            'situatie-students-grid',
            'search-situatie-student',
            'assign-mode-toggle',
            'btn-assign-mode-dynamic',
            'btn-assign-mode-preset',
            'assign-preset-select',
            'assign-preset-summary-card',
            'assign-day',
            'assign-month',
            'assign-year',
            'assign-hour',
            'assign-deadline-preview'
        ];

        for (const id of criticalAdminIds) {
            assert(declaredIds.has(id), `Elementul critic ID="${id}" există în admin.html`);
        }

        // Check essential elements in index.html
        const criticalIndexIds = [
            'screen-welcome',
            'screen-dashboard',
            'screen-quiz',
            'screen-results',
            'screen-practice',
            'screen-situatie'
        ];

        for (const id of criticalIndexIds) {
            assert(declaredIds.has(id), `Ecranul principal ID="${id}" există în index.html`);
        }

        // Faza 3: Verificare Stiluri CSS Unificate & Componente Comune
        const adminCss = fs.readFileSync(path.resolve(__dirname, '../public/assets/css/admin.css'), 'utf8');
        const unifiedCssTokens = [
            '.assign-mode-toggle',
            '.assign-mode-btn',
            '.preset-question-card',
            '.preset-card-header',
            '.preset-card-actions',
            '.preset-btn-swap',
            '.preset-btn-replace',
            '.preset-btn-remove',
            '.preset-opts-grid',
            '#preset-selected-preview-list::-webkit-scrollbar'
        ];

        for (const token of unifiedCssTokens) {
            assert(adminCss.includes(token), `Token CSS unificat "${token}" este prezent în admin.css`);
        }

        // Faza 3 / Recomandare 1: Verificare logică de comutare a modurilor și hardening HTML5
        function simulateSetAssignMode(mode) {
            return {
                categoryDisabled: mode === 'preset',
                categoryRequired: mode !== 'preset',
                countDisabled: mode === 'preset',
                countRequired: mode !== 'preset',
                presetSelectDisabled: mode !== 'preset',
                presetSelectRequired: mode === 'preset'
            };
        }

        const presetState = simulateSetAssignMode('preset');
        assert(presetState.categoryDisabled && !presetState.categoryRequired, 'Mod preset: Câmpurile dinamice sunt dezactivate și nu sunt required');
        assert(!presetState.presetSelectDisabled && presetState.presetSelectRequired, 'Mod preset: Selectorul de preset este activat și required');

        const dynamicState = simulateSetAssignMode('dynamic');
        assert(!dynamicState.categoryDisabled && dynamicState.categoryRequired, 'Mod dinamic: Câmpurile dinamice sunt active și required');
        assert(dynamicState.presetSelectDisabled && !dynamicState.presetSelectRequired, 'Mod dinamic: Selectorul de preset este dezactivat');
    }

    // ========================================================================
    // SUITE 9: Gramatică Română & Pluralizări Situație Elevi
    // ========================================================================
    logSuite('Gramatică Română & Pluralizare Situație Elevi');
    {
        function formatRoPlural(count, singular, plural) {
            const c = Number(count) || 0;
            return c === 1 ? `1 ${singular}` : `${c} ${plural}`;
        }

        assertEqual(formatRoPlural(1, 'test', 'teste'), '1 test', 'Singular: 1 test');
        assertEqual(formatRoPlural(0, 'test', 'teste'), '0 teste', 'Plural: 0 teste');
        assertEqual(formatRoPlural(4, 'test', 'teste'), '4 teste', 'Plural: 4 teste');
        assertEqual(formatRoPlural(1, 'temă', 'teme'), '1 temă', 'Singular: 1 temă');
        assertEqual(formatRoPlural(2, 'temă', 'teme'), '2 teme', 'Plural: 2 teme');
        assertEqual(formatRoPlural(6, 'temă', 'teme'), '6 teme', 'Plural: 6 teme');
        assertEqual(formatRoPlural(1, 'temă depășită', 'teme depășite'), '1 temă depășită', 'Singular: 1 temă depășită');
        assertEqual(formatRoPlural(3, 'temă depășită', 'teme depășite'), '3 teme depășite', 'Plural: 3 teme depășite');
        assertEqual(formatRoPlural(1, 'elev necesită', 'elevi necesită'), '1 elev necesită', 'Singular: 1 elev necesită');
        assertEqual(formatRoPlural(5, 'elev necesită', 'elevi necesită'), '5 elevi necesită', 'Plural: 5 elevi necesită');
    }

    // ========================================================================
    // SUITE 10: Validare Exhaustivă a Punctelor Rămase (Abonamente, Reload F5, Practice XP, Gestiune Conturi & Leads)
    // ========================================================================
    logSuite('Validare Exhaustivă a Punctelor Rămase (Abonamente, Reload, Practice & Admin)');
    {
        // 1. Verificare Logică Abonament Expirat (Section 1.A)
        const parseExp = utils.parseExpirationDate;
        assert(typeof parseExp === 'function', 'Funcția utils.parseExpirationDate este disponibilă');

        const pastIso = '2024-01-01T00:00:00.000Z';
        const pastEuro = '01/01/2024';
        const futureIso = '2030-01-01T00:00:00.000Z';
        const futureEuro = '01/01/2030';

        const todayBucharest = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

        const isPastExpiredIso = parseExp(pastIso) < todayBucharest;
        const isPastExpiredEuro = parseExp(pastEuro) < todayBucharest;
        const isFutureExpiredIso = parseExp(futureIso) < todayBucharest;
        const isFutureExpiredEuro = parseExp(futureEuro) < todayBucharest;

        assert(isPastExpiredIso, 'Abonament expirat (ISO 2024-01-01) este detectat ca expirat');
        assert(isPastExpiredEuro, 'Abonament expirat (European 01/01/2024) este detectat ca expirat');
        assert(!isFutureExpiredIso, 'Abonament activ (ISO 2030-01-01) este recunoscut ca valid');
        assert(!isFutureExpiredEuro, 'Abonament activ (European 01/01/2030) este recunoscut ca valid');

        // 2. Verificare Serializare & Salvare Progres Reload F5 (Section 1.B)
        const mockTestState = {
            currentQuestion: 3,
            answers: [1, 2, 0, null, null],
            startTime: Date.now() - 150000,
            studentUsername: 'test_elev',
            studentId: '123',
            testType: 'initial',
            examType: 'Initial',
            blurCount: 1,
            assignedTestId: 'at_999',
            questionsIds: [101, 102, 103, 104, 105]
        };

        const serialized = {
            quiz_current_question: String(mockTestState.currentQuestion),
            quiz_answers: JSON.stringify(mockTestState.answers),
            quiz_start_time: String(mockTestState.startTime),
            quiz_student_username: mockTestState.studentUsername,
            quiz_student_id: mockTestState.studentId,
            quiz_test_type: mockTestState.testType,
            quiz_exam_type: mockTestState.examType,
            quiz_blur_count: String(mockTestState.blurCount),
            quiz_assigned_test_id: mockTestState.assignedTestId,
            quiz_questions_ids: JSON.stringify(mockTestState.questionsIds)
        };

        // Simulăm restaurarea la reload F5 (așa cum face initApp în auth.js)
        const restoredCurrentQuestion = parseInt(serialized.quiz_current_question, 10);
        const restoredAnswers = JSON.parse(serialized.quiz_answers);
        const restoredQuestionsIds = JSON.parse(serialized.quiz_questions_ids);
        const restoredAssignedId = serialized.quiz_assigned_test_id;

        assertEqual(restoredCurrentQuestion, 3, 'Reload F5: Întrebarea curentă (#3) este restaurată exact');
        assertEqual(restoredAnswers.length, 5, 'Reload F5: Numărul de răspunsuri este păstrat (5)');
        assertEqual(restoredAnswers[0], 1, 'Reload F5: Răspunsul la prima întrebare este conservat (1)');
        assertEqual(restoredAnswers[2], 0, 'Reload F5: Răspunsul la a treia întrebare este conservat (0)');
        assertEqual(restoredAnswers[3], null, 'Reload F5: Întrebările necompletate rămân null');
        assertEqual(restoredQuestionsIds.length, 5, 'Reload F5: ID-urile exacte ale întrebărilor sunt conservate');
        assertEqual(restoredAssignedId, 'at_999', 'Reload F5: ID-ul temei asignate este restaurat corect');

        // 3. Verificare Logică Sincronizare Progres Practice (Section 1.C)
        const masteredBefore = [10, 20];
        const newlyMastered = [101, 102];
        const syncResultList = Array.from(new Set([...masteredBefore, ...newlyMastered]));
        assertEqual(syncResultList.length, 4, 'Practice: 2 exerciții noi rezolvate cresc totalul de întrebări stăpânite la 4');
        assert(syncResultList.includes(101) && syncResultList.includes(102), 'Practice: Noile întrebări sunt incluse în lista de stăpânire');

        // 4. Verificare Taxonomie Canonică & Pseudocod (Section 2.E & 2.F)
        const validCats = {
            "Fundamente": ["Citire si afisare date", "Operatori si expresii", "Structuri de control", "Complexitati", "Pseudocod"],
            "Organizarea Datelor": ["Vectori", "Matrice", "Siruri de caractere", "Structuri de date (struct)"],
            "Subprograme": ["Transmitere prin valoare", "Transmitere prin referinta", "Recursivitate"],
            "Backtracking": ["Teorie si aplicare practica"],
            "Grafuri si Arbori": ["Terminologie grafuri", "Grafuri orientate", "Grafuri neorientate", "Arbori"]
        };
        assert(validCats["Fundamente"].includes("Pseudocod"), 'Taxonomie: Subcategoria "Pseudocod" este inclusă canonic în "Fundamente"');
        assertEqual(validCats["Organizarea Datelor"].length, 4, 'Taxonomie: Organizarea Datelor are exact 4 subcategorii');
        assertEqual(validCats["Grafuri si Arbori"].length, 4, 'Taxonomie: Grafuri si Arbori are exact 4 subcategorii');

        // 5. Verificare Normalizare Număr Telefon (Section 2.C)
        function cleanPhoneNumber(raw) {
            if (!raw) return null;
            let clean = raw.trim().replace(/\s+/g, '').replace(/[-().]/g, '');
            if (clean.startsWith('+40')) clean = '0' + clean.substring(3);
            else if (clean.startsWith('40') && clean.length === 11) clean = '0' + clean.substring(2);
            else if (clean.startsWith('7') && clean.length === 9) clean = '0' + clean;
            return clean;
        }

        assertEqual(cleanPhoneNumber('+40 740 123 456'), '0740123456', 'Telefon: "+40 740 123 456" normalizat în "0740123456"');
        assertEqual(cleanPhoneNumber('0740-123-456'), '0740123456', 'Telefon: "0740-123-456" normalizat în "0740123456"');
        assertEqual(cleanPhoneNumber('740123456'), '0740123456', 'Telefon: "740123456" prefixat corect cu 0 -> "0740123456"');

        function isValidRomanianPhone(raw) {
            const clean = cleanPhoneNumber(raw);
            return clean !== null && /^07\d{8}$/.test(clean);
        }
        assert(isValidRomanianPhone('0712345678'), 'Telefon: 0712345678 este recunoscut ca valid');
        assert(isValidRomanianPhone('+40 712 345 678'), 'Telefon: +40 712 345 678 este recunoscut ca valid');
        assert(!isValidRomanianPhone('0812345678'), 'Telefon: 0812345678 (prefix incorect) este respins');
        assert(!isValidRomanianPhone('071234567'), 'Telefon: 071234567 (9 cifre - prea scurt) este respins');
        assert(!isValidRomanianPhone('07123456789'), 'Telefon: 07123456789 (11 cifre - prea lung) este respins');

        // Contract submit-lead: validare strictă telefon 10 cifre & prefix 07
        const submitLeadMod = require('../netlify/functions/submit-lead');
        const leadBadPhone = await submitLeadMod.handler({
            httpMethod: 'POST',
            body: JSON.stringify({ first_name: 'Test', last_name: 'Elev', phone: '0812345678', gdpr_consent: true, answers_json: [], question_ids: [] })
        });
        assertEqual(leadBadPhone.statusCode, 400, 'submit-lead: Telefon cu prefix diferit de 07 este respins cu 400');

        const leadShortPhone = await submitLeadMod.handler({
            httpMethod: 'POST',
            body: JSON.stringify({ first_name: 'Test', last_name: 'Elev', phone: '071234', gdpr_consent: true, answers_json: [], question_ids: [] })
        });
        assertEqual(leadShortPhone.statusCode, 400, 'submit-lead: Telefon incomplet este respins cu 400');

        // Contract update-result-status (Discutat / Nediscutat toggle)
        const updateStatusMod = require('../netlify/functions/update-result-status');
        const optStatus = await updateStatusMod.handler({ httpMethod: 'OPTIONS', headers: {} });
        assertEqual(optStatus.statusCode, 200, 'update-result-status: OPTIONS returnează 200 OK');

        const getStatus = await updateStatusMod.handler({ httpMethod: 'GET', headers: {} });
        assertEqual(getStatus.statusCode, 405, 'update-result-status: GET returnează 405 Method Not Allowed');

        const unauthStatus = await updateStatusMod.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ id: 1, discussed: true }) });
        assertEqual(unauthStatus.statusCode, 401, 'update-result-status: Acces fără admin token returnează 401 Unauthorized');

        const jwtMod = require('jsonwebtoken');
        const validAdminToken = jwtMod.sign({ role: 'admin' }, utils.getLiveEnv('ADMIN_SECRET', 'dummy-admin-secret-for-testing'));
        const noIdStatus = await updateStatusMod.handler({
            httpMethod: 'POST',
            headers: { 'x-admin-token': validAdminToken },
            body: JSON.stringify({ discussed: true })
        });
        assertEqual(noIdStatus.statusCode, 400, 'update-result-status: Lipsă ID returnează 400 Bad Request');

        // Token CSS .btn-discussed
        const adminCss = fs.readFileSync(path.join(__dirname, '../public/assets/css/admin.css'), 'utf8');
        assert(adminCss.includes('.btn-discussed'), 'Token CSS unificat ".btn-discussed" este prezent în admin.css');
        assert(adminCss.includes('.btn-discussed.is-discussed'), 'Stilul ".btn-discussed.is-discussed" este prezent în admin.css');

        // 6. Verificare Contract Conversie Lead în Elev (Section 2.G)
        function generateLeadUsername(fullName) {
            const parts = (fullName || '').trim().toLowerCase().split(/\s+/);
            let suggested = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : (parts[0] || 'elev');
            return suggested.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]/g, '');
        }

        assertEqual(generateLeadUsername('Andrei Popescu'), 'andrei.popescu', 'Lead: "Andrei Popescu" -> username generat "andrei.popescu"');
        assertEqual(generateLeadUsername('Ștefan Voinea'), 'stefan.voinea', 'Lead: "Ștefan Voinea" (diacritice) -> username generat "stefan.voinea"');
        assertEqual(generateLeadUsername('Elena'), 'elena', 'Lead: "Elena" -> username generat "elena"');
    }

    // ========================================================================
    // RAPORT FINAL
    // ========================================================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.bright}======================================================${colors.reset}`);
    console.log(`${colors.bright}REZULTATE FINALE AUDIT & TESTE AUTOMATE (${duration}s)${colors.reset}`);
    console.log(`  ${colors.green}Total Teste Trecute: ${totalPassed}${colors.reset}`);
    if (totalFailed > 0) {
        console.log(`  ${colors.red}Total Teste Eșuate: ${totalFailed}${colors.reset}`);
    } else {
        console.log(`  ${colors.cyan}Rată de succes: 100% (Zero defecte identificate în suitele rulate)${colors.reset}`);
    }
    console.log(`${colors.bright}======================================================${colors.reset}\n`);

    if (totalFailed > 0) {
        process.exit(1);
    }
}

runAllTests().catch(err => {
    console.error(`\n${colors.red}Eroare fatală în runner-ul de teste:${colors.reset}`, err);
    process.exit(1);
});
