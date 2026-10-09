const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\Tudor\\.gemini\\antigravity-ide\\brain\\836d1232-4f0f-43c6-9b7a-3879ab75cc01';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runVisualAudit() {
    console.log('🚀 Inițiere Audit Vizual Live (Cu Pornire Test Real)...');
    
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const page = await browser.newPage();
    const cdp = await page.target().createCDPSession();
    await cdp.send('Runtime.enable');
    cdp.on('Runtime.exceptionThrown', params => {
        console.log('  [CDP EXCEPTION]', JSON.stringify(params.exceptionDetails, null, 2));
    });
    page.on('console', msg => console.log('  [CONSOLE]', msg.text()));
    page.on('pageerror', err => console.log('  [PAGEERROR]', err.stack || err.message));
    page.on('requestfailed', req => console.log('  [REQ_FAILED]', req.url(), req.failure()));
    page.on('response', res => { if (res.status() >= 400) console.log('  [RES_ERROR]', res.status(), res.url()); });
    const metrics = {};

    try {
        // ==========================================
        // 1. DESKTOP VIEWPORT (1440 x 900)
        // ==========================================
        await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
        await page.goto('http://localhost:8888', { waitUntil: 'networkidle0', timeout: 15000 });
        await sleep(1000);

        // Screenshot 1: Welcome Desktop
        const pWelcomeDesk = path.join(ARTIFACT_DIR, 'visual_01_welcome_desktop.png');
        await page.screenshot({ path: pWelcomeDesk, fullPage: false });
        console.log('  📸 1. Welcome Desktop salvat');

        // Click Public Initial Test to start real quiz!
        console.log('  ⏳ Deschidere formular Test Public Gratuit...');
        await page.click('#btn-public-initial');
        await page.waitForSelector('#start-first-name', { timeout: 5000 });

        // Fill lead modal
        await page.type('#start-first-name', 'Tudor');
        await page.type('#start-last-name', 'Test');
        await page.type('#start-phone', '0712345678');
        await page.click('#start-gdpr');
        await page.click('#btn-start-lead-submit');
        console.log('  ⏳ Se încarcă întrebările din backend...');
        await page.waitForSelector('#question-text', { timeout: 8000 });
        await sleep(1000);

        // Screenshot 3: Quiz Desktop (Real Question)
        const pQuizDesk = path.join(ARTIFACT_DIR, 'visual_03_quiz_desktop.png');
        await page.screenshot({ path: pQuizDesk, fullPage: false });
        console.log('  📸 3. Quiz Desktop cu întrebare reală salvat');

        // Metrics on active quiz
        metrics.activeQuiz = await page.evaluate(() => {
            const qText = document.getElementById('question-text');
            const qCode = document.getElementById('question-code');
            const opts = document.querySelectorAll('.option-card');
            const timer = document.getElementById('quiz-timer');
            const topBar = document.querySelector('.quiz-info-bar');
            return {
                questionRendered: !!qText && qText.innerText.trim().length > 0,
                codeRendered: !!qCode && qCode.style.display !== 'none',
                optionsCount: opts.length,
                timerText: timer ? timer.innerText.trim() : null,
                topBarDisplay: topBar ? window.getComputedStyle(topBar).display : null
            };
        });

        // Now go to Dashboard
        await page.evaluate(() => {
            localStorage.setItem('active_student_username', 'tudor_test');
            localStorage.setItem('active_student_token', 'mock_token');
            if (window.showScreen) window.showScreen('dashboard');
            else {
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                const dash = document.getElementById('screen-dashboard');
                if (dash) dash.classList.add('active');
            }
        });
        await sleep(800);

        // Check Dashboard layout & logo
        metrics.dashboardLogo = await page.evaluate(() => {
            const avatar = document.querySelector('.dash-header-avatar');
            if (!avatar) return null;
            const rect = avatar.getBoundingClientRect();
            const computed = window.getComputedStyle(avatar);
            return {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                display: computed.display,
                borderRadius: computed.borderRadius
            };
        });

        // Screenshot 2: Dashboard Desktop
        const pDashDesk = path.join(ARTIFACT_DIR, 'visual_02_dashboard_desktop.png');
        await page.screenshot({ path: pDashDesk, fullPage: false });
        console.log('  📸 2. Dashboard Desktop salvat');

        // Switch to Practice Screen
        await page.evaluate(() => {
            if (window.showScreen) window.showScreen('practice');
            else {
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                const p = document.getElementById('screen-practice');
                if (p) p.classList.add('active');
            }
        });
        await sleep(800);

        // Screenshot 4: Practice Desktop
        const pPracticeDesk = path.join(ARTIFACT_DIR, 'visual_04_practice_desktop.png');
        await page.screenshot({ path: pPracticeDesk, fullPage: false });
        console.log('  📸 4. Practice Desktop salvat');

        // ==========================================
        // 2. MOBILE VIEWPORT (390 x 844 - iPhone 14)
        // ==========================================
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        
        // Mobile Welcome
        await page.evaluate(() => {
            if (window.showScreen) window.showScreen('welcome');
            else {
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                const w = document.getElementById('screen-welcome');
                if (w) w.classList.add('active');
            }
        });
        await sleep(600);
        const pWelcomeMob = path.join(ARTIFACT_DIR, 'visual_05_welcome_mobile.png');
        await page.screenshot({ path: pWelcomeMob, fullPage: false });
        console.log('  📸 5. Welcome Mobile salvat');

        // Mobile Dashboard
        await page.evaluate(() => {
            if (window.showScreen) window.showScreen('dashboard');
            else {
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                const d = document.getElementById('screen-dashboard');
                if (d) d.classList.add('active');
            }
        });
        await sleep(600);
        
        metrics.mobileOverflow = await page.evaluate(() => {
            const docWidth = document.documentElement.clientWidth;
            const overflowingEls = [];
            document.querySelectorAll('*').forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.right > docWidth + 1) {
                    overflowingEls.push({
                        tag: el.tagName,
                        id: el.id,
                        className: el.className,
                        right: Math.round(rect.right),
                        width: Math.round(rect.width),
                        overflow: Math.round(rect.right - docWidth)
                    });
                }
            });
            return {
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: docWidth,
                hasHorizontalOverflow: document.documentElement.scrollWidth > docWidth,
                overflowingElements: overflowingEls.slice(0, 8)
            };
        });

        const pDashMob = path.join(ARTIFACT_DIR, 'visual_06_dashboard_mobile.png');
        await page.screenshot({ path: pDashMob, fullPage: false });
        console.log('  📸 6. Dashboard Mobile salvat');

        // Mobile Quiz (Switch back to active quiz)
        await page.evaluate(() => {
            if (window.showScreen) window.showScreen('quiz');
            else {
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                const q = document.getElementById('screen-quiz');
                if (q) q.classList.add('active');
            }
        });
        await sleep(600);
        const pQuizMob = path.join(ARTIFACT_DIR, 'visual_07_quiz_mobile.png');
        await page.screenshot({ path: pQuizMob, fullPage: false });
        console.log('  📸 7. Quiz Mobile salvat');

        // Results Screen Test (Desktop & Diagnostics)
        await page.setViewport({ width: 1200, height: 900 });
        const resEval = await page.evaluate(() => {
            try {
                if (window.timerInterval) clearInterval(window.timerInterval);
                localStorage.removeItem('quiz_in_progress');
                localStorage.removeItem('quiz_current_question');
                window.state.startTime = Date.now() - 78000;
                window.state.endTime = Date.now();
                window.state.studentUsername = 'tudor.curca';
                window.state.blurCount = 2;
                while (window.questions.length < 9) {
                    window.questions.push({ text: 'Sample', options: ['A', 'B', 'C', 'D'] });
                }

                const sampleResults = {
                    totalCorrect: 4,
                    easyCorrect: 1, easyTotal: 2,
                    mediumCorrect: 2, mediumTotal: 4,
                    hardCorrect: 1, hardTotal: 3,
                    totalPoints: 45, maxPoints: 100,
                    level: {
                        name: 'Coder Intermediar',
                        icon: '⚔️ 📘',
                        class: 'level-intermediate',
                        description: 'Ai completat testul! Bun lucru, ai o bază pe care putem construi.'
                    },
                    details: [
                        { number: 1, text: 'Se consideră expresia pseudocod...', difficulty: 'easy', category: 'Fundamente', subcategory: 'Pseudocod', isCorrect: false, studentAnswer: 0, correctAnswer: 1, options: ['A', 'B', 'C', 'D'] },
                        { number: 2, text: 'Ce returnează operatorul modulo?', difficulty: 'medium', category: 'Fundamente', subcategory: 'Operatori si expresii', isCorrect: false, studentAnswer: 0, correctAnswer: 1, options: ['A', 'B', 'C', 'D'] },
                        { number: 3, text: 'Funcția recursivă f(n)...', difficulty: 'medium', category: 'Subprograme', subcategory: 'Recursivitate', isCorrect: false, studentAnswer: 0, correctAnswer: 1, options: ['A', 'B', 'C', 'D'] },
                        { number: 4, text: 'Numărul de permutări pentru n=4', difficulty: 'hard', category: 'Backtracking', subcategory: 'Permutari', isCorrect: false, studentAnswer: 0, correctAnswer: 1, options: ['A', 'B', 'C', 'D'] },
                        { number: 5, text: 'Pentru arborele cu rădăcina 1...', difficulty: 'hard', category: 'Grafuri si Arbori', subcategory: 'Arbori', isCorrect: false, studentAnswer: 0, correctAnswer: 1, options: ['A', 'B', 'C', 'D'] },
                        { number: 6, text: 'Parcurgerea vectorului v...', difficulty: 'medium', category: 'Organizarea Datelor', subcategory: 'Tablouri unidimensionale', isCorrect: true, studentAnswer: 1, correctAnswer: 1, options: ['A', 'B', 'C', 'D'] },
                        { number: 7, text: 'Lungimea șirului de caractere...', difficulty: 'medium', category: 'Organizarea Datelor', subcategory: 'Siruri de caractere', isCorrect: true, studentAnswer: 2, correctAnswer: 2, options: ['A', 'B', 'C', 'D'] }
                    ]
                };
                window.renderResults(sampleResults);
                document.querySelectorAll('.screen').forEach(s => {
                    s.classList.remove('active');
                    s.style.display = 'none';
                });
                const resScreen = document.getElementById('screen-results');
                if (resScreen) {
                    resScreen.classList.add('active');
                    resScreen.style.display = 'flex';
                }
                return { success: true };
            } catch (err) {
                return { error: err.message, stack: err.stack };
            }
        });
        console.log('  Result eval output:', resEval);
        await sleep(1000);
        const pResultsDesk = path.join(ARTIFACT_DIR, 'visual_08_results_desktop.png');
        await page.screenshot({ path: pResultsDesk, fullPage: true });
        console.log('  📸 8. Results Desktop salvat');

        console.log('\n📊 REZULTATE METRICI VIZUALE:');
        console.log(JSON.stringify(metrics, null, 2));

    } catch (err) {
        console.error('Eroare în timpul auditului vizual:', err);
    } finally {
        await browser.close();
    }
}

runVisualAudit();
