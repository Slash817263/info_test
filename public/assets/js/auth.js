import { apiFetch } from './api.js';
import { $, $$, els } from './dom.js';
import { checkPracticeAnswer, selectPracticeOption, nextPracticeQuestion } from './practice.js';
import { loadDashboard, handleLogin, renderQuestion, clearStateFromStorage, startTimer, selectAnswer, saveAssignedProgress, goNext, goPrev, logoutStudent, restartQuiz, setupAntiCheat, timerDurationMs, setTimerDurationMs } from './quiz.js';
import { questions, state, setQuestions } from './state.js';
import { showScreen } from './ui.js';
import { escapeHtml, parseImageUrls, showToast, formatTime } from './utils.js';
import { renderMath } from './math.js';

/* ========================================================================
   EVENT LISTENERS
   ======================================================================== */
// Continue button -> handles login logic
els.btnContinue.addEventListener('click', handleLogin);

// Enter key on inputs
els.studentUsername.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.studentPassword.focus();
});
els.studentPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !els.btnContinue.disabled) handleLogin();
});

// Auto-hide error banner when student types
const hideAuthBanner = () => {
    const banner = document.getElementById('auth-error-banner');
    if (banner) banner.style.display = 'none';
};
els.studentUsername.addEventListener('input', hideAuthBanner);
els.studentPassword.addEventListener('input', hideAuthBanner);

// Option selection (delegated)
els.optionsContainer.addEventListener('click', (e) => {
    const card = e.target.closest('.option-card');
    if (card) selectAnswer(parseInt(card.dataset.index));
});

// Option keyboard selection (delegated)
els.optionsContainer.addEventListener('keydown', (e) => {
    const card = e.target.closest('.option-card');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        selectAnswer(parseInt(card.dataset.index));
    }
});

// Navigation buttons
els.btnNext.addEventListener('click', goNext);
els.btnPrev.addEventListener('click', goPrev);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    const isQuizActive = els.screenQuiz && els.screenQuiz.classList.contains('active');
    const practiceScreen = document.getElementById('screen-practice');
    const isPracticeActive = practiceScreen && practiceScreen.classList.contains('active');

    if (isQuizActive) {
        // Number keys 1-6
        if (e.key >= '1' && e.key <= '6') {
            const pressedIndex = parseInt(e.key) - 1;
            const q = questions[state.currentQuestion];
            if (q && q.options && pressedIndex < q.options.length) {
                if (q.displayOrder && q.displayOrder[pressedIndex] !== undefined) {
                    selectAnswer(q.displayOrder[pressedIndex]);
                } else {
                    selectAnswer(pressedIndex);
                }
            }
        }

        // Letter keys A-F
        const letterMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, 'f': 5, 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5 };
        if (letterMap[e.key] !== undefined) {
            const pressedIndex = letterMap[e.key];
            const q = questions[state.currentQuestion];
            if (q && q.options && pressedIndex < q.options.length) {
                if (q.displayOrder && q.displayOrder[pressedIndex] !== undefined) {
                    selectAnswer(q.displayOrder[pressedIndex]);
                } else {
                    selectAnswer(pressedIndex);
                }
            }
        }

        if (e.key === 'ArrowRight' && !els.btnNext.disabled) {
            goNext();
        }
        if (e.key === 'ArrowLeft') {
            goPrev();
        }
    } else if (isPracticeActive) {
        const letterMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, 'f': 5, 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5 };
        const isNum = e.key >= '1' && e.key <= '6';
        const isLetter = letterMap[e.key] !== undefined;

        if (isNum || isLetter) {
            const optIdx = isNum ? (parseInt(e.key) - 1) : letterMap[e.key];
            selectPracticeOption(optIdx);
        }

        if (e.key === 'Enter' || e.key === 'ArrowRight') {
            const btnCheck = document.getElementById('btn-practice-check');
            const btnNext = document.getElementById('btn-practice-next');
            if (btnCheck && btnCheck.style.display !== 'none' && !btnCheck.disabled) {
                checkPracticeAnswer();
            } else if (btnNext && btnNext.style.display !== 'none') {
                nextPracticeQuestion();
            }
        }
    }
});

// Exit test button
export const btnExit = $('#btn-exit');
export const modalExit = $('#modal-exit');
export const btnCancelExit = $('#btn-cancel-exit');
export const btnConfirmExit = $('#btn-confirm-exit');
export const modalAssignedExit = $('#modal-assigned-exit');
export const btnAssignedCancelExit = $('#btn-assigned-cancel-exit');
export const btnAssignedConfirmExit = $('#btn-assigned-confirm-exit');

window.handleAssignedExitClick = function() {
    if (state.assignedTestId) {
        saveAssignedProgress();
        const answeredCount = (state.answers || []).filter(a => a !== null && a !== undefined).length;
        const totalCount = (questions || []).length;
        const modalText = document.getElementById('modal-assigned-exit-text');
        if (modalText) {
            modalText.innerHTML = `Ai răspuns la <strong>${answeredCount} din ${totalCount}</strong> întrebări.<br><br>Toate răspunsurile tale sunt salvate pe server. Poți părăsi tema acum și poți continua oricând din panou exact de unde ai rămas!`;
        }
        if (modalAssignedExit) modalAssignedExit.style.display = 'flex';
    } else {
        if (modalExit) modalExit.style.display = 'flex';
    }
};

if (btnExit) {
    btnExit.addEventListener('click', () => {
        if (state.assignedTestId) {
            window.handleAssignedExitClick();
        } else {
            if (modalExit) modalExit.style.display = 'flex';
        }
    });
}
if (btnCancelExit && modalExit) {
    btnCancelExit.addEventListener('click', () => { modalExit.style.display = 'none'; });
}
if (btnConfirmExit && modalExit) {
    btnConfirmExit.addEventListener('click', () => { modalExit.style.display = 'none'; restartQuiz(); });
}
if (modalExit) {
    modalExit.addEventListener('click', (e) => { if (e.target === modalExit) modalExit.style.display = 'none'; });
}

if (btnAssignedCancelExit && modalAssignedExit) {
    btnAssignedCancelExit.addEventListener('click', () => {
        modalAssignedExit.style.display = 'none';
    });
}
if (btnAssignedConfirmExit && modalAssignedExit) {
    btnAssignedConfirmExit.addEventListener('click', () => {
        saveAssignedProgress();
        modalAssignedExit.style.display = 'none';
        restartQuiz();
        showToast('✓ Progresul tău este salvat. Poți continua tema oricând!');
    });
}
if (modalAssignedExit) {
    modalAssignedExit.addEventListener('click', (e) => {
        if (e.target === modalAssignedExit) modalAssignedExit.style.display = 'none';
    });
}

// Anti-cheat setup
setupAntiCheat();

/* ========================================================================
   INIT
   ======================================================================== */
export let questionsLoaded = false; export function setQuestionsLoaded(val) { questionsLoaded = val; }

export async function initApp() {
    try {
        // Questions are loaded dynamically on login
        setQuestionsLoaded(true);

        // Check localStorage for active session
        const savedStartTime = localStorage.getItem('quiz_start_time');
        const savedStudentUsername = localStorage.getItem('quiz_student_username');
        const savedCurrentQuestion = localStorage.getItem('quiz_current_question');
        const savedAnswers = localStorage.getItem('quiz_answers');
        const savedTestType = localStorage.getItem('quiz_test_type');
        const savedExamType = localStorage.getItem('quiz_exam_type');
        const savedQuestionsIds = localStorage.getItem('quiz_questions_ids');
        const savedStudentId = localStorage.getItem('quiz_student_id');
        const savedAssignedTestId = localStorage.getItem('quiz_assigned_test_id');
        const activeUser = localStorage.getItem('active_student_username');
        const activeId = localStorage.getItem('active_student_id');

        if (savedStartTime && savedStudentUsername && savedAnswers && savedQuestionsIds) {
            state.startTime = parseInt(savedStartTime);
            state.studentUsername = savedStudentUsername;
            state.studentId = savedStudentId;
            state.testType = savedTestType || 'initial';
            state.examType = savedExamType || 'Initial';
            state.assignedTestId = savedAssignedTestId || null;
            state.blurCount = parseInt(localStorage.getItem('quiz_blur_count') || '0');
            state.currentQuestion = savedCurrentQuestion ? parseInt(savedCurrentQuestion) : 0;

            // Fetch exactly the questions for the restored test
            const savedIds = JSON.parse(savedQuestionsIds);
            const idsParam = savedIds.join(',');
            const res = await apiFetch(`/.netlify/functions/fetch-questions?ids=${idsParam}`);
            if (res.ok) {
                const fetchedQs = await res.json();
                setQuestions(fetchedQs);
            }

            if (questions.length === 0) {
                // fallback if failed to fetch
                clearStateFromStorage();
                if (activeUser) {
                    state.studentUsername = activeUser;
                    state.studentId = activeId || null;
                    showScreen('dashboard');
                    return loadDashboard(activeUser, activeId);
                }
                return showScreen('welcome');
            }

            setTimerDurationMs( (state.examType === 'Initial') ? 30 * 60 * 1000 : 60 * 60 * 1000);

            let maxAllowedTimeMs = timerDurationMs;

            if (!state.assignedTestId && (Date.now() - state.startTime > maxAllowedTimeMs)) {
                showToast('Timpul alocat testului a expirat.', true);
                clearStateFromStorage();
                if (activeUser) {
                    state.studentUsername = activeUser;
                    state.studentId = activeId || null;
                    showScreen('dashboard');
                    return loadDashboard(activeUser, activeId);
                }
                return showScreen('welcome');
            }

            const parsedAnswers = JSON.parse(savedAnswers);
            if (Array.isArray(parsedAnswers) && parsedAnswers.length === questions.length) {
                state.answers = parsedAnswers;
            } else {
                state.answers = new Array(questions.length).fill(null);
            }

            const savedTimings = localStorage.getItem('quiz_question_timings');
            if (savedTimings) {
                state.questionTimings = JSON.parse(savedTimings);
            } else {
                state.questionTimings = new Array(questions.length).fill(0);
            }

            const savedDisplayOrders = localStorage.getItem('quiz_display_orders');
            if (savedDisplayOrders) {
                try {
                    const orders = JSON.parse(savedDisplayOrders);
                    if (Array.isArray(orders)) {
                        orders.forEach((ord, i) => {
                            if (questions[i] && ord) questions[i].displayOrder = ord;
                        });
                    }
                } catch (e) { }
            }

            const timerBadge = $('#quiz-timer');
            const anticheatBadge = els.anticheatBadge || $('#anticheat-badge');

            if (state.assignedTestId) {
                if (timerBadge) timerBadge.style.display = 'none';
                if (anticheatBadge) anticheatBadge.style.display = 'none';
            } else {
                if (timerBadge) timerBadge.style.display = '';
                if (anticheatBadge) {
                    anticheatBadge.style.display = '';
                    if (state.blurCount >= 5) anticheatBadge.className = 'anticheat-badge danger';
                    else if (state.blurCount >= 2) anticheatBadge.className = 'anticheat-badge warned';
                }
                els.blurCountDisplay.textContent = state.blurCount;
                startTimer();
            }

            // Pre-fill username
            els.studentUsername.value = state.studentUsername;

            showScreen('quiz');
            renderQuestion();
        } else {
            if (activeUser) {
                state.studentUsername = activeUser;
                state.studentId = activeId || null;
                showScreen('dashboard');
                loadDashboard(activeUser, activeId);
            } else {
                // Not logged in
                if (localStorage.getItem('quiz_lead_modal_open') === 'true') {
                    localStorage.removeItem('quiz_lead_modal_open');
                    setTimeout(() => {
                        if (window.startPublicInitialTest) {
                            window.startPublicInitialTest();
                        }
                    }, 120);
                }
            }
        }
    } catch (err) {
        console.error('Initialization error:', err);
        showToast('Eroare la incarcarea testului.');
    }
}

// Lightbox Functions
export function openLightbox(url) {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    if (modal && img && url) {
        img.src = url;
        modal.style.display = 'flex';
    }
}
window.openLightbox = openLightbox;

export function closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (modal) modal.style.display = 'none';
}
window.closeLightbox = closeLightbox;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
});

// Copy Protection & DevTools Blocking for Active Quiz
document.addEventListener('contextmenu', (e) => {
    const quizScreen = document.getElementById('screen-quiz');
    if (quizScreen && quizScreen.classList.contains('active')) {
        e.preventDefault();
        showToast('Click-dreapta este dezactivat în timpul testului!');
    }
});

document.addEventListener('keydown', (e) => {
    const quizScreen = document.getElementById('screen-quiz');
    if (quizScreen && quizScreen.classList.contains('active')) {
        if (e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
            (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V'))) {
            e.preventDefault();
            showToast('Comenzile de copiere / DevTools sunt dezactivate în timpul testului!');
        }
    }
});

// ==================== SITUATIA MEA (ELEV) ====================
export function showDashboard() {
    showScreen('dashboard');
    const user = state.studentUsername || localStorage.getItem('active_student_username');
    const id = state.studentId || localStorage.getItem('active_student_id');
    if (user && window.loadDashboard) {
        window.loadDashboard(user, id);
    }
}
window.showDashboard = showDashboard;

export async function showSituatiaMea() {
    if (state.hasCompletedInitial === false && !state.isExpired) {
        showToast('Trebuie să susții testul de evaluare inițială mai întâi!', true);
        showScreen('dashboard');
        return;
    }
    showScreen('situatie');
    const listHistory = document.getElementById('list-situatia-history');
    if (listHistory) {
        listHistory.innerHTML = '<div class="spinner" style="margin: 30px auto;"></div>';
    }

    try {
        const username = state.studentUsername || localStorage.getItem('active_student_username') || '';
        state.studentUsername = username;
        const token = localStorage.getItem('active_student_token') || '';

        if (!username) {
            showToast('Te rugăm să te autentifici din nou.', true);
            logoutStudent();
            return;
        }

        // Fetch past results for the student
        const resHistory = await fetch(`/.netlify/functions/fetch-results?username=${encodeURIComponent(username)}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        let historyTests = [];
        if (resHistory.ok) {
            historyTests = await resHistory.json();
        } else if (resHistory.status === 401 || resHistory.status === 403) {
            showToast('Sesiune expirată.', true);
            logoutStudent();
            return;
        }

        renderSituatiaStudent(historyTests);

        // Load Coverage in Situatia Mea
        loadSituatiaCoverage(username);
    } catch (e) {
        console.error(e);
        showToast('Eroare la încărcarea situației.', true);
        if (listHistory) listHistory.innerHTML = '<p style="color:var(--accent-red)">Eroare la încărcare.</p>';
    }
}

export function generateRadarChartSVG(categories) {
    const defaultCats = [
        { name: 'Fundamente', icon: '📘' },
        { name: 'Organizarea Datelor', icon: '📗' },
        { name: 'Subprograme', icon: '📙' },
        { name: 'Backtracking', icon: '📕' },
        { name: 'Grafuri si Arbori', icon: '📓' }
    ];

    const catMap = {};
    (categories || []).forEach(c => {
        catMap[c.category] = c.percent || 0;
    });

    // Dimensiuni & layout: viewBox 650 x 390 oferă spațiu generos pentru etichete mari fără suprapuneri
    const cx = 325;
    const cy = 195;
    const R = 105;
    const n = 5;

    // Scalare logaritmică: log10(1 + 9 * x)
    const getLogRadius = (pct) => {
        if (!pct || pct <= 0) return 0.08 * R;
        const norm = Math.min(Math.max(pct, 0), 100) / 100;
        const logRatio = Math.log10(1 + 9 * norm);
        return Math.max(logRatio, 0.08) * R;
    };

    // Nivelurile grilei corespunzătoare reperelor logaritmice (10%, 25%, 50%, 75%, 100%)
    const milestoneLevels = [
        { pct: 10, ratio: Math.log10(1 + 9 * 0.10) },
        { pct: 25, ratio: Math.log10(1 + 9 * 0.25) },
        { pct: 50, ratio: Math.log10(1 + 9 * 0.50) },
        { pct: 75, ratio: Math.log10(1 + 9 * 0.75) },
        { pct: 100, ratio: 1.0 }
    ];

    let gridSvg = '';
    milestoneLevels.forEach((m, mIdx) => {
        const pts = [];
        for (let i = 0; i < n; i++) {
            const angle = (-Math.PI / 2) + (i * 2 * Math.PI / n);
            const x = cx + m.ratio * R * Math.cos(angle);
            const y = cy + m.ratio * R * Math.sin(angle);
            pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        }
        const isOuter = mIdx === milestoneLevels.length - 1;
        gridSvg += `<polygon class="radar-grid ${isOuter ? 'outer' : ''}" points="${pts.join(' ')}" />`;
        const labelY = cy - m.ratio * R + 3;
        gridSvg += `<text x="${cx + 4}" y="${labelY.toFixed(1)}" fill="rgba(255,255,255,0.35)" font-size="9" font-family="monospace">${m.pct}%</text>`;
    });

    // Axe, Date poligon și Etichete
    let axesSvg = '';
    let dataPts = [];
    let vertexSvg = '';
    let labelsSvg = '';

    for (let i = 0; i < n; i++) {
        const catInfo = defaultCats[i];
        const pct = catMap[catInfo.name] !== undefined ? catMap[catInfo.name] : 0;
        const angle = (-Math.PI / 2) + (i * 2 * Math.PI / n);

        // Linie axă
        const axX = cx + R * Math.cos(angle);
        const axY = cy + R * Math.sin(angle);
        axesSvg += `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${axX.toFixed(1)}" y2="${axY.toFixed(1)}" />`;

        // Punct de date cu scalare logaritmică
        const valR = getLogRadius(pct);
        const px = cx + valR * Math.cos(angle);
        const py = cy + valR * Math.sin(angle);
        dataPts.push(`${px.toFixed(1)},${py.toFixed(1)}`);

        vertexSvg += `<circle class="radar-point" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5">
            <title>${catInfo.name}: ${pct}%</title>
        </circle>`;

        // Poziție etichetă sigură în afara cercului exterior fără suprapuneri
        const labelR = R + 24;
        const lx = cx + labelR * Math.cos(angle);
        const ly = cy + labelR * Math.sin(angle);
        
        let textAnchor = 'middle';
        if (Math.cos(angle) > 0.2) {
            textAnchor = 'start';
        } else if (Math.cos(angle) < -0.2) {
            textAnchor = 'end';
        }

        const pctColor = pct >= 75 ? '#34d399' : (pct >= 50 ? '#fbbf24' : '#f87171');

        labelsSvg += `
            <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${textAnchor}" class="radar-axis-label" dominant-baseline="central">
                ${catInfo.icon} ${catInfo.name} <tspan dx="4" fill="${pctColor}" font-weight="900" class="radar-pct-label">(${pct}%)</tspan>
            </text>
        `;
    }

    return `
        <svg viewBox="0 0 650 390" class="radar-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="radar-gradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#7c6aff" stop-opacity="0.65" />
                    <stop offset="60%" stop-color="#38bdf8" stop-opacity="0.4" />
                    <stop offset="100%" stop-color="#00d4aa" stop-opacity="0.25" />
                </radialGradient>
            </defs>
            ${gridSvg}
            ${axesSvg}
            <polygon class="radar-polygon" points="${dataPts.join(' ')}" />
            ${vertexSvg}
            ${labelsSvg}
        </svg>
    `;
}

export async function loadSituatiaCoverage(username) {
    const section = document.getElementById('situatia-coverage-section');
    if (!section) return;
    const token = localStorage.getItem('active_student_token') || '';

    try {
        const res = await apiFetch(`/.netlify/functions/fetch-mastery?username=${encodeURIComponent(username)}`);
        if (!res.ok) return;
        const data = await res.json();

        // Convert new mastery format to old radar array format for the SVG
        const catArray = Object.keys(data.mastery).map(catName => ({
            category: catName,
            percent: data.mastery[catName].percentage,
            mastered: data.mastery[catName].correct,
            total: data.mastery[catName].seen,
            subcategories: data.mastery[catName].subcategories
        }));
        
        let totalMastered = 0, totalSeen = 0;
        catArray.forEach(c => { totalMastered += c.mastered; totalSeen += c.total; });
        const overall_percent = totalSeen > 0 ? Math.round((totalMastered/totalSeen)*100) : 0;

        const radarChartHtml = generateRadarChartSVG(catArray);

        // Find weakest categories for Coada Azi message
        let weakCats = catArray.filter(c => c.percent < 60 && c.total > 0).sort((a,b) => a.percent - b.percent);
        let coadaText = "Azi poți începe cu un test echilibrat de cunoștințe.";
        if (weakCats.length > 0) {
            coadaText = `Astăzi ar trebui să revizuiești întrebările greșite la <strong>${escapeHtml(weakCats[0].category)}</strong> și să îți fortifici cunoștințele.`;
            if (weakCats.length > 1) {
                coadaText = `Astăzi ai de revizuit întrebări la <strong>${escapeHtml(weakCats[0].category)}</strong> și de lucrat suplimentar la <strong>${escapeHtml(weakCats[1].category)}</strong>.`;
            }
        }

        let html = `
            <!-- Interactive Radar Spider Web Chart Card -->
            <div class="radar-chart-card glow-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                    <h3 style="font-size: 16px; margin: 0; color: #fff; display:flex; align-items:center; gap:8px;">
                        <span>🕸️</span> Harta Cunoștințelor
                    </h3>
                    <span style="font-size: 14px; font-weight: 700; color: #38bdf8;">${overall_percent}% Nivel Global</span>
                </div>
                <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 12px 0;">
                    Vizualizează echilibrul pregătirii tale pe cele 5 mari capitole.
                </p>
                <div class="radar-chart-container">
                    ${radarChartHtml}
                </div>
                
                <div style="margin-top: 20px; display: grid; gap: 10px;">
                    ${catArray.map(c => {
                        let statusColor = c.percent >= 80 ? 'var(--accent-green)' : (c.percent >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)');
                        let statusText = c.percent >= 80 ? 'Stăpânit' : (c.percent >= 50 ? 'Aproape' : (c.total > 0 ? 'Risc ridicat. Trebuie lucrat' : 'Neatins'));
                        return `<div style="display: flex; justify-content: space-between; font-size: 13px;">
                            <span style="color: var(--text-secondary)">${escapeHtml(c.category)}:</span>
                            <span style="color: ${statusColor}; font-weight: 600;">${c.percent}% — ${statusText}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <!-- Coada Azi (Test Zilnic Adaptiv) -->
            ${data.hasDailyToday || state.isExpired ? '' : `
            <div class="glow-card" style="background: linear-gradient(145deg, rgba(56,189,248,0.15), rgba(0,0,0,0.45)); border: 1px solid #38bdf8; border-radius: var(--radius-md); padding: 20px; margin-bottom: 20px; text-align: center; box-shadow: 0 4px 20px rgba(56,189,248,0.2);">
                <div style="font-weight: 700; font-size: 17px; color: #fff; margin-bottom: 6px; text-align: center;">🎯 Test Zilnic Adaptiv</div>
                <div style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 18px; text-align: center; line-height: 1.5; max-width: 580px; margin-left: auto; margin-right: auto;">${coadaText}</div>
                <button onclick="startTest('intermediar', 'Zilnic')" class="btn btn-primary" style="width: 100%; padding: 13px; font-size: 15px; font-weight: 700; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border:none; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow: 0 4px 15px rgba(14, 165, 233, 0.35);">
                    <span>🚀</span> Începe Testul Zilnic
                </button>
            </div>
            `}

            <div class="glow-card" style="background: rgba(15, 15, 40, 0.6); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                    <h3 style="font-size: 16px; margin: 0; color: #fff; display:flex; align-items:center; gap:8px;">
                        <span>📊</span> Acoperirea Materiei (Răspunsuri corecte / văzute)
                    </h3>
                    <span style="font-size: 16px; font-weight: 800; color: var(--accent-purple);">${overall_percent}% Total</span>
                </div>
                <div class="practice-master-bar" style="margin-bottom: 16px;">
                    <div class="practice-master-fill" style="width: ${overall_percent}%;"></div>
                </div>
                <div class="coverage-categories-grid">
        `;

        const catIcons = {
            'Fundamente': '📘',
            'Organizarea Datelor': '📗',
            'Subprograme': '📙',
            'Backtracking': '📕',
            'Grafuri si Arbori': '📓'
        };

        catArray.forEach(cat => {
            const icon = catIcons[cat.category] || '📂';
            html += `
                <div class="coverage-cat-card" onclick="openStudentCategoryQuestions('${escapeHtml(cat.category)}')" style="cursor: pointer;" title="Apasă pentru a vedea întrebările din acest capitol">
                    <div class="coverage-cat-top">
                        <span class="coverage-cat-title">${icon} ${escapeHtml(cat.category)}</span>
                        <span class="coverage-cat-percent">${cat.percent}%</span>
                    </div>
                    <div class="practice-mini-bar" style="margin-bottom: 8px;">
                        <div class="practice-mini-fill" style="width: ${cat.percent}%;"></div>
                    </div>
                    <div class="coverage-cat-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <span style="font-size: 13px; font-weight: 600; color: #cbd5e1; white-space: nowrap;">${cat.mastered} / ${cat.total} corecte</span>
                        <span style="font-size: 12px; color: #38bdf8; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center; gap: 2px;">Vezi întrebări →</span>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        section.innerHTML = html;
    } catch (e) {
        console.error('loadSituatiaCoverage error', e);
    }
}

export function getTestDisplayInfo(ht) {
    const rawType = (ht.test_type || 'initial').toLowerCase().trim();
    const isAssigned = rawType === 'tema' || rawType.startsWith('tema') || !!ht.assigned_test_id;
    const isInitial = !isAssigned && (rawType === 'initial' || rawType.startsWith('initial') || !ht.test_type);

    let examCategory = ht.exam_type || '';
    if (!examCategory && (rawType.includes(':') || (rawType.includes('_') && !rawType.startsWith('progress_')))) {
        examCategory = rawType.split(/[:_]/)[1];
    }
    
    // If still not determined, inspect details_json
    if (!examCategory && Array.isArray(ht.details_json) && ht.details_json.length > 0) {
        const firstWithExam = ht.details_json.find(d => d && d.exam_type);
        if (firstWithExam) {
            examCategory = firstWithExam.exam_type;
        } else {
            const has6Opts = ht.details_json.some(d => d && Array.isArray(d.options) && d.options.length > 4);
            if (has6Opts) {
                examCategory = 'Poli';
            } else if (ht.details_json.length === 9) {
                examCategory = 'Academie';
            } else if (ht.details_json.length === 50) {
                examCategory = 'Inițial';
            } else {
                examCategory = 'Diverse';
            }
        }
    }

    if (isInitial) {
        return {
            title: 'Test Inițial',
            badgeText: 'Inițial',
            category: 'Inițial'
        };
    }

    if (isAssigned) {
        const cat = examCategory && examCategory !== 'Initial' ? examCategory : 'BAC';
        const displayTitle = ht.title || ht.test_title || (ht.details_json && ht.details_json[0] && ht.details_json[0].test_title) || `Temă (${cat})`;
        return {
            title: displayTitle,
            badgeText: `Temă • ${cat}`,
            category: cat
        };
    }

    if (examCategory === 'Zilnic' || rawType.includes('zilnic')) {
        return {
            title: 'Test Zilnic Adaptiv',
            badgeText: 'Zilnic',
            category: 'Zilnic'
        };
    }

    // Intermediate test
    const cat = examCategory || 'Diverse';
    return {
        title: `Test Intermediar (${cat})`,
        badgeText: `Intermediar • ${cat}`,
        category: cat
    };
}

export function renderSituatiaStudent(historyTests) {
    const listHistory = document.getElementById('list-situatia-history');
    if (!listHistory) return;

    const actualTests = (historyTests || []).filter(ht => ht.test_type !== 'category_coverage');

    // Render History
    if (!actualTests || actualTests.length === 0) {
        listHistory.innerHTML = '<p style="color: var(--text-muted); font-size: 14px; padding: 20px 0;">Nu ai susținut încă niciun test.</p>';
    } else {
        listHistory.innerHTML = actualTests.map((ht, idx) => {
            const rawType = (ht.test_type || 'initial').toLowerCase().trim();
            const isAssigned = rawType === 'tema' || rawType.startsWith('tema') || !!ht.assigned_test_id;
            const isInitial = !isAssigned && (rawType === 'initial' || rawType.startsWith('initial') || !ht.test_type);
            const isIntermediate = !isAssigned && !isInitial;
            const info = getTestDisplayInfo(ht);

            const pct = Math.round((ht.score / ht.total_points) * 100) || 0;
            const timeInfo = isAssigned ? '' : ` | Timp: ${formatTime(ht.time_taken_ms)}`;

            return `
                        <div class="option-card" style="margin-bottom: 12px; display:block; padding: 16px;" onclick="toggleHistoryDetails('history-details-${ht.id}')">
                            <div style="display:flex; justify-content:space-between; align-items:center; cursor: pointer;">
                                <div>
                                    <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${info.title} - ${ht.score}/${ht.total_points} puncte</div>
                                    <div style="font-size: 13px; color: var(--text-secondary);">Data: ${new Date(ht.created_at).toLocaleString('ro-RO')}${timeInfo}</div>
                                </div>
                                <div style="font-weight: 700; color: var(--accent-purple); font-size: 18px;">${pct}%</div>
                            </div>
                            <div id="history-details-${ht.id}" style="display:none; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
                                ${generateHistoryDetailsHTML(ht.details_json, ht.id, isIntermediate)}
                            </div>
                        </div>
                    `;
        }).join('');
    }
}

export function toggleHistoryDetails(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.style.display === 'none') {
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}
window.toggleHistoryDetails = toggleHistoryDetails;
window.showSituatiaMea = showSituatiaMea;

export function generateHistoryDetailsHTML(details, htId = '', isIntermediate = false) {
    if (!details || details.length === 0) {
        return '<p style="color:var(--text-muted); font-size:13px;">Nu există detalii salvate.</p>';
    }
    return details.map((d, i) => {
        const isOk = d.isCorrect;
        const badge = isOk ? `<span style="color:var(--accent-green); font-weight:bold; font-size:12px;">✔️ Corect</span>` : `<span style="color:var(--accent-red); font-weight:bold; font-size:12px;">❌ Greșit</span>`;

        const optsHtml = (d.options || []).map((optText, optIdx) => {
            const isStudentChoice = d.studentAnswer === optIdx;
            const isCorrectChoice = d.correctAnswer === optIdx;
            let color = 'var(--text-secondary)';
            let weight = 'normal';
            let marker = '';
            if (isCorrectChoice) { color = 'var(--accent-green)'; weight = 'bold'; marker = ' (Corect)'; }
            else if (isStudentChoice && !isOk) { color = 'var(--accent-red)'; weight = 'bold'; marker = ' (Ales de tine)'; }

            return `<div style="color:${color}; font-weight:${weight}; font-size:13px; margin-bottom:4px;">${String.fromCharCode(65 + optIdx)}. ${escapeHtml(optText)} ${marker}</div>`;
        }).join('');

        const codeHtml = d.code ? `<pre style="background:#0c0d1e; padding:10px; border-radius:4px; font-size:12px; color:#a6accd; margin:8px 0; overflow-x:auto;">${escapeHtml(d.code)}</pre>` : '';
        const hImgs = parseImageUrls(d.image_url);
        const imageHtml = hImgs.length > 0 ? `
            <div class="question-images-container" style="display:flex; flex-direction:column; align-items:center; gap:8px; margin:10px auto; text-align:center;">
                ${hImgs.map(url => `<img src="${url}" class="question-img-item" style="max-height:160px; border-radius:6px; margin:0 auto;" onclick="openLightbox('${url}')">`).join('')}
            </div>` : '';

        // Hint only shown for intermediate tests in history
        const hintHtml = (isIntermediate && d.hint && d.hint.trim() !== '') ? `
            <div style="margin-top:8px;">
                <button type="button" class="btn-hint-inline" onclick="event.stopPropagation(); toggleReviewHint('hist-hint-${htId}-${i}');">
                    <span>💡</span> HINT
                </button>
                <div id="hist-hint-${htId}-${i}" style="display:none; margin-top:6px; padding:8px 12px; border-radius:6px; background:rgba(251,191,36,0.06); border-left:3px solid #fbbf24; font-size:13px; color:#cbd5e1; line-height:1.4;">
                    💡 <em>${escapeHtml(d.hint)}</em>
                </div>
            </div>
        ` : '';

        return `
                    <div style="background:rgba(255,255,255,0.02); border-radius:8px; padding:12px; margin-bottom:12px; border:1px solid ${isOk ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'};">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <span style="font-size:13px; font-weight:bold; color:var(--text-primary);">#${i + 1}</span>
                            ${badge}
                        </div>
                        <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:8px; white-space:pre-wrap;">${escapeHtml(d.text)}</div>
                        ${codeHtml}
                        ${imageHtml}
                        <div style="margin-top:8px;">${optsHtml}</div>
                        ${hintHtml}
                    </div>
                `;
    }).join('');
}

/* ==================== VIZUALIZARE INTREBARI CAPITOL (STUDENT) ==================== */
let currentStudentCategoryQuestions = [];
let currentStudentCategoryFilter = 'wrong';

export async function openStudentCategoryQuestions(category) {
    const modal = document.getElementById('modal-student-category-details');
    const titleEl = document.getElementById('student-cat-details-title');
    const metaEl = document.getElementById('student-cat-details-meta');
    const listEl = document.getElementById('student-cat-details-list');

    if (!modal || !titleEl || !metaEl || !listEl) return;

    const catIcons = {
        'Fundamente': '📘',
        'Organizarea Datelor': '📗',
        'Subprograme': '📙',
        'Backtracking': '📕',
        'Grafuri si Arbori': '📓'
    };
    const icon = catIcons[category] || '📂';

    modal.style.display = 'flex';
    titleEl.innerHTML = `<span>${icon}</span> ${escapeHtml(category)}`;
    metaEl.textContent = 'Se preiau întrebările din baza de date...';
    listEl.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
            <div class="spinner" style="margin: 0 auto 14px auto;"></div>
            <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Se încarcă întrebările parcurse...</p>
        </div>
    `;

    const countAllEl = document.getElementById('student-cat-count-all');
    const countWrongEl = document.getElementById('student-cat-count-wrong');
    const countCorrectEl = document.getElementById('student-cat-count-correct');
    if (countAllEl) countAllEl.textContent = '...';
    if (countWrongEl) countWrongEl.textContent = '...';
    if (countCorrectEl) countCorrectEl.textContent = '...';

    const username = state.studentUsername || localStorage.getItem('active_student_username') || '';
    if (!username) {
        listEl.innerHTML = `<p style="color: var(--accent-red); padding: 24px; text-align: center;">Nu ești autentificat.</p>`;
        return;
    }

    try {
        const res = await apiFetch(`/.netlify/functions/manage-practice?action=get_student_practice_details&student_username=${encodeURIComponent(username)}&category=${encodeURIComponent(category)}`);
        if (!res.ok) {
            throw new Error(`Eroare la preluarea întrebărilor (${res.status})`);
        }
        const data = await res.json();
        currentStudentCategoryQuestions = data.details || [];

        const totalQs = currentStudentCategoryQuestions.length;
        const correctQs = currentStudentCategoryQuestions.filter(d => d && d.isCorrect === true).length;
        const wrongQs = currentStudentCategoryQuestions.filter(d => d && !d.isCorrect && !d.isAssigned).length;

        if (countAllEl) countAllEl.textContent = totalQs;
        if (countWrongEl) countWrongEl.textContent = wrongQs;
        if (countCorrectEl) countCorrectEl.textContent = correctQs;

        metaEl.textContent = `Total: ${totalQs} întrebări întâlnite (${correctQs} corecte, ${wrongQs} greșite)`;

        // Preferinta utilizator: Implicit 'wrong' daca exista intrebari gresite; altfel 'all'
        const initialFilter = wrongQs > 0 ? 'wrong' : 'all';
        currentStudentCategoryFilter = initialFilter;

        const btnAll = document.getElementById('student-cat-filter-all');
        const btnWrong = document.getElementById('student-cat-filter-wrong');
        const btnCorrect = document.getElementById('student-cat-filter-correct');
        [btnAll, btnWrong, btnCorrect].forEach(b => b && b.classList.remove('active'));

        if (initialFilter === 'wrong' && btnWrong) {
            btnWrong.classList.add('active');
        } else if (btnAll) {
            btnAll.classList.add('active');
        }

        renderStudentCategoryQuestionsList(currentStudentCategoryQuestions, initialFilter);
    } catch (e) {
        console.error('Error opening student category questions:', e);
        listEl.innerHTML = `<p style="color: var(--accent-red); padding: 24px; text-align: center; font-size: 14px;">Eroare: ${escapeHtml(e.message)}</p>`;
    }
}
window.openStudentCategoryQuestions = openStudentCategoryQuestions;

export function setStudentCategoryFilter(filterType, btnEl) {
    currentStudentCategoryFilter = filterType;
    const btnAll = document.getElementById('student-cat-filter-all');
    const btnWrong = document.getElementById('student-cat-filter-wrong');
    const btnCorrect = document.getElementById('student-cat-filter-correct');
    [btnAll, btnWrong, btnCorrect].forEach(b => b && b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    renderStudentCategoryQuestionsList(currentStudentCategoryQuestions, filterType);
}
window.setStudentCategoryFilter = setStudentCategoryFilter;

export function closeStudentCategoryQuestions() {
    const modal = document.getElementById('modal-student-category-details');
    if (modal) modal.style.display = 'none';
}
window.closeStudentCategoryQuestions = closeStudentCategoryQuestions;

export function renderStudentCategoryQuestionsList(details, filter) {
    const container = document.getElementById('student-cat-details-list');
    if (!container) return;

    if (!details || details.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <div style="font-size: 36px; margin-bottom: 8px;">📂</div>
                <p style="font-size: 15px; margin: 0;">Nu ai întâlnit încă nicio întrebare din acest capitol.</p>
            </div>
        `;
        return;
    }

    const filtered = details.filter(d => {
        if (!d) return false;
        const isOk = !!(d.isCorrect === true || d.is_correct === true || d.correct === true || (d.studentAnswer !== null && d.studentAnswer !== undefined && d.studentAnswer === d.correctAnswer));
        if (filter === 'wrong') return !isOk && !d.isAssigned;
        if (filter === 'correct') return isOk;
        return true;
    });

    if (filtered.length === 0) {
        let msg = 'Nicio întrebare găsită pentru filtrul selectat.';
        let icon = '🔍';
        if (filter === 'wrong') {
            msg = 'Felicitări! Nu ai nicio întrebare greșită în acest capitol.';
            icon = '🎉';
        }
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <div style="font-size: 36px; margin-bottom: 8px;">${icon}</div>
                <p style="font-size: 15px; margin: 0;">${msg}</p>
            </div>
        `;
        return;
    }

    const diffMap = { easy: 'Ușoară', medium: 'Medie', hard: 'Grea' };

    const html = filtered.map((item, idx) => {
        if (!item) return '';
        const isOk = !!(item.isCorrect === true || item.is_correct === true || item.correct === true || (item.studentAnswer !== null && item.studentAnswer !== undefined && item.studentAnswer === item.correctAnswer));

        const statusBadge = isOk
            ? `<span class="detail-status-badge status-correct">✔️ Corect</span>`
            : `<span class="detail-status-badge status-wrong">❌ Greșit</span>`;

        const diffLabel = diffMap[item.difficulty] || item.difficulty || 'Normal';

        const optsHtml = (item.options || []).map((optText, optIdx) => {
            const isStudentChoice = item.studentAnswer === optIdx;
            const isCorrectChoice = item.correctAnswer === optIdx;

            let optClass = '';
            let tagHtml = '';

            if (isCorrectChoice) {
                optClass = 'opt-correct';
                tagHtml = `<span class="detail-opt-tag tag-correct">Răspuns Corect</span>`;
            } else if (isStudentChoice && !isOk) {
                optClass = 'opt-wrong';
                tagHtml = `<span class="detail-opt-tag tag-wrong">Ales de tine (Incorect)</span>`;
            }

            const optLetter = String.fromCharCode(65 + optIdx);
            return `
                <div class="detail-opt ${optClass}">
                    <span><strong>${optLetter}.</strong> ${escapeHtml(optText)}</span>
                    ${tagHtml}
                </div>
            `;
        }).join('');

        const formattedCode = item.code ? String(item.code).replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '    ') : '';
        const formattedText = item.text ? String(item.text).replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n') : '';

        const codeHtml = formattedCode
            ? `<div class="detail-code"><pre style="margin:0; font-family: inherit; white-space: pre-wrap; word-break: break-word;">${escapeHtml(formattedCode)}</pre></div>`
            : '';

        const itemImgs = parseImageUrls(item.image_url);
        const imageHtml = itemImgs.length > 0 ? `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; margin:12px auto; text-align:center; width:100%;">
                ${itemImgs.map(u => `<img src="${u}" style="max-height:220px; max-width:100%; border-radius:8px; border:1px solid rgba(255,255,255,0.1); margin:0 auto; display:block; box-shadow:0 4px 12px rgba(0,0,0,0.3); cursor:zoom-in;" onclick="openLightbox('${u}')" title="Click pentru mărire">`).join('')}
            </div>` : '';

        const hintHtml = (item.hint && item.hint.trim()) ? `
            <div style="margin-top: 10px; font-size: 13px; color: var(--text-secondary); background: rgba(251, 191, 36, 0.06); padding: 8px 12px; border-radius: 6px; border-left: 3px solid #fbbf24; line-height: 1.4;">
                💡 <em>${escapeHtml(item.hint)}</em>
            </div>` : '';

        const subcatBadge = item.subcategory ? `<span class="detail-subcat-badge">${escapeHtml(item.subcategory)}</span>` : '';

        return `
            <div class="detail-card ${isOk ? 'correct' : 'wrong'}">
                <div class="detail-header">
                    <div class="detail-header-left">
                        <span class="detail-num">#${idx + 1}</span>
                        <span class="detail-diff-badge">Dificultate: ${diffLabel}</span>
                        ${subcatBadge}
                    </div>
                    <div class="detail-header-right">${statusBadge}</div>
                </div>
                <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; white-space: pre-wrap; word-break: break-word; line-height: 1.5;">${escapeHtml(formattedText)}</div>
                ${codeHtml}
                ${imageHtml}
                <div style="margin-top: 12px;">${optsHtml}</div>
                ${hintHtml}
            </div>
        `;
    }).join('');

    container.innerHTML = html;

    try {
        if (typeof renderMath === 'function') {
            renderMath(container);
        }
    } catch (err) {
        console.warn('renderMath error in student category questions:', err);
    }
}
window.renderStudentCategoryQuestionsList = renderStudentCategoryQuestionsList;

// Event listeners for closing on click outside or Escape key
document.addEventListener('DOMContentLoaded', () => {
    const studentCatModal = document.getElementById('modal-student-category-details');
    if (studentCatModal) {
        studentCatModal.addEventListener('click', (e) => {
            if (e.target === studentCatModal) {
                closeStudentCategoryQuestions();
            }
        });
    }
});
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeStudentCategoryQuestions();
    }
});

