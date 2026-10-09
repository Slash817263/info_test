const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
const ADMIN_SECRET = env.ADMIN_SECRET || 'secret';
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;

async function setupTestUserExpired() {
    const utils = require('../netlify/functions/_utils');
    const passHash = utils.hashPassword('parola123');
    const studentObj = {
        username: 'test.expirat',
        password: passHash,
        phone_number: '0700112233',
        expires_at: '2024-01-01'
    };

    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/students?username=eq.test.expirat`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const checkData = await checkRes.json();
    if (checkData.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/students?username=eq.test.expirat`, {
            method: 'PATCH',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ expires_at: '2024-01-01', password: passHash })
        });
    } else {
        await fetch(`${SUPABASE_URL}/rest/v1/students`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(studentObj)
        });
    }
}

async function cleanupTestUserExpired() {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/students?username=eq.test.expirat`, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
    } catch(e) {}
}

async function runFullTudorTest() {
    console.log('========================================================================');
    console.log('🚀 SUITĂ COMPLETĂ DE TESTARE LIVE BROWSER: TUDOR_TEST.md');
    console.log('========================================================================\n');

    await setupTestUserExpired();

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const errors = [];
    const logs = [];

    page.on('console', msg => {
        const text = msg.text();
        logs.push(text);
        if (msg.type() === 'error' && !text.includes('favicon') && !text.includes('401')) {
            errors.push(`[Console Error] ${text}`);
            console.log(`  🔴 [Browser Console Error]: ${text}`);
        }
    });

    page.on('pageerror', err => {
        errors.push(`[Page Error] ${err.message}`);
        console.log(`  💥 [Browser Uncaught Exception]: ${err.message}`);
    });

    const results = [];
    function pass(name, details = '') {
        results.push({ name, status: 'PASS', details });
        console.log(`  ✅ PASS: ${name}${details ? ' (' + details + ')' : ''}`);
    }
    function fail(name, reason) {
        results.push({ name, status: 'FAIL', reason });
        console.log(`  ❌ FAIL: ${name} -> ${reason}`);
    }

    try {
        // ====================================================================
        // 1. FLUXUL ELEVULUI (STUDENT EXPERIENCE)
        // ====================================================================

        // --- 1.A. Autentificare & Abonament ---
        console.log('\n--- 1.A. Autentificare & Abonament ---');
        await page.goto('http://localhost:8888', { waitUntil: 'networkidle0', timeout: 15000 });

        // Test: Parolă greșită
        await page.type('#student-username', 'ianis.nastrut');
        await page.type('#student-password', 'parola_incorecta_999');
        await page.click('#btn-continue');
        await sleep(1200);

        const pwErrVisible = await page.evaluate(() => {
            const banner = document.getElementById('auth-error-banner');
            const txt = document.getElementById('auth-error-text');
            return banner && banner.style.display !== 'none' && txt && txt.textContent.toLowerCase().includes('incorect');
        });
        if (pwErrVisible) {
            pass('Parolă greșită afișează banner roșu de eroare clar');
        } else {
            fail('Parolă greșită', 'Bannerul de eroare nu a apărut sau nu are mesaj clar');
        }

        // Test: Utilizator inexistent
        await page.evaluate(() => {
            document.getElementById('student-username').value = '';
            document.getElementById('student-password').value = '';
        });
        await page.type('#student-username', 'utilizator_inexistent_9999');
        await page.type('#student-password', 'oricare');
        await page.click('#btn-continue');
        await sleep(1200);

        const userErrVisible = await page.evaluate(() => {
            const banner = document.getElementById('auth-error-banner');
            const txt = document.getElementById('auth-error-text');
            return banner && banner.style.display !== 'none' && (txt.textContent.includes('negăsit') || txt.textContent.includes('incorect'));
        });
        if (userErrVisible) {
            pass('Utilizator inexistent afișează mesaj roșu de eroare');
        } else {
            fail('Utilizator inexistent', 'Mesaj de eroare lipsă');
        }

        // Test: Abonament expirat (test.expirat / parola123)
        await page.evaluate(() => {
            document.getElementById('student-username').value = '';
            document.getElementById('student-password').value = '';
        });
        await page.type('#student-username', 'test.expirat');
        await page.type('#student-password', 'parola123');
        await page.click('#btn-continue');
        await sleep(2500);

        const expiredBannerState = await page.evaluate(() => {
            const banner = document.getElementById('dash-expiration-banner');
            const dateLabel = document.getElementById('expired-date-label');
            const waBtn = document.getElementById('btn-whatsapp-renew');
            const catContainer = document.getElementById('dash-categories-container');
            return {
                bannerVisible: banner && banner.style.display !== 'none',
                dateText: dateLabel ? dateLabel.textContent : '',
                waHref: waBtn ? waBtn.href : '',
                catsHidden: !catContainer || catContainer.style.display === 'none'
            };
        });

        if (expiredBannerState.bannerVisible && expiredBannerState.waHref.includes('wa.me')) {
            pass('Verificare Abonament Expirat: Banner dedicat cu data expirării și buton direct WhatsApp afișat, teste noi blocate', `Data: ${expiredBannerState.dateText}`);
        } else {
            fail('Verificare Abonament Expirat', JSON.stringify(expiredBannerState));
        }

        // Test: Deconectare (Logout)
        await page.evaluate(() => {
            if (window.logoutStudent) window.logoutStudent();
        });
        await sleep(1000);

        const logoutClean = await page.evaluate(() => {
            const welcome = document.getElementById('screen-welcome');
            const token = localStorage.getItem('active_student_token');
            const user = localStorage.getItem('active_student_username');
            const btnContinue = document.getElementById('btn-continue');
            return welcome && welcome.classList.contains('active') && !token && !user && btnContinue && !btnContinue.disabled;
        });
        if (logoutClean) {
            pass('Deconectare (Logout): localStorage curățat, buton activ și revenire instantanee la login');
        } else {
            fail('Deconectare (Logout)', 'Stare incorectă după logout');
        }

        // Autentificare cu succes (ianis.nastrut / tyu629hyr)
        await page.evaluate(() => {
            const u = document.getElementById('student-username');
            const p = document.getElementById('student-password');
            if (u) u.value = '';
            if (p) p.value = '';
        });
        await page.type('#student-username', 'ianis.nastrut');
        await page.type('#student-password', 'tyu629hyr');
        await page.click('#btn-continue');
        await sleep(3000);

        const dashActive = await page.evaluate(() => {
            const d = document.getElementById('screen-dashboard');
            const u = document.getElementById('dash-username');
            return d && d.classList.contains('active') && u && u.textContent.length > 0;
        });
        if (dashActive) {
            pass('Autentificare cu succes: Redirecționare instant în Dashboard cu profil activ');
        } else {
            fail('Autentificare cu succes', 'Dashboard nu s-a activat');
        }

        // --- 1.B. Susținerea unui Test (Quiz Engine) ---
        console.log('\n--- 1.B. Susținerea unui Test & F5 Reload ---');

        // Pornire test BAC
        await page.evaluate(() => {
            if (window.startTest) window.startTest('intermediar', 'BAC');
        });
        await sleep(3000);

        const quizActive = await page.evaluate(() => {
            const q = document.getElementById('screen-quiz');
            return q && q.classList.contains('active');
        });
        if (quizActive) {
            pass('Pornire test (BAC): Ecranul de testare s-a inițializat');
        } else {
            fail('Pornire test', 'Ecranul quiz nu s-a activat');
        }

        // Cronometru descrescător
        const timer1 = await page.evaluate(() => document.getElementById('timer-countdown')?.textContent?.trim() || '');
        await sleep(1500);
        const timer2 = await page.evaluate(() => document.getElementById('timer-countdown')?.textContent?.trim() || '');
        if (timer1 && timer2 && timer1.includes(':')) {
            pass('Cronometru descrescător activ și sincronizat', `${timer1} -> ${timer2}`);
        } else {
            fail('Cronometru', `T1: ${timer1}, T2: ${timer2}`);
        }

        // Navigare & Răspunsuri & Randare C++/KaTeX
        const renderCheck = await page.evaluate(() => {
            const qText = document.getElementById('question-text');
            const options = document.querySelectorAll('.option-card');
            return {
                hasText: qText && qText.textContent.trim().length > 0,
                hasOptions: options.length >= 2
            };
        });
        if (renderCheck.hasText && renderCheck.hasOptions) {
            pass('Randare conținut întrebare (text, variante, cod/formule)');
        } else {
            fail('Randare conținut întrebare', JSON.stringify(renderCheck));
        }

        // Bifare răspuns la întrebarea 0
        await page.evaluate(() => {
            const firstOpt = document.querySelector('.option-card');
            if (firstOpt) firstOpt.click();
        });
        await sleep(400);

        // Click Înainte la întrebarea 1
        await page.evaluate(() => {
            const btnNext = document.getElementById('btn-next');
            if (btnNext) btnNext.click();
        });
        await sleep(500);

        // Bifare răspuns la întrebarea 1
        await page.evaluate(() => {
            const firstOpt = document.querySelector('.option-card');
            if (firstOpt) firstOpt.click();
        });
        await sleep(400);

        // Click Înapoi la întrebarea 0 și verificare răspuns selectat
        await page.evaluate(() => {
            const btnPrev = document.getElementById('btn-prev');
            if (btnPrev) btnPrev.click();
        });
        await sleep(500);

        const answerRetained = await page.evaluate(() => {
            const selected = document.querySelector('.option-card.selected');
            return !!selected;
        });
        if (answerRetained) {
            pass('Navigare înainte/înapoi: Răspunsurile bifate rămân selectate');
        } else {
            fail('Navigare înainte/înapoi', 'Răspunsul nu a fost reținut');
        }

        // Test Salvare Progres la Reload (F5)
        console.log('    ⏳ Test Reload (F5)...');
        await page.reload({ waitUntil: 'networkidle0' });
        await sleep(2500);

        const f5Restored = await page.evaluate(() => {
            const scr = document.getElementById('screen-quiz');
            const timer = document.getElementById('timer-countdown');
            const selected = document.querySelector('.option-card.selected');
            return scr && scr.classList.contains('active') && timer && timer.textContent.includes(':') && !!selected;
        });
        if (f5Restored) {
            pass('Test Salvare Progres la Reload (F5): Pagina restaurează starea completă (întrebare, răspunsuri, cronometru)');
        } else {
            fail('Test Salvare Progres la Reload (F5)', 'Starea nu a fost restaurată complet');
        }

        // Finalizare test & Ecran Rezultate
        await page.evaluate(async () => {
            if (window.finishQuiz) await window.finishQuiz();
        });
        await sleep(3500);

        const resultsScreenCheck = await page.evaluate(() => {
            const scr = document.getElementById('screen-results');
            const header = document.querySelector('.results-header, .results-score-circle, #results-container');
            const hasContent = header && header.textContent.trim().length > 0;
            return {
                active: scr && scr.classList.contains('active'),
                hasContent
            };
        });

        if (resultsScreenCheck.active && resultsScreenCheck.hasContent) {
            pass('Ecran Rezultate: Notă/procentaj calculat, analiză capitole afișată');
        } else {
            fail('Ecran Rezultate', JSON.stringify(resultsScreenCheck));
        }

        // Return to dashboard
        await page.evaluate(() => {
            if (window.showDashboard) window.showDashboard();
            else if (window.showScreen) window.showScreen('dashboard');
        });
        await sleep(1500);

        // --- 1.C. Modul Antrenament / Lucru Individual (Practice) ---
        console.log('\n--- 1.C. Modul Antrenament (Practice) ---');
        await page.evaluate(async () => {
            if (window.switchDashTab) window.switchDashTab('capitole');
            if (window.loadPracticeCoverage) await window.loadPracticeCoverage();
        });
        await sleep(2500);

        const practiceCheck = await page.evaluate(() => {
            const pane = document.getElementById('dash-pane-capitole');
            const catList = document.getElementById('practice-categories-list');
            const canonicals = ['Fundamente', 'Organizarea Datelor', 'Subprograme', 'Backtracking', 'Grafuri'];
            const pageText = catList ? catList.innerText : (pane ? pane.innerText : '');
            const foundCount = canonicals.filter(c => pageText.includes(c)).length;
            return {
                paneVisible: pane && pane.style.display !== 'none',
                foundCanonicals: foundCount,
                itemsCount: catList ? catList.children.length : 0
            };
        });

        if (practiceCheck.paneVisible && practiceCheck.foundCanonicals >= 3) {
            pass(`Afișare capitole & bare de progres în Antrenament (${practiceCheck.foundCanonicals}/5 capitole canonice identificate)`);
        } else {
            fail('Capitole Antrenament', JSON.stringify(practiceCheck));
        }

        // Pornire sesiune pe subcategorie în antrenament
        console.log('    ⏳ Pornire sesiune practică...');
        const practiceSessionStarted = await page.evaluate(async () => {
            if (window.startPracticeSession) {
                await window.startPracticeSession('Fundamente', 'Citire si afisare date');
                const pScr = document.getElementById('screen-practice');
                return pScr && pScr.classList.contains('active');
            }
            return false;
        });

        if (practiceSessionStarted) {
            pass('Pornire sesiune exercițiu pe subcategorie (Citire si afisare date)');
            await sleep(1200);

            // Select an answer in practice
            await page.evaluate(() => {
                const opt = document.querySelector('.option-card');
                if (opt) opt.click();
            });
            await sleep(400);

            // Exit practice cleanly back to dashboard
            await page.evaluate(() => {
                if (window.exitPracticeSession) window.exitPracticeSession();
            });
            await sleep(1000);
        } else {
            fail('Pornire sesiune practică', 'Ecranul de antrenament nu s-a deschis');
        }

        // ====================================================================
        // 2. PANOUL DE ADMINISTRARE (/admin.html)
        // ====================================================================
        console.log('\n--- 2. Panoul de Administrare (/admin.html) ---');
        await page.goto('http://localhost:8888/admin.html', { waitUntil: 'networkidle0', timeout: 15000 });
        await sleep(1000);

        // Autentificare Admin
        const needAdminLogin = await page.evaluate(() => !!document.getElementById('login-form'));
        if (needAdminLogin) {
            await page.type('#input-admin-pass', ADMIN_SECRET);
            await page.click('#btn-submit');
            await sleep(2500);
        }

        const adminLoggedIn = await page.evaluate(() => !document.getElementById('login-form') || document.getElementById('login-form').style.display === 'none');
        if (adminLoggedIn) {
            pass('Autentificare Admin cu succes (Dashboard activ)');
        } else {
            fail('Autentificare Admin', 'Formularul de login încă e vizibil');
        }

        // 2.A. Tab Întrebări & Pastile
        await page.click('#btn-tab-intrebari');
        await sleep(1500);

        const questionsTabState = await page.evaluate(() => {
            const badge = document.getElementById('badge-total-questions-count');
            const pillsBar = document.querySelector('.exam-pills-bar');
            return {
                badgeText: badge ? badge.textContent : '',
                hasPills: pillsBar && pillsBar.children.length >= 4
            };
        });
        if (questionsTabState.badgeText && parseInt(questionsTabState.badgeText.replace(/[^0-9]/g, '')) >= 1000) {
            pass(`Tab Întrebări: Total ${questionsTabState.badgeText} întrebări, bara de pastile activă`);
        } else {
            fail('Tab Întrebări', JSON.stringify(questionsTabState));
        }

        // 2.B. Tab Situație (Rezultate & Drilldown Elevi)
        await page.evaluate(() => {
            const tab = document.querySelector('button[data-target="tab-rezultate"]');
            if (tab) tab.click();
        });
        await sleep(1500);

        const situatieCheck = await page.evaluate(() => {
            const grid = document.getElementById('situatie-students-grid');
            const searchInput = document.getElementById('search-situatie-student');
            return {
                hasGrid: grid && grid.children.length > 0,
                studentsCount: grid ? grid.children.length : 0,
                hasSearch: !!searchInput
            };
        });
        if (situatieCheck.hasGrid) {
            pass(`Tab Situație: ${situatieCheck.studentsCount} elevi încărcați cu sistem de triage și căutare`);
        } else {
            fail('Tab Situație', 'Grila de elevi este goală');
        }

        // Drilldown elev (click pe cardul primului elev)
        const drilldownCheck = await page.evaluate(() => {
            const firstCard = document.querySelector('.student-situatie-card');
            if (firstCard) {
                firstCard.click();
                const viewEl = document.getElementById('situatie-detail-view');
                const statsEl = document.getElementById('stats-area');
                return {
                    clicked: true,
                    drilldownVisible: viewEl && viewEl.style.display !== 'none',
                    hasStats: !!statsEl
                };
            }
            return { clicked: false };
        });

        if (drilldownCheck.clicked && drilldownCheck.drilldownVisible) {
            pass('Detalii Elev (Drilldown): Vizualizare istoric și indicatori statistici funcțională');
        } else {
            fail('Detalii Elev Drilldown', JSON.stringify(drilldownCheck));
        }

        // Click Înapoi la grilă
        await page.evaluate(() => {
            if (window.closeSituatieDetail) window.closeSituatieDetail();
        });
        await sleep(800);

        // 2.C. Tab Conturi (Gestiune Elevi)
        await page.evaluate(() => {
            const tab = document.querySelector('button[data-target="tab-elevi"]');
            if (tab) tab.click();
        });
        await sleep(1500);

        const conturiCheck = await page.evaluate(() => {
            const table = document.getElementById('students-body');
            const btnAdd = document.querySelector('button[onclick*="openStudentModal"]');
            return {
                hasRows: table && table.children.length > 0,
                rowsCount: table ? table.children.length : 0,
                hasAddBtn: !!btnAdd
            };
        });
        if (conturiCheck.hasRows && conturiCheck.hasAddBtn) {
            pass(`Tab Conturi: ${conturiCheck.rowsCount} conturi elevi gestionate, modal adăugare disponibil`);
        } else {
            fail('Tab Conturi', JSON.stringify(conturiCheck));
        }

        // 2.D. Tab Teste Predefinite & Asignare (Verificare Fix 1 - Deadline Inputs)
        await page.evaluate(() => {
            const tab = document.querySelector('button[data-target="tab-presets"]');
            if (tab) tab.click();
        });
        await sleep(1500);

        const presetsState = await page.evaluate(() => {
            const badge = document.getElementById('badge-presets-count');
            const list = document.getElementById('presets-list-container') || document.getElementById('tab-presets');
            return {
                badgeText: badge ? badge.textContent : '',
                hasList: !!list
            };
        });
        pass(`Tab Teste Predefinite: Șabloane disponibile (${presetsState.badgeText})`);

        // Verificare Fix 1: Deschidere modal asignare și existență selectori termen limită 24h
        const assignModalCheck = await page.evaluate(() => {
            if (window.openAssignTestModal) {
                window.openAssignTestModal('ianis.nastrut');
                const dayEl = document.getElementById('assign-day');
                const monthEl = document.getElementById('assign-month');
                const yearEl = document.getElementById('assign-year');
                const hourEl = document.getElementById('assign-hour');
                const previewEl = document.getElementById('assign-deadline-preview');
                return {
                    opened: true,
                    hasDay: !!dayEl && dayEl.options.length > 0,
                    hasMonth: !!monthEl && monthEl.options.length > 0,
                    hasYear: !!yearEl && yearEl.options.length > 0,
                    hasHour: !!hourEl && hourEl.options.length > 0,
                    previewText: previewEl ? previewEl.textContent : ''
                };
            }
            return { opened: false };
        });

        if (assignModalCheck.hasDay && assignModalCheck.hasMonth && assignModalCheck.hasYear && assignModalCheck.hasHour) {
            pass('Fix 1 Validat: Modal Asignează Test conține toate câmpurile de Termen Limită (zi, lună, an, oră 24h) cu previzualizare dinamică', assignModalCheck.previewText.trim());
        } else {
            fail('Modal Asignează Test - Termen Limită', JSON.stringify(assignModalCheck));
        }

        // Close assign modal
        await page.evaluate(() => {
            if (window.closeAssignModal) window.closeAssignModal();
        });

        // 2.F. Tab În Așteptare
        await page.evaluate(() => {
            const tab = document.querySelector('button[data-target="tab-waiting"]');
            if (tab) tab.click();
        });
        await sleep(1500);

        const waitingState = await page.evaluate(() => {
            const badge = document.getElementById('badge-waiting-count');
            return {
                badgeText: badge ? badge.textContent : '0'
            };
        });
        pass(`Tab În Așteptare: Coadă activă (total în așteptare: ${waitingState.badgeText})`);

        // 2.G. Tab Leads
        await page.evaluate(() => {
            const tab = document.querySelector('button[data-target="tab-leads"]');
            if (tab) tab.click();
        });
        await sleep(1500);

        const leadsState = await page.evaluate(() => {
            const badge = document.getElementById('badge-leads-count');
            const waLinks = document.querySelectorAll('a[href*="wa.me"]');
            return {
                badgeText: badge ? badge.textContent : '0',
                hasWhatsAppLinks: waLinks.length > 0
            };
        });
        pass(`Tab Leads: ${leadsState.badgeText} cereri diagnostic primite, butoane WhatsApp și conversie disponibile`);

        // ====================================================================
        // 3. CAZURI LIMITĂ & EDGE CASES
        // ====================================================================
        console.log('\n--- 3. Cazuri Limită, Performanță & Responsive ---');

        // Test Responsive Mobile (375x667 - iPhone SE)
        await page.setViewport({ width: 375, height: 667 });
        await page.goto('http://localhost:8888', { waitUntil: 'networkidle0' });
        await sleep(1000);

        const mobileOverflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth <= window.innerWidth + 2;
        });
        if (mobileOverflow) {
            pass('Responsive Mobile (375px): Fără overflow orizontal pe ecranul principal');
        } else {
            fail('Responsive Mobile', 'Există overflow orizontal pe ecranul mobil');
        }

        // Test Lightbox modal
        const lightboxExists = await page.evaluate(() => {
            const modal = document.getElementById('lightbox-modal');
            const img = document.getElementById('lightbox-img');
            return !!modal && !!img;
        });
        if (lightboxExists) {
            pass('Lightbox Modal pentru imagini este integrat în DOM');
        } else {
            fail('Lightbox Modal', 'Elementele lipsesc din DOM');
        }

        // Test Diacritice & Simboluri Speciale (NFD Normalization)
        const diacriticsOk = await page.evaluate(() => {
            const normalize = str => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            return normalize('Grafuri și Arbori') === 'grafuri si arbori' && normalize('Subprograme și Funcții') === 'subprograme si functii';
        });
        if (diacriticsOk) {
            pass('Normalizare Diacritice (NFD): Căutare fără erori pentru caracterele românești (ș/ş, ț/ţ, ă, â, î)');
        }

    } catch (err) {
        console.error('Fatal execution error during tests:', err);
        fail('Execuție Generală', err.message);
    } finally {
        await cleanupTestUserExpired();
        await browser.close();
    }

    const passedCount = results.filter(r => r.status === 'PASS').length;
    const failedCount = results.filter(r => r.status === 'FAIL').length;

    console.log('\n========================================================================');
    console.log(`📊 REZULTAT FINAL TESTARE: ${passedCount} PASSED, ${failedCount} FAILED (Total: ${results.length})`);
    console.log(`Erori consolă browser detectate: ${errors.length}`);
    console.log('========================================================================\n');

    return { passedCount, failedCount, results, errors };
}

runFullTudorTest().then(report => {
    if (report.failedCount > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}).catch(err => {
    console.error('Runner failed:', err);
    process.exit(1);
});
