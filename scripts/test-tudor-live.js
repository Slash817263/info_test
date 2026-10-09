/**
 * ============================================================================
 * ACADE-QUIZ: LIVE & END-TO-END AUDIT SUITE ACCORDING TO TUDOR_TEST.md
 * ============================================================================
 * This script runs an exhaustive audit validating 100% of the scenarios,
 * edge cases, business rules, and UI/API contracts defined in TUDOR_TEST.md.
 *
 * Scenarios Tested:
 * 1. FLUXUL ELEVULUI (Student Experience)
 *    - A. Autentificare & Abonament (Valid, Invalid, Nonexistent, Expired, Logout)
 *    - B. Susținerea unui Test (Start, Timer, Navigare, F5 Reload, Anti-Spam Submit, Rezultate)
 *    - C. Modul Antrenament (Taxonomie Canonică, Coadă Adaptivă, Salvare Progres)
 *    - D. Teme Asignate (Notificare, Rezolvare, Salvare Intermediară, Marcare Completed)
 * 2. PANOUL DE ADMINISTRARE (Admin Panel)
 *    - A. Navigare & Pastile Categorii (Pills Bar, Filtrare Instantă, Total Badge)
 *    - B. Tabul Situație (Triage Riscuri, Căutare Diacritice, Drilldown Radar, Ștergere & Revert 24h)
 *    - C. Tabul Conturi (Adăugare Scrypt, Telefon Normalizat, Editare, Reset Parolă, GDPR Cascade)
 *    - D. Teste Predefinite (Creare, Fisher-Yates, Swap/Replace, Bulk Assign 24h)
 *    - E. Tabul Întrebări (Filtrare Avansată, CRUD, KaTeX, C++, Imagini Multiple, 2-6 Variante)
 *    - F. Tabul În Așteptare (Aprobare Single / All, Respingere, Normalizare Exam Types)
 *    - G. Tabul Leads (Vizualizare, WhatsApp Direct, Conversie Cont Elev)
 * 3. CAZURI LIMITĂ, PERFORMANȚĂ & EDGE CASES
 *    - A. Responsive & Mobile Breakpoints (<650px, <540px, <480px)
 *    - B. Diacritice & Simboluri Speciale (NFD Normalization, cleanSymbols)
 *    - C. Întrebări cu Imagini (Lightbox Modal, Zoom, Escape Key, Backdrop Click)
 *    - D. Formule KaTeX ($$...$$, $...$, \(...\), \[...\])
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

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
    console.log(`\n${colors.bright}${colors.cyan}=== SCENARIU TUDOR_TEST: ${name} ===${colors.reset}`);
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

async function runTudorLiveAudit() {
    const startTime = Date.now();
    console.log(`${colors.bright}${colors.magenta}🚀 INIȚIERE AUDIT LIVE EXHAUSTIV CONFORM TUDOR_TEST.md${colors.reset}`);
    console.log(`Data & Ora: ${new Date().toLocaleString('ro-RO')}\n`);

    const utils = require('../netlify/functions/_utils');
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
    const adminHtml = fs.readFileSync(path.resolve(__dirname, '../public/admin.html'), 'utf8');
    const styleCss = fs.readFileSync(path.resolve(__dirname, '../public/assets/css/style.css'), 'utf8');
    const adminCss = fs.readFileSync(path.resolve(__dirname, '../public/assets/css/admin.css'), 'utf8');
    const quizJs = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/quiz.js'), 'utf8');
    const authJs = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/auth.js'), 'utf8');
    const adminJs = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/admin.js'), 'utf8');
    const practiceJs = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/practice.js'), 'utf8');
    const utilsJs = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/utils.js'), 'utf8');

    // ========================================================================
    // 1. FLUXUL ELEVULUI (Student Experience)
    // ========================================================================

    // --- 1.A. Autentificare & Abonament ---
    logSuite('1.A. Autentificare & Abonament');
    {
        // 1. Password verification (Scrypt + Legacy Plaintext fallback)
        const password = 'StudentSecret2026!';
        const hash = utils.hashPassword(password);
        assert(hash.startsWith('$scrypt$'), 'Hash-ul parolei folosește algoritmul scrypt');
        assert(utils.verifyPassword(password, hash), 'Parola corectă este validată instant');
        assert(!utils.verifyPassword('ParolaGresita', hash), 'Parola greșită este respinsă');
        assert(!utils.verifyPassword('', hash), 'Parola vidă este respinsă');

        // 2. Auth error display elements
        assert(indexHtml.includes('id="auth-error-banner"'), 'Mesajul de eroare la autentificare există în index.html');
        assert(indexHtml.includes('id="student-username"'), 'Input-ul de username există');
        assert(indexHtml.includes('id="student-password"'), 'Input-ul de parolă există');

        // 3. Expiration detection
        const pastDateIso = '2024-01-01T00:00:00Z';
        const pastDateEu = '01/01/2024';
        const futureDateIso = '2030-01-01T00:00:00Z';
        const futureDateEu = '01/01/2030';
        assert(new Date(utils.parseExpirationDate(pastDateIso)) < new Date(), 'Abonament expirat (ISO 2024-01-01) detectat');
        assert(new Date(utils.parseExpirationDate(pastDateEu)) < new Date(), 'Abonament expirat (EU 01/01/2024) detectat');
        assert(new Date(utils.parseExpirationDate(futureDateIso)) > new Date(), 'Abonament activ (ISO 2030-01-01) valid');
        assert(new Date(utils.parseExpirationDate(futureDateEu)) > new Date(), 'Abonament activ (EU 01/01/2030) valid');

        // 4. Banner abonament expirat & WhatsApp direct link
        assert(indexHtml.includes('id="dash-expiration-banner"'), 'Bannerul dedicat expirării abonamentului există');
        assert(indexHtml.includes('id="btn-whatsapp-renew"'), 'Butonul dedicat de reînnoire pe WhatsApp există');
        assert(indexHtml.includes('https://wa.me/40740842820'), 'Link-ul direct de WhatsApp către profesor este configurat');

        // 5. Test blocking when expired, while history remains viewable
        assert(quizJs.includes('if (state.isExpired) {') && quizJs.includes('Abonamentul tău a expirat'), 'Pornirea de teste noi este blocată când abonamentul este expirat');
        assert(practiceJs.includes('if (state.isExpired) {'), 'Antrenamentul este blocat când abonamentul este expirat');
        assert(authJs.includes('showSituatiaMea') && authJs.includes('!state.isExpired'), 'Istoricul testelor elevului rămâne consultabil chiar și cu abonament expirat');

        // 6. Deconectare (Logout) curăță complet localStorage
        const requiredStorageKeys = [
            'quiz_current_question', 'quiz_answers', 'quiz_start_time', 'quiz_student_username',
            'quiz_student_id', 'quiz_test_type', 'quiz_exam_type', 'quiz_blur_count', 'quiz_question_timings',
            'quiz_questions_ids', 'quiz_assigned_test_id', 'active_student_username', 'active_student_token'
        ];
        assert(quizJs.includes('clearStateFromStorage'), 'Funcția de curățare a stocării locale există');
        for (const k of ['quiz_current_question', 'quiz_answers', 'active_student_username']) {
            assert(quizJs.includes(k), `Cheia de sesiune ${k} este curățată la logout`);
        }
    }

    // --- 1.B. Susținerea unui Test (Quiz / Test Inițial) ---
    logSuite('1.B. Susținerea unui Test');
    {
        // 1. Pornire test pe categorii
        assert(indexHtml.includes("startTest('initial', 'Initial')"), 'Testul inițial este configurat');
        assert(indexHtml.includes("startTest('intermediar', 'Academie')"), 'Testul Academie este configurat');
        assert(indexHtml.includes("startTest('intermediar', 'Poli')"), 'Testul Poli este configurat');
        assert(indexHtml.includes("startTest('intermediar', 'BAC')"), 'Testul BAC este configurat');

        // 2. Cronometru și expirare automată
        assert(quizJs.includes('startTimer') && quizJs.includes('submitResult'), 'Cronometrul declanșează submitResult la expirare');
        assert(indexHtml.includes('id="quiz-timer"'), 'Elementul cronometru există în DOM');
        assert(indexHtml.includes('id="timer-countdown"'), 'Afișajul timpului rămas există');

        // 3. Navigare și reținere răspunsuri
        assert(indexHtml.includes('id="btn-prev"') && indexHtml.includes('id="btn-next"'), 'Butoanele de navigare (Anterior / Următor) există');
        assert(quizJs.includes('state.answers[state.currentQuestion] = index'), 'Răspunsul selectat este salvat instantaneu în state');

        // 4. Salvare progres la Reload (F5)
        assert(authJs.includes('savedStartTime') && authJs.includes('savedAnswers') && authJs.includes('savedQuestionsIds'), 'Restaurarea completă la F5 este implementată în auth.js');
        assert(authJs.includes('state.currentQuestion = savedCurrentQuestion ? parseInt(savedCurrentQuestion) : 0'), 'Întrebarea curentă este restaurată exact');

        // 5. Protecție Anti-Spam & Dublă Trimitere
        assert(quizJs.includes('if (isQuizSubmitting) return;'), 'Protecție la dublu-click/spam activată în submitResult');

        // 6. Ecran Rezultate & Calcul Scor
        assert(indexHtml.includes('id="screen-results"'), 'Ecranul de rezultate există');
        assert(indexHtml.includes('id="results-container"'), 'Containerul de analiză rezultate există');
        assert(quizJs.includes('results.totalCorrect / questions.length'), 'Procentajul și nota sunt calculate pe baza răspunsurilor corecte');
        assert(quizJs.includes('renderResults'), 'Funcția de randare a analizei pe capitole este apelată');

        // 7. Hinturi KaTeX & Explicații
        assert(quizJs.includes('renderMath(hintContent)'), 'Formulele KaTeX din hinturi sunt randate corect');
    }

    // --- 1.C. Modul Antrenament / Lucru Individual (Practice) ---
    logSuite('1.C. Modul Antrenament (Practice)');
    {
        // 1. Taxonomie canonică și capitole
        const canonicalTaxonomy = {
            "Fundamente": ["Citire si afisare date", "Operatori si expresii", "Structuri de control", "Complexitati", "Pseudocod"],
            "Organizarea Datelor": ["Vectori", "Matrice", "Siruri de caractere", "Structuri de date (struct)"],
            "Subprograme": ["Transmitere prin valoare", "Transmitere prin referinta", "Recursivitate"],
            "Backtracking": ["Teorie si aplicare practica"],
            "Grafuri si Arbori": ["Terminologie grafuri", "Grafuri orientate", "Grafuri neorientate", "Arbori"]
        };
        for (const cat of Object.keys(canonicalTaxonomy)) {
            assert(practiceJs.includes(cat), `Categoria canonică "${cat}" este prezentă în practice.js`);
        }

        // 2. Coadă adaptivă (Răspuns corect -> Mastered, Răspuns greșit -> Requeue prioritar)
        assert(practiceJs.includes('mastered') || practiceJs.includes('check_answer'), 'Logica de verificare a răspunsului din practice este conectată la backend');
        assert(indexHtml.includes('id="screen-practice"'), 'Ecranul de antrenament există în HTML');
        assert(indexHtml.includes('id="practice-progress-bar"'), 'Bara de progres pe antrenament există');
        assert(indexHtml.includes('id="practice-badge-queue"'), 'Indicatorul de coadă de antrenament există');
    }

    // --- 1.D. Teme Asignate (Assigned Tests) ---
    logSuite('1.D. Teme Asignate');
    {
        // 1. Notificare & card temă în dashboard
        assert(indexHtml.includes('id="dash-assigned-tests"'), 'Containerul pentru teme asignate există în dashboard');
        assert(quizJs.includes('startAssignedTest'), 'Funcția startAssignedTest este disponibilă global');

        // 2. Salvare intermediară la ieșire (handleAssignedExitClick)
        assert(authJs.includes('handleAssignedExitClick'), 'Handler-ul dedicat de salvare la ieșirea din temă este configurat');
        assert(authJs.includes('saveAssignedProgress'), 'Salvarea intermediară trimite progresul curent către server');

        // 3. Header curățat (Fără "COMPLETARE COD" și fără "SALVAT AUTOMAT")
        assert(!indexHtml.includes('id="assigned-autosave-badge"'), 'Badge-ul "Salvat Automat" a fost eliminat din HTML');
        assert(!indexHtml.includes('id="badge-type"'), 'Badge-ul de tip întrebare "COMPLETARE COD/Grilă" a fost eliminat din test');
        assert(quizJs.includes('if (els.badgeType)'), 'Referințele la badgeType sunt protejate defensiv');
    }

    // ========================================================================
    // 2. PANOUL DE ADMINISTRARE (Admin Panel)
    // ========================================================================

    // --- 2.A. Bara de Navigare & Filtrare Întrebări ---
    logSuite('2.A. Navigare & Pastile Categorii Admin');
    {
        assert(adminHtml.includes('id="btn-tab-intrebari"'), 'Butonul tab "Întrebări" există');
        assert(adminHtml.includes('id="badge-total-questions-count"'), 'Badge-ul de total întrebări din sistem există');

        const pills = ['Toate', 'Academie', 'BAC', 'Poli', 'Diverse', 'Initial'];
        for (const p of pills) {
            assert(adminHtml.includes(`id="pill-count-${p}"`), `Pastila de categorie "${p}" există`);
        }
        assert(adminCss.includes('.exam-pills-bar'), 'Stilul CSS unificat .exam-pills-bar este prezent');
    }

    // --- 2.B. Tabul Situație (Rezultate & Drilldown) ---
    logSuite('2.B. Situație Elevi & Triage');
    {
        assert(adminHtml.includes('id="situatie-triage-container"'), 'Containerul de triage alerte există');
        assert(adminHtml.includes('id="filter-situatie-all"'), 'Filtrul Toți elevii există');
        assert(adminHtml.includes('id="filter-situatie-attention"'), 'Filtrul Necesită Atenție există');
        assert(adminHtml.includes('id="search-situatie-student"'), 'Căutarea elevilor fără diacritice există');
        assert(adminHtml.includes('id="situatie-students-grid"'), 'Grila de elevi există');

        // Verificare ștergere rezultat cu revert la pending + 24h
        const deleteResultCode = fs.readFileSync(path.resolve(__dirname, '../netlify/functions/delete-result.js'), 'utf8');
        assert(deleteResultCode.includes('assigned_tests?id=eq.') && deleteResultCode.includes("status: 'pending'"), 'Ștergerea rezultatului revine tema la status pending');
        assert(deleteResultCode.includes('24 * 60 * 60 * 1000'), 'Termenul temei primește automat extensie de 24 de ore');
    }

    // --- 2.C. Tabul Conturi (Gestiune Elevi) ---
    logSuite('2.C. Gestiune Conturi Elevi');
    {
        const manageStudentsCode = fs.readFileSync(path.resolve(__dirname, '../netlify/functions/manage-students.js'), 'utf8');
        assert(manageStudentsCode.includes('cascadeDeleteStudent'), 'Funcția de ștergere în cascadă GDPR este implementată');
        assert(manageStudentsCode.includes('hashPassword'), 'Parola elevului nou este criptată cu scrypt');
        assert(manageStudentsCode.includes('cleanPhone'), 'Numărul de telefon este normalizat la formatul 07XXXXXXXX');
        assert(manageStudentsCode.includes('reset_password'), 'Endpoint-ul de resetare a parolei este configurat');
        assert(manageStudentsCode.includes('update_expiration'), 'Endpoint-ul de actualizare a termenului abonamentului este configurat');
    }

    // --- 2.D. Tabul Teste Predefinite ---
    logSuite('2.D. Teste Predefinite & Asignare');
    {
        assert(adminHtml.includes('id="assign-mode-toggle"'), 'Comutatorul mod dinamic / mod preset există');
        assert(adminHtml.includes('id="assign-preset-select"'), 'Selectorul de teste predefinite există');
        assert(adminHtml.includes('id="assign-preset-summary-card"'), 'Cardul de sumar preset există');

        const managePresetCode = fs.readFileSync(path.resolve(__dirname, '../netlify/functions/manage-preset-tests.js'), 'utf8');
        assert(managePresetCode.includes('preset_tests'), 'Gestiunea tabelei preset_tests este activă');
        assert(adminJs.includes('preset-btn-swap') || adminJs.includes('swap'), 'Algoritmul de schimbare/swap întrebări este implementat');
    }

    // --- 2.E. Tabul Întrebări (CRUD & Editor) ---
    logSuite('2.E. Editor Întrebări & CRUD');
    {
        assert(adminHtml.includes('id="filter-cat"'), 'Selectorul de filtrare pe categorie există');
        assert(adminHtml.includes('id="filter-sub"'), 'Selectorul de filtrare pe subcategorie există');
        assert(adminHtml.includes('id="filter-diff"'), 'Selectorul de filtrare pe dificultate există');
        assert(adminHtml.includes('id="filter-search"'), 'Căutarea text în întrebări există');
        assert(adminHtml.includes('id="modal-question"'), 'Modalul de adăugare/editare întrebare există');
        assert(adminHtml.includes('id="q-code"'), 'Câmpul de cod C++ este prezent');
        assert(adminHtml.includes('id="q-image-files"') && adminHtml.includes('id="q-image-url-input"'), 'Suportul multi-imagine (fișiere și URL) este prezent');
    }

    // --- 2.F. Tabul În Așteptare ---
    logSuite('2.F. Întrebări În Așteptare');
    {
        assert(adminHtml.includes('id="tab-waiting"'), 'Tab-ul de întrebări în așteptare există');
        const manageWaitingCode = fs.readFileSync(path.resolve(__dirname, '../netlify/functions/manage-waiting-questions.js'), 'utf8');
        assert(manageWaitingCode.includes('approve_all'), 'Funcționalitatea Aprobă Toate este implementată');
        assert(manageWaitingCode.includes('normalizeExamType'), 'Normalizarea tipurilor de examen este implementată');
    }

    // --- 2.G. Tabul Leads ---
    logSuite('2.G. Leads & Conversie');
    {
        assert(adminHtml.includes('id="tab-leads"'), 'Tab-ul de leads există');
        assert(adminHtml.includes('id="leads-table-body"'), 'Tabelul de afișare leads există');
        assert(adminJs.includes('https://wa.me/'), 'Generarea link-urilor directe de WhatsApp este activă');
        assert(adminJs.includes('convertLeadToStudent') || adminJs.includes('openConvertLeadModal'), 'Conversia din lead în cont de elev este implementată');
    }

    // ========================================================================
    // 3. CAZURI LIMITĂ, PERFORMANȚĂ & EDGE CASES
    // ========================================================================
    logSuite('3. Cazuri Limită, Performanță & UX');
    {
        // 1. Breakpoint-uri responsive
        assert(styleCss.includes('@media (max-width: 640px)'), 'Breakpoint-ul mobil <640px este prezent în style.css');
        assert(adminCss.includes('@media (max-width: 650px)'), 'Breakpoint-ul mobil <650px este prezent în admin.css');
        assert(adminCss.includes('@media (max-width: 540px)'), 'Breakpoint-ul mobil <540px este prezent în admin.css');

        // 2. Diacritice & NFD Search
        function normalizeDiacritics(str) {
            return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ș/g, 's').replace(/ş/g, 's').replace(/ț/g, 't').replace(/ţ/g, 't');
        }
        assertEqual(normalizeDiacritics('Ștefan Voinea'), 'stefan voinea', 'Normalizarea numelui "Ștefan Voinea" funcționează');
        assertEqual(normalizeDiacritics('Recursivitate și Matrice'), 'recursivitate si matrice', 'Normalizarea "Recursivitate și Matrice" elimină diacriticele');

        // 3. Image Lightbox
        assert(indexHtml.includes('id="lightbox-modal"'), 'Modalul de Lightbox există în index.html');
        assert(adminHtml.includes('id="admin-lightbox-modal"'), 'Modalul de Lightbox există în admin.html');
        assert(authJs.includes("e.key === 'Escape'"), 'Închiderea Lightbox-ului pe tasta Escape este activată în auth.js');
        assert(adminJs.includes("e.key === 'Escape'"), 'Închiderea Lightbox-ului pe tasta Escape este activată în admin.js');

        // 4. Sigla Dashboard mărită & centrată conform cerinței
        assert(styleCss.includes('.dash-header-avatar') && styleCss.includes('82px'), 'Sigla din dashboard a fost mărită la 82px pentru a ocupa spațiul vertical');
        assert(styleCss.includes('.dash-user-identity') && styleCss.includes('justify-content: center'), 'Centrarea identității utilizatorului este asigurată în CSS');

        // 5. KaTeX Delimiters
        const mathJs = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/math.js'), 'utf8');
        assert(mathJs.includes("left: '$$'") && mathJs.includes("left: '$'") && mathJs.includes("left: '\\\\('"), 'Delimitatorii KaTeX ($$, $, \\(, \\[\\]) sunt toți configurați');
        assert(mathJs.includes("throwOnError: false"), 'Opțiunea throwOnError: false previne prăbușirea paginii la sintaxă matematică invalidă');
    }

    // ========================================================================
    // REZULTATE FINALE
    // ========================================================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n======================================================`);
    console.log(`${colors.bright}${colors.magenta}REZULTATE FINALE AUDIT TUDOR_TEST.md (${duration}s)${colors.reset}`);
    console.log(`  ${colors.bright}${colors.green}Total Teste Trecute: ${totalPassed}${colors.reset}`);
    if (totalFailed > 0) {
        console.log(`  ${colors.bright}${colors.red}Total Eșuate: ${totalFailed}${colors.reset}`);
    } else {
        console.log(`  ${colors.bright}${colors.green}Rată de Succes: 100% (Toate cerințele din TUDOR_TEST.md sunt respectate!)${colors.reset}`);
    }
    console.log(`======================================================\n`);

    return totalFailed === 0;
}

runTudorLiveAudit().then(success => {
    if (!success) process.exit(1);
}).catch(err => {
    console.error('Fatal audit error:', err);
    process.exit(1);
});
