/* ========================================================================
           CONFIGURATION
           ======================================================================== */
const CONFIG = {
    tutorPhone: '',
    tutorEmail: '',
    timerInitial: 30 * 60 * 1000,      // 30 minutes for Initial Test
    timerIntermediar: 60 * 60 * 1000,   // 60 minutes for intermediate tests
};

/* ========================================================================
   QUESTIONS DATA — Loaded Dynamically from Supabase
   ======================================================================== */
// Full list of questions fetched for current session
let questions = [];     // Active quiz questions

/* ========================================================================
   STATE MANAGEMENT
   ======================================================================== */
const state = {
    currentQuestion: 0,
    testType: 'initial', // always initial or decide logic later if we keep intermediate test
    examType: 'Initial',
    studentUsername: '',
    studentId: null,
    assignedTestId: null,
    startTime: null,
    endTime: null,
    blurCount: 0,
    questionTimings: [],     // ms spent on each question
    questionEnteredAt: null, // timestamp when current question was shown
    needName: false,        // true when user is new and needs to enter name
};

/* ========================================================================
   DOM REFERENCES
   ======================================================================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
    screens: document.querySelectorAll('.screen'),
    studentUsername: $('#student-username'),
    studentPassword: $('#student-password'),
    btnContinue: $('#btn-continue'),
    modalPhone: $('#modal-phone'),
    phoneInput: $('#phone-input'),
    btnSubmitPhone: $('#btn-submit-phone'),
    progressBar: $('#progress-bar'),
    progressText: $('#progress-text'),
    questionNumber: $('#question-number'),
    badgeDifficulty: $('#badge-difficulty'),
    badgeType: $('#badge-type'),
    questionText: $('#question-text'),
    questionImagesContainer: $('#question-images-container'),
    codeWrapper: $('#code-wrapper'),
    codeContent: $('#code-content'),
    optionsContainer: $('#options-container'),
    btnPrev: $('#btn-prev'),
    btnNext: $('#btn-next'),
    btnNextText: $('#btn-next-text'),
    resultsContainer: $('#results-container'),
    toast: $('#toast'),
    questionHeader: $('#question-header'),
    questionContent: $('#question-content'),
    blurCountDisplay: $('#blur-count-display'),
    anticheatBadge: $('#anticheat-badge'),
    screenQuiz: $('#screen-quiz'),
};

/* ========================================================================
   API FETCH WRAPPER & ROUTES
   ======================================================================== */
const API_ROUTES = {
    checkUser: '/.netlify/functions/check-user',
    fetchQuestions: '/.netlify/functions/fetch-questions',
    fetchProgress: '/.netlify/functions/fetch-progress',
    saveProgress: '/.netlify/functions/save-progress',
    saveResult: '/.netlify/functions/save-result',
    updatePhone: '/.netlify/functions/update-phone',
    managePractice: '/.netlify/functions/manage-practice'
};

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('active_student_token') || '';
    if (!options.headers) options.headers = {};
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (!options.headers['Content-Type'] && options.method && options.method !== 'GET') {
        options.headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(url, options);
        if (response.status === 401) {
            // Sesiune expirata / token invalid
            throw new Error('Sesiunea a expirat. Vă rugăm să vă reautentificați.');
        }
        return response;
    } catch (err) {
        console.error(`apiFetch error for ${url}:`, err);
        throw err;
    }
}
window.apiFetch = apiFetch;
window.API_ROUTES = API_ROUTES;

/* ========================================================================
   UTILITY FUNCTIONS
   ======================================================================== */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatEuropeanDateTime(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} la ora ${hours}:${mins}`;
}
window.formatEuropeanDateTime = formatEuropeanDateTime;

function parseImageUrls(imageVal) {
    if (!imageVal) return [];
    if (Array.isArray(imageVal)) return imageVal.filter(Boolean);
    if (typeof imageVal === 'string') {
        const trimmed = imageVal.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.filter(Boolean);
            } catch (e) {}
        }
        if (trimmed.includes('\n')) {
            return trimmed.split('\n').map(s => s.trim()).filter(Boolean);
        }
        if (trimmed.includes(',') && !trimmed.startsWith('data:')) {
            return trimmed.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [trimmed];
    }
    return [];
}

function cleanSymbols(str) {
    if (!str) return '';
    return str
        .replace(/≥/g, '>=')
        .replace(/≤/g, '<=')
        .replace(/≠/g, '!=')
        .replace(/←/g, '=')
        .replace(/→/g, '=')
        .replace(/\\n/g, '\n');
}

function showToast(message, isError = false, duration = 2500) {
    if (typeof isError === 'number') {
        duration = isError;
        isError = false;
    }
    els.toast.textContent = message;
    if (isError) {
        els.toast.classList.add('error');
    } else {
        els.toast.classList.remove('error');
    }
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), duration);
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/* ========================================================================
   SCREEN MANAGEMENT
   ======================================================================== */
function showScreen(screenId) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $(`#screen-${screenId}`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ========================================================================
   QUIZ RENDERING
   ======================================================================== */
function renderQuestion() {
    // Record time spent on previous question
    if (state.questionEnteredAt !== null) {
        const timeSpent = Date.now() - state.questionEnteredAt;
        // Add to existing or set
        if (state.questionTimings[state.currentQuestion] === undefined) {
            state.questionTimings[state.currentQuestion] = timeSpent;
        } else {
            state.questionTimings[state.currentQuestion] += timeSpent;
        }
    }
    state.questionEnteredAt = Date.now();

    const idx = state.currentQuestion;
    const q = questions[idx];
    if (!q) return;

    // Generate displayOrder for shuffling options
    if (!q.displayOrder) {
        const numOpts = (q.options && q.options.length) || 4;
        q.displayOrder = Array.from({ length: numOpts }, (_, i) => i);
        for (let i = q.displayOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [q.displayOrder[i], q.displayOrder[j]] = [q.displayOrder[j], q.displayOrder[i]];
        }
    }

    const num = idx + 1;

    // Progress
    const progress = ((idx + 1) / questions.length) * 100;
    els.progressBar.style.width = progress + '%';
    els.progressText.textContent = `Întrebarea ${num} din ${questions.length}`;

    // Question number
    els.questionNumber.textContent = num.toString().padStart(2, '0');

    // Difficulty badge
    const diffMap = {
        easy: { text: 'Ușoară', class: 'badge-easy' },
        medium: { text: 'Medie', class: 'badge-medium' },
        hard: { text: 'Grea', class: 'badge-hard' }
    };
    const diff = diffMap[q.difficulty];
    els.badgeDifficulty.textContent = diff.text;
    els.badgeDifficulty.className = 'badge ' + diff.class;

    // Type badge
    els.badgeType.textContent = q.type === 'code' ? 'Completare Cod' : 'Grilă';

    // Question text
    els.questionText.textContent = cleanSymbols(q.text);

    // Images (centered with click to zoom)
    const qImages = parseImageUrls(q.image_url);
    const imgContainer = els.questionImagesContainer || $('#question-images-container');
    if (imgContainer) {
        if (qImages.length > 0) {
            imgContainer.style.display = 'flex';
            imgContainer.innerHTML = qImages.map((url, i) => `
                <img src="${url}" class="question-img-item" alt="Imagine întrebare ${i + 1}" onclick="openLightbox('${url}')">
            `).join('');
        } else {
            imgContainer.style.display = 'none';
            imgContainer.innerHTML = '';
        }
    }

    // Code block with Prism C++ Syntax Highlighting
    if (q.code) {
        els.codeWrapper.style.display = 'block';
        const cleanCode = cleanSymbols(q.code);
        const codeHtml = escapeHtml(cleanCode).replace(
            /_{4,}/g,
            '<span class="code-blank">????????</span>'
        );
        els.codeContent.innerHTML = `<pre class="language-cpp" style="background:transparent; margin:0; padding:0;"><code class="language-cpp">${codeHtml}</code></pre>`;
        if (window.Prism) {
            setTimeout(() => {
                const codeEl = els.codeContent.querySelector('code');
                if (codeEl) Prism.highlightElement(codeEl);
            }, 0);
        }
    } else {
        els.codeWrapper.style.display = 'none';
    }

    // Options (supports 4 to 6 options: A, B, C, D, E, F)
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    let optionsHtml = '';
    q.displayOrder.forEach((originalIndex, displayIndex) => {
        const opt = q.options[originalIndex];
        if (opt === undefined) return;
        const selectedClass = state.answers[idx] === originalIndex ? 'selected' : '';
        const isCodeOption = q.type === 'code' ? ' code-option' : '';
        const letter = letters[displayIndex] || String.fromCharCode(65 + displayIndex);
        optionsHtml += `
                <div class="option-card ${selectedClass}" data-index="${originalIndex}" role="button" tabindex="0" aria-label="Opțiunea ${letter}">
                    <div class="option-letter">${letter}</div>
                    <div class="option-text${isCodeOption}">${escapeHtml(opt)}</div>
                </div>`;
    });
    els.optionsContainer.innerHTML = optionsHtml;

    // Hint handling in progress: Allowed ONLY for 'tema' (assigned test) OR 'intermediar' test. NEVER for 'initial'.
    const isInitialTest = (state.testType === 'initial' || state.examType === 'Initial');
    const isAllowedInProgress = !isInitialTest && (state.testType === 'intermediar' || state.testType === 'tema' || !!state.assignedTestId);

    const btnHint = $('#btn-hint');
    const hintBox = $('#hint-box');
    const hintContent = $('#hint-content');

    if (hintBox) hintBox.style.display = 'none'; // reset collapsed on question change

    if (isAllowedInProgress && q.hint && q.hint.trim() !== '') {
        if (btnHint) btnHint.style.display = 'inline-flex';
        if (hintContent) hintContent.textContent = q.hint.trim();
    } else {
        if (btnHint) btnHint.style.display = 'none';
    }

    // Navigation buttons
    els.btnPrev.style.visibility = idx === 0 ? 'hidden' : 'visible';

    const btnAssignedNav = $('#btn-assigned-save-exit');
    if (btnAssignedNav) {
        btnAssignedNav.style.display = state.assignedTestId ? 'inline-flex' : 'none';
    }

    if (idx === questions.length - 1) {
        els.btnNextText.textContent = state.assignedTestId ? 'Finalizează Tema' : 'Finalizează Testul';
        $('#btn-next-icon').style.display = 'none';
    } else {
        els.btnNextText.textContent = 'Următoarea';
        $('#btn-next-icon').style.display = '';
    }

    // Enable/disable next based on answer
    els.btnNext.disabled = state.answers[idx] === null;

    // Animate
    els.questionHeader.classList.remove('question-animate');
    els.questionContent.classList.remove('question-animate');
    els.optionsContainer.classList.remove('question-animate');
    void els.questionHeader.offsetWidth; // force reflow
    els.questionHeader.classList.add('question-animate');
    els.questionContent.classList.add('question-animate');
    els.optionsContainer.classList.add('question-animate');
}

window.toggleHint = function () {
    const hintBox = $('#hint-box');
    if (!hintBox) return;
    hintBox.style.display = (hintBox.style.display === 'none' || hintBox.style.display === '') ? 'block' : 'none';
};

window.toggleReviewHint = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
};

window.toggleReviewItem = function (el) {
    if (!el) return;
    el.classList.toggle('expanded');
};

window.toggleAllReviewItems = function () {
    const items = document.querySelectorAll('.review-item');
    const btn = document.getElementById('btn-toggle-all-text');
    const isAnyCollapsed = Array.from(items).some(it => !it.classList.contains('expanded'));

    items.forEach(it => {
        if (isAnyCollapsed) it.classList.add('expanded');
        else it.classList.remove('expanded');
    });

    if (btn) {
        btn.textContent = isAnyCollapsed ? 'Restrânge tot' : 'Extinde tot';
    }
};

/* ========================================================================
   LOCAL STORAGE & TIMER & API UTILITIES
   ======================================================================== */
function saveStateToStorage() {
    try {
        localStorage.setItem('quiz_current_question', state.currentQuestion);
        localStorage.setItem('quiz_answers', JSON.stringify(state.answers));
        localStorage.setItem('quiz_start_time', state.startTime);
        localStorage.setItem('quiz_student_username', state.studentUsername);
        localStorage.setItem('quiz_student_id', state.studentId || '');
        localStorage.setItem('quiz_test_type', state.testType);
        localStorage.setItem('quiz_exam_type', state.examType || 'Initial');
        localStorage.setItem('quiz_blur_count', state.blurCount);
        localStorage.setItem('quiz_question_timings', JSON.stringify(state.questionTimings));
        localStorage.setItem('quiz_assigned_test_id', state.assignedTestId || '');
        if (Array.isArray(questions)) {
            const displayOrders = questions.map(q => q.displayOrder || null);
            localStorage.setItem('quiz_display_orders', JSON.stringify(displayOrders));
        }
    } catch (e) {
        console.error('Failed to save state to localStorage', e);
    }
}

function clearStateFromStorage() {
    try {
        ['quiz_current_question', 'quiz_answers', 'quiz_start_time', 'quiz_student_username',
            'quiz_student_id', 'quiz_test_type', 'quiz_exam_type', 'quiz_blur_count', 'quiz_question_timings',
            'quiz_questions_ids', 'quiz_assigned_test_id', 'quiz_display_orders'].forEach(k => localStorage.removeItem(k));
    } catch (e) {
        console.error('Failed to clear state from localStorage', e);
    }
}

let timerDurationMs = 30 * 60 * 1000;
let timerInterval = null;

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);

    const countdownEl = $('#timer-countdown');
    const timerBadge = $('#quiz-timer');
    if (!countdownEl || !timerBadge) return;

    function updateTimer() {
        const elapsed = Date.now() - state.startTime;
        const remaining = timerDurationMs - elapsed;

        const isInitial = state.testType === 'initial' || state.examType === 'Initial';

        if (remaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            countdownEl.textContent = '00:00';
            timerBadge.classList.add('warning');
            autoSubmitQuiz();
            return;
        }

        const totalSeconds = Math.floor(remaining / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        countdownEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (remaining < 3 * 60 * 1000) {
            timerBadge.classList.add('warning');
        } else {
            timerBadge.classList.remove('warning');
        }
    }

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}


function autoSubmitQuiz() {
    showToast('Timpul a expirat! Testul a fost trimis automat.');
    finishQuiz(true);
}

async function startPublicInitialTest() {
    clearStateFromStorage();
    localStorage.removeItem('active_student_username');
    localStorage.removeItem('active_student_id');
    localStorage.removeItem('active_student_token');
    localStorage.removeItem('quiz_assigned_test_id');

    state.isPublicInitial = true;
    state.studentUsername = 'Vizitator';
    state.studentId = null;
    state.assignedTestId = null;
    state.testType = 'initial';
    state.examType = 'Initial';

    const btn = document.getElementById('btn-public-initial');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Se încarcă testul inițial...</span>';
    }

    try {
        const res = await apiFetch('/.netlify/functions/fetch-questions?type=initial');
        if (!res.ok) throw new Error('Eroare la preluarea întrebărilor.');
        const rawQs = await res.json();
        if (!Array.isArray(rawQs) || rawQs.length === 0) {
            throw new Error('Nu există întrebări disponibile pentru test.');
        }

        questions = rawQs;
        timerDurationMs = 30 * 60 * 1000;
        localStorage.setItem('quiz_questions_ids', JSON.stringify(questions.map(q => q.id)));

        startQuiz(false);

    } catch (e) {
        console.error('startPublicInitialTest error:', e);
        showToast('Eroare la pornirea testului: ' + e.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>🚀 Test Inițial Gratuit (30 min)</span>';
        }
    }
}
window.startPublicInitialTest = startPublicInitialTest;

function renderPublicLeadLock() {
    els.resultsContainer.innerHTML = `
        <div id="public-lead-container" style="max-width: 540px; width: 100%; margin: 20px auto; background: var(--bg-card); border: 1px solid rgba(124, 106, 255, 0.4); border-radius: var(--radius-lg); padding: 32px 24px; text-align: center; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(124, 106, 255, 0.2);">
            <div style="font-size: 44px; margin-bottom: 12px;">🎉</div>
            <h2 style="font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 8px;">Felicitări pentru finalizarea testului!</h2>
            <div style="background: linear-gradient(135deg, rgba(124, 106, 255, 0.15), rgba(56, 189, 248, 0.12)); border: 1px solid rgba(124, 106, 255, 0.3); border-radius: var(--radius-md); padding: 14px 16px; margin-bottom: 20px; text-align: left;">
                <div style="font-weight: 700; color: #38bdf8; font-size: 13px; margin-bottom: 4px;">🎁 Cadoul tău de bun venit:</div>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
                    Ai deblocat o <strong>sesiune gratuită de evaluare și analiză 1-la-1 de 30 de minute</strong> cu profesorul.
                </div>
            </div>
            <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 20px;">
                Completează datele tale pentru a debloca raportul complet pe ecran și a primi analiza pe WhatsApp:
            </p>
            <form id="public-lead-form" onsubmit="handlePublicLeadSubmit(event)">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; text-align: left;">
                    <div>
                        <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Prenume *</label>
                        <input type="text" id="lead-first-name" class="form-control" placeholder="ex: Andrei" required style="width: 100%; padding: 11px 12px; background: rgba(10, 10, 30, 0.8); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: #fff; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Nume de familie *</label>
                        <input type="text" id="lead-last-name" class="form-control" placeholder="ex: Popescu" required style="width: 100%; padding: 11px 12px; background: rgba(10, 10, 30, 0.8); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: #fff; box-sizing: border-box;">
                    </div>
                </div>
                <div style="margin-bottom: 20px; text-align: left;">
                    <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Număr de Telefon (WhatsApp) *</label>
                    <input type="tel" id="lead-phone" class="form-control" placeholder="07XXXXXXXX" required style="width: 100%; padding: 11px 12px; background: rgba(10, 10, 30, 0.8); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: #fff; box-sizing: border-box;">
                </div>
                <button type="submit" id="btn-submit-lead" class="btn btn-primary btn-full" style="padding: 14px; font-size: 15px; font-weight: 800; background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 4px 20px rgba(16, 185, 129, 0.35);">
                    <span>🔓 Deblochează Rezultatul & Raportul Detaliat</span>
                </button>
            </form>
        </div>
    `;
}

async function handlePublicLeadSubmit(event) {
    event.preventDefault();
    const firstName = document.getElementById('lead-first-name').value.trim();
    const lastName = document.getElementById('lead-last-name').value.trim();
    const phone = document.getElementById('lead-phone').value.trim();
    const btn = document.getElementById('btn-submit-lead');

    if (!firstName || !lastName || !phone) {
        showToast('Te rugăm să completezi toate câmpurile obligatorii.', true);
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>Se deblochează raportul...</span>';

    try {
        const res = await fetch('/.netlify/functions/submit-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                first_name: firstName,
                last_name: lastName,
                phone: phone,
                time_taken_ms: state.pendingPublicTime || (state.endTime - state.startTime) || 0,
                blur_count: state.blurCount || 0,
                answers_json: state.answers,
                question_ids: questions.map(q => q.id)
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Eroare la salvarea rezultatelor.');

        showToast('🎉 Rezultatul a fost deblocat cu succes!');
        state.isPublicInitial = false;
        state.studentUsername = `${firstName} ${lastName}`;

        const results = {
            totalCorrect: (data.evaluatedDetails || []).filter(d => d.isCorrect).length,
            totalPoints: data.score,
            maxPoints: data.totalPoints,
            easyCorrect: (data.stats && data.stats.easy) ? data.stats.easy.c : 0,
            easyTotal: (data.stats && data.stats.easy) ? data.stats.easy.t : 0,
            mediumCorrect: (data.stats && data.stats.medium) ? data.stats.medium.c : 0,
            mediumTotal: (data.stats && data.stats.medium) ? data.stats.medium.t : 0,
            hardCorrect: (data.stats && data.stats.hard) ? data.stats.hard.c : 0,
            hardTotal: (data.stats && data.stats.hard) ? data.stats.hard.t : 0,
            details: data.evaluatedDetails || []
        };

        const pct = results.totalCorrect / questions.length;
        if (pct <= 0.33) {
            results.level = { key: 'beginner', name: '🐣 Începător C++', icon: '🌱', class: 'level-beginner', description: 'Ai completat testul! Hai să construim împreună o fundație solidă în programare C++.' };
        } else if (pct <= 0.58) {
            results.level = { key: 'intermediate', name: '⚔️ Coder Intermediar', icon: '📘', class: 'level-intermediate', description: 'Bun lucru! Ai o bază pe care putem construi. Ne vom concentra pe exerciții practice și aprofundarea conceptelor.' };
        } else if (pct <= 0.83) {
            results.level = { key: 'advanced', name: '🚀 Algo Specialist', icon: '🚀', class: 'level-advanced', description: 'Impresionant! Cunoștințele tale sunt puternice. Vom lucra pe probleme complexe și tehnici avansate.' };
        } else {
            results.level = { key: 'expert', name: '👑 Master Mind (Nivel Top)', icon: '🏆', class: 'level-expert', description: 'Excelent! Ești foarte bine pregătit! Vom trece la antrenament intensiv de tip concurs.' };
        }

        if (pct >= 0.80 && window.confetti) {
            window.confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        }

        window.lastResults = results;
        renderResults(results);

        // Prepend marketing booking banner to the top of results
        const header = els.resultsContainer.querySelector('.results-header');
        if (header) {
            const banner = document.createElement('div');
            banner.innerHTML = `
                <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(56, 189, 248, 0.15)); border: 1px solid #10b981; border-radius: var(--radius-md); padding: 16px 20px; margin-bottom: 24px; text-align: center;">
                    <div style="font-size: 16px; font-weight: 700; color: #34d399; margin-bottom: 4px;">🎁 Sesiune de Evaluare 1-la-1 Deblocată!</div>
                    <div style="font-size: 13px; color: #e2e8f0; line-height: 1.5;">
                        Mulțumim, <strong>${escapeHtml(data.student_name)}</strong>! Raportul tău a fost înregistrat. Te vom contacta pe WhatsApp la <strong>${escapeHtml(data.phone)}</strong> pentru programarea sesiunii gratuite de consultanță (30 min).
                    </div>
                </div>
            `;
            header.insertAdjacentElement('beforebegin', banner);
        }

    } catch (e) {
        console.error('handlePublicLeadSubmit error:', e);
        showToast(e.message, true);
        btn.disabled = false;
        btn.innerHTML = '<span>🔓 Deblochează Rezultatul & Raportul Detaliat</span>';
    }
}
window.handlePublicLeadSubmit = handlePublicLeadSubmit;

async function submitResult(timeTakenMs) {
    const studentToken = localStorage.getItem('active_student_token');
    const isGuest = state.isPublicInitial || !studentToken || !state.studentUsername;

    if (isGuest) {
        state.isPublicInitial = true;
        state.pendingPublicTime = timeTakenMs;
        renderPublicLeadLock();
        return;
    }

    const questionIds = questions.map(q => q.id);
    // Ensure every single question is accounted for, using null for unanswered
    const safeAnswers = questions.map((_, i) => (state.answers && state.answers[i] !== undefined && state.answers[i] !== null) ? state.answers[i] : null);

    const payload = {
        student_username: state.studentUsername,
        student_id: state.studentId,
        test_type: state.assignedTestId ? 'tema' : state.testType,
        exam_type: state.examType,
        time_taken_ms: state.assignedTestId ? (timeTakenMs || 0) : timeTakenMs,
        blur_count: state.assignedTestId ? 0 : state.blurCount,
        answers_json: safeAnswers,
        question_ids: questionIds,
        assigned_test_id: state.assignedTestId
    };

    try {
        localStorage.setItem('pending_quiz_result', JSON.stringify(payload));
        const response = await fetch('/.netlify/functions/save-result', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (localStorage.getItem('active_student_token') || '')
            },
            body: JSON.stringify(payload)
        });

        if (response.status === 403) {
            let errorMsg = 'Acces interzis.';
            try {
                const errData = await response.json();
                if (errData.error) errorMsg = errData.error;
            } catch (e) { }
            
            if (errorMsg.includes('expirat')) {
                showToast('Abonamentul tău a expirat. Rezultatul nu a putut fi salvat.', true);
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                return;
            }
            throw new Error(errorMsg);
        }

        if (!response.ok) {
            let errorMsg = 'Eroare la salvarea rezultatelor pe server.';
            try {
                const errData = await response.json();
                if (errData.error) errorMsg = errData.error;
            } catch (e) { }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        localStorage.removeItem('pending_quiz_result');
        clearStateFromStorage();

        const earnedXpVal = data.gamification ? data.gamification.xpEarned : ((data.evaluatedDetails || []).filter(d => d.isCorrect).length * 10);

        const results = {
            totalCorrect: (data.evaluatedDetails || []).filter(d => d.isCorrect).length,
            totalPoints: data.score,
            maxPoints: data.totalPoints,
            easyCorrect: (data.stats && data.stats.easy) ? data.stats.easy.c : 0,
            easyTotal: (data.stats && data.stats.easy) ? data.stats.easy.t : 0,
            mediumCorrect: (data.stats && data.stats.medium) ? data.stats.medium.c : 0,
            mediumTotal: (data.stats && data.stats.medium) ? data.stats.medium.t : 0,
            hardCorrect: (data.stats && data.stats.hard) ? data.stats.hard.c : 0,
            hardTotal: (data.stats && data.stats.hard) ? data.stats.hard.t : 0,
            details: data.evaluatedDetails || [],
            xpEarned: earnedXpVal
        };

        if (data.gamification) {
            if (data.gamification.newTotalXp !== undefined) {
                const elXp = document.getElementById('dash-xp');
                if (elXp) elXp.textContent = `${data.gamification.newTotalXp} XP`;
            }
            if (data.gamification.newStreak !== undefined) {
                const elStreak = document.getElementById('dash-streak');
                if (elStreak) elStreak.textContent = data.gamification.newStreak;
            }
        }

        const pct = results.totalCorrect / questions.length;
        if (pct <= 0.33) {
            results.level = { key: 'beginner', name: '🐣 Începător C++', icon: '🌱', class: 'level-beginner', description: 'Ai completat testul! Hai să construim împreună o fundație solidă în programare C++.' };
        } else if (pct <= 0.58) {
            results.level = { key: 'intermediate', name: '⚔️ Coder Intermediar', icon: '📘', class: 'level-intermediate', description: 'Bun lucru! Ai o bază pe care putem construi. Ne vom concentra pe exerciții practice și aprofundarea conceptelor.' };
        } else if (pct <= 0.83) {
            results.level = { key: 'advanced', name: '🚀 Algo Specialist', icon: '🚀', class: 'level-advanced', description: 'Impresionant! Cunoștințele tale sunt puternice. Vom lucra pe probleme complexe și tehnici avansate.' };
        } else {
            results.level = { key: 'expert', name: '👑 Master Mind (Nivel Top)', icon: '🏆', class: 'level-expert', description: 'Excelent! Ești foarte bine pregătit! Vom trece la antrenament intensiv de tip concurs.' };
        }

        // Confetti for score >= 80%
        if (pct >= 0.80 && window.confetti) {
            window.confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        }

        if (state.assignedTestId) {
            const totalCorrect = results.totalCorrect;
            const totalQuestions = questions.length;
            els.resultsContainer.innerHTML = `
                        <div class="empty-state">
                            <div style="font-size: 48px; margin-bottom: 12px;">${totalCorrect > 0 ? '🎉' : '📝'}</div>
                            <h2 style="color:var(--accent-green); margin-bottom: 10px;">Ai finalizat tema!</h2>
                            <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">
                                Răspunsuri corecte: <strong style="color: #fff;">${totalCorrect} din ${totalQuestions}</strong>
                            </p>
                            <div style="margin-bottom: 20px;">
                                <span style="display: inline-flex; align-items: center; gap: 6px; background: ${earnedXpVal > 0 ? 'rgba(251, 191, 36, 0.12)' : 'rgba(255, 255, 255, 0.05)'}; border: 1px solid ${earnedXpVal > 0 ? 'rgba(251, 191, 36, 0.35)' : 'rgba(255, 255, 255, 0.1)'}; color: ${earnedXpVal > 0 ? '#fbbf24' : 'var(--text-muted)'}; font-weight: 800; font-size: 16px; padding: 6px 16px; border-radius: 20px;">
                                    ⚡ +${earnedXpVal} XP ${earnedXpVal > 0 ? 'Câștigați!' : '(0 răspunsuri corecte)'}
                                </span>
                            </div>
                            <p style="color:var(--text-secondary); margin-bottom: 30px;">Rezultatele au fost trimise către profesor.</p>
                            <button class="btn btn-primary" onclick="window.location.reload()">Înapoi la Panou</button>
                        </div>
                    `;
        } else {
            window.lastResults = results;
            renderResults(results);
        }

    } catch (err) {
        console.error('Network error saving results', err);
        showToast(err.message || 'Eroare la trimiterea rezultatelor.', true);
        
        const isAuthError = err.message && (err.message.includes('Token') || err.message.includes('Autentificare') || err.message.includes('Expirat'));
        
        els.resultsContainer.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <h3 style="color: var(--accent-red); margin-bottom: 8px;">Conexiunea cu serverul a fost întreruptă</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px; max-width: 480px; margin-left: auto; margin-right: auto;">
                    ${isAuthError 
                        ? 'Sesiunea ta a expirat. Te rog să deschizi un alt tab, să te conectezi din nou, iar apoi revino aici și apasă pe butonul de mai jos.'
                        : 'Răspunsurile tale sunt salvate în siguranță pe acest dispozitiv. Verifică conexiunea la internet și apasă butonul de mai jos pentru a retrimite.'}
                </p>
                <button class="btn btn-primary" onclick="retryPendingSubmission(${timeTakenMs})" style="padding: 12px 28px; font-size: 16px;">
                    🔄 Reîncearcă Trimiterea Rezultatelor
                </button>
            </div>
        `;
    }
}

function retryPendingSubmission(timeTakenMs) {
    els.resultsContainer.innerHTML = '<div style="text-align:center; padding:40px;"><p>Se retrimite...</p></div>';
    submitResult(timeTakenMs);
}
window.retryPendingSubmission = retryPendingSubmission;

/* ========================================================================
   ANSWER HANDLING
   ======================================================================== */
function selectAnswer(index) {
    state.answers[state.currentQuestion] = index;
    saveStateToStorage();
    if (state.assignedTestId) {
        saveAssignedProgress();
    }
    renderQuestion();
}

function saveAssignedProgress() {
    if (!state.assignedTestId) return;
    const token = localStorage.getItem('active_student_token') || '';
    fetch('/.netlify/functions/save-progress', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
            assigned_test_id: state.assignedTestId,
            student_username: state.studentUsername,
            answers_json: state.answers,
            time_taken_ms: state.startTime ? (Date.now() - state.startTime) : 0,
            current_index: state.currentQuestion
        })
    }).catch(e => console.error(e));
}

/* ========================================================================
   NAVIGATION
   ======================================================================== */
function goNext() {
    if (state.answers[state.currentQuestion] === null) return;

    if (state.currentQuestion === questions.length - 1) {
        finishQuiz();
    } else {
        state.currentQuestion++;
        saveStateToStorage();
        if (state.assignedTestId) saveAssignedProgress();
        renderQuestion();
    }
}

function goPrev() {
    if (state.currentQuestion > 0) {
        state.currentQuestion--;
        saveStateToStorage();
        if (state.assignedTestId) saveAssignedProgress();
        renderQuestion();
    }
}

/* ========================================================================
   RESULTS CALCULATION (Moved to server)
   ======================================================================== */

/* ========================================================================
   DIAGNOSTIC CATEGORY REPORT RENDERING
   ======================================================================== */
function renderCategoryDiagnosticSection(details) {
    if (!Array.isArray(details) || details.length === 0) return '';

    const categoryMap = {};
    details.forEach(d => {
        const cat = d.category || 'Diverse';
        if (!categoryMap[cat]) {
            categoryMap[cat] = {
                name: cat,
                total: 0,
                correct: 0,
                wrong: 0,
                subcategories: {}
            };
        }
        categoryMap[cat].total++;
        if (d.isCorrect) {
            categoryMap[cat].correct++;
        } else {
            categoryMap[cat].wrong++;
        }

        const sub = d.subcategory;
        if (sub) {
            if (!categoryMap[cat].subcategories[sub]) {
                categoryMap[cat].subcategories[sub] = { total: 0, correct: 0, wrong: 0 };
            }
            categoryMap[cat].subcategories[sub].total++;
            if (d.isCorrect) {
                categoryMap[cat].subcategories[sub].correct++;
            } else {
                categoryMap[cat].subcategories[sub].wrong++;
            }
        }
    });

    const categories = Object.values(categoryMap);
    // Sort ascending by percentage so categories with most mistakes/lowest score appear at the very top
    categories.sort((a, b) => {
        const pctA = a.correct / a.total;
        const pctB = b.correct / b.total;
        return pctA - pctB;
    });

    const criticalCategories = categories.filter(c => Math.round((c.correct / c.total) * 100) < 50);
    const hasCritical = criticalCategories.length > 0;

    let cardsHtml = categories.map(cat => {
        const pct = Math.round((cat.correct / cat.total) * 100);
        let statusBadge = '';
        let cardClass = '';
        let fillClass = '';
        let textColor = '';
        let feedbackNote = '';

        if (pct < 50) {
            cardClass = 'critical';
            fillClass = 'critical';
            textColor = '#f87171';
            statusBadge = `<span class="diagnostic-badge-critical">⚠️ ${pct === 0 ? '0%! Lipsuri Majore' : 'Nivel Critic • Lipsuri'}</span>`;
            feedbackNote = pct === 0 
                ? '🚨 <strong>Scor 0%!</strong> Nu ai rezolvat nicio cerință din această categorie. Este necesară reluarea noțiunilor fundamentale de la zero.'
                : '⚠️ <strong>Lipsuri accentuate.</strong> Risc ridicat de pierdere a punctajelor la examen dacă nu se consolidează conceptele de bază.';
        } else if (pct < 75) {
            cardClass = 'medium';
            fillClass = 'medium';
            textColor = '#fbbf24';
            statusBadge = `<span class="diagnostic-badge-medium">⚠️ Nivel Mediu • Necesită Aprofundare</span>`;
            feedbackNote = 'Există înțelegere parțială, însă au apărut ezitări pe cazurile particulare sau pe detaliile de rezolvare.';
        } else {
            cardClass = 'good';
            fillClass = 'good';
            textColor = '#34d399';
            statusBadge = `<span class="diagnostic-badge-good">✔️ Bine Consolidat</span>`;
            feedbackNote = 'Conceptele din această categorie sunt stăpânite la un nivel optim.';
        }

        // Subcategories with errors
        const weakSubcats = Object.entries(cat.subcategories)
            .filter(([_, data]) => data.wrong > 0)
            .map(([name, data]) => `<span style="display: inline-block; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 4px; font-size: 11px; margin: 2px 3px; color: ${data.correct === 0 ? '#f87171' : '#fbbf24'};">${escapeHtml(name)}: <strong>${data.correct}/${data.total}</strong></span>`)
            .join(' ');

        return `
            <div class="diagnostic-cat-card ${cardClass}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <span style="font-size: 16px; font-weight: 800; color: #fff;">${escapeHtml(cat.name)}</span>
                    </div>
                    <div>
                        ${statusBadge}
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                    <span style="font-size: 13px; color: var(--text-secondary);">Răspunsuri corecte: <strong>${cat.correct} din ${cat.total}</strong> (${cat.wrong} ${cat.wrong === 1 ? 'greșeală' : 'greșeli'})</span>
                    <span style="font-size: 18px; font-weight: 900; color: ${textColor};">${pct}%</span>
                </div>

                <div class="diagnostic-progress-bar">
                    <div class="diagnostic-progress-fill ${fillClass}" style="width: ${pct}%;"></div>
                </div>

                <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: ${weakSubcats ? '6px' : '0'};">
                    ${feedbackNote}
                </div>

                ${weakSubcats ? `
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 11px; color: var(--text-muted);">
                        <span style="font-weight: 600; color: var(--text-secondary);">Subcapitole cu greșeli:</span> ${weakSubcats}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    return `
        <div class="diagnostic-category-section">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                <h3 style="font-size: 18px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
                    <span>📊</span> Raport pe Categorii de Materie
                </h3>
                <span style="font-size: 12px; color: ${hasCritical ? '#f87171' : '#38bdf8'}; font-weight: 700;">
                    ${hasCritical ? '🚨 ' + criticalCategories.length + ' ' + (criticalCategories.length === 1 ? 'categorie critică' : 'categorii critice') : '✔️ Pregătire echilibrată'}
                </span>
            </div>

            <div class="diagnostic-alert-banner ${hasCritical ? 'critical' : 'stable'}">
                <span style="font-size: 22px; flex-shrink: 0;">${hasCritical ? '🚨' : '📊'}</span>
                <div style="font-size: 13px; color: #e2e8f0; line-height: 1.5;">
                    ${hasCritical 
                        ? `<strong>Atenție:</strong> Au fost identificate goluri de materie majore la <strong>${criticalCategories.map(c => c.name).join(', ')}</strong>. Fără o remediere sistematică a acestor capitole, există un risc ridicat de depunctare la cerințele de BAC sau Admitere.`
                        : `Ai o bază generală stabilă. Consultă detaliile de mai jos pentru a elimina ezitările pe cerințele specifice.`}
                </div>
            </div>

            <div class="diagnostic-cards-grid">
                ${cardsHtml}
            </div>
        </div>
    `;
}

/* ========================================================================
   RESULTS RENDERING
   ======================================================================== */
function renderResults(results) {
    const elapsed = state.endTime - state.startTime;
    const timeStr = formatTime(elapsed);
    const percent = Math.round((results.totalCorrect / questions.length) * 100);

    let html = `
            <div class="results-header">
                <div class="results-icon">${results.level.icon}</div>
                <h2>Rezultatele tale</h2>
                <p class="results-name">${escapeHtml(state.studentUsername)}</p>
            </div>

            <div class="score-display">
                <div class="score-value">
                    <span class="score-number" id="score-animated">0</span>
                    <span class="score-max">/${questions.length}</span>
                </div>
                <div class="score-percent">${percent}% din punctaj</div>
                ${(results.xpEarned && results.xpEarned > 0) ? `
                    <div style="margin-top: 12px;">
                        <span style="display: inline-flex; align-items: center; gap: 6px; background: rgba(251, 191, 36, 0.12); border: 1px solid rgba(251, 191, 36, 0.35); color: #fbbf24; font-weight: 800; font-size: 15px; padding: 5px 14px; border-radius: 20px;">
                            ⚡ +${results.xpEarned} XP Câștigați!
                        </span>
                    </div>` : ''}
            </div>

            <div class="level-container">
                <div class="level-badge ${results.level.class}">
                    <span>${results.level.icon}</span>
                    <span>${results.level.name}</span>
                </div>
                <p class="level-description">${results.level.description}</p>
            </div>

            <div class="stats-grid">
                <div class="stats-card">
                    <span class="stats-label">Corecte</span>
                    <span class="stats-value">${results.totalCorrect}/${questions.length}</span>
                </div>
                <div class="stats-card stats-card-time">
                    <span class="stats-label">Timp</span>
                    <span class="stats-value">${timeStr}</span>
                </div>
                <div class="stats-card stats-card-easy">
                    <span class="stats-label">Ușoare</span>
                    <span class="stats-value">${results.easyCorrect}/${results.easyTotal}</span>
                </div>
                <div class="stats-card stats-card-medium">
                    <span class="stats-label">Medii</span>
                    <span class="stats-value">${results.mediumCorrect}/${results.mediumTotal}</span>
                </div>
                <div class="stats-card stats-card-hard">
                    <span class="stats-label">Grele</span>
                    <span class="stats-value">${results.hardCorrect}/${results.hardTotal}</span>
                </div>
                <div class="stats-card">
                    <span class="stats-label">Puncte</span>
                    <span class="stats-value">${results.totalPoints}/${results.maxPoints}</span>
                </div>
            </div>

            ${state.blurCount > 0 ? `
            <div style="text-align:center; margin-bottom: 24px; padding: 12px 20px; background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: var(--radius-md); font-size: 13px; color: var(--accent-amber);">
                ⚠️ Ai părăsit pagina de ${state.blurCount} ori în timpul testului
            </div>` : ''}

            ${renderCategoryDiagnosticSection(results.details)}

            <div class="review-section">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h3 style="margin:0;">Detalii întrebări</h3>
                    <button type="button" class="btn btn-ghost" style="padding:6px 14px; font-size:12px; border-radius:6px;" onclick="toggleAllReviewItems()">
                        <span id="btn-toggle-all-text">Extinde tot</span>
                    </button>
                </div>
                <div class="review-list">
                    ${results.details.map(d => {
        const diffClass = `review-diff-${d.difficulty}`;
        const correctClass = d.isCorrect ? 'review-correct' : 'review-wrong';
        const icon = d.isCorrect ? '✓' : '✗';
        const studentOptText = d.studentAnswer !== null ? (d.options[d.studentAnswer] || '—') : '—';
        const correctOptText = d.options[d.correctAnswer] || '—';
        const detail = d.isCorrect
            ? `<div style="color:var(--accent-green);">Răspuns corect: <strong>${escapeHtml(correctOptText)}</strong></div>`
            : `<div style="margin-bottom:4px; color:var(--accent-red);">Răspunsul tău: <strong>${escapeHtml(studentOptText)}</strong></div><div style="color:var(--accent-green);">Răspuns corect: <strong>${escapeHtml(correctOptText)}</strong></div>`;

        // Show hint on final review ONLY for intermediate tests (not initial, not tema)
        const isIntermediate = (state.testType === 'intermediar' && !state.assignedTestId && state.examType !== 'Initial');
        const hintHtml = (isIntermediate && d.hint && d.hint.trim() !== '') ? `
            <div class="review-hint-wrapper" style="margin-top:10px;">
                <button type="button" class="btn-hint-inline" onclick="event.stopPropagation(); toggleReviewHint('rev-hint-${d.number}')">
                    <span>💡</span> HINT
                </button>
                <div id="rev-hint-${d.number}" class="review-hint-box" style="display:none; margin-top:8px;">
                    <div style="font-weight:700; color:#fbbf24; margin-bottom:4px; font-size:11px; text-transform:uppercase;">💡 Indiciu / Explicație:</div>
                    <div style="color:#e2e8f0; line-height:1.5;">${escapeHtml(d.hint)}</div>
                </div>
            </div>
        ` : '';

        const codeHtml = d.code ? `<pre class="detail-code" style="background:#0c0d1e; padding:10px; border-radius:4px; font-size:12px; color:#a6accd; margin:8px 0; overflow-x:auto;"><code class="language-cpp">${escapeHtml(d.code)}</code></pre>` : '';
        const dImgs = parseImageUrls(d.image_url);
        const imageHtml = dImgs.length > 0 ? `
            <div class="question-images-container" style="display:flex; flex-direction:column; align-items:center; gap:8px; margin:10px auto; text-align:center;">
                ${dImgs.map(url => `<img src="${url}" class="question-img-item" style="max-height:160px; border-radius:6px; margin:0 auto;" onclick="openLightbox('${url}')">`).join('')}
            </div>` : '';

        return `
                            <div class="review-item ${correctClass}" onclick="toggleReviewItem(this)">
                                <div class="review-header-row">
                                    <span class="review-num">${d.number}</span>
                                    <span class="review-diff ${diffClass}"></span>
                                    <span class="review-text">${escapeHtml(d.text.replace(/\\n/g, '\n'))}</span>
                                    <span class="review-icon">${icon}</span>
                                    <span class="review-chevron">▼</span>
                                </div>
                                <div class="review-answer-detail" onclick="event.stopPropagation()">
                                    <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:8px; white-space:pre-wrap;">${escapeHtml(d.text.replace(/\\n/g, '\n'))}</div>
                                    ${codeHtml}
                                    ${imageHtml}
                                    <div style="background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:6px; margin:8px 0; font-size:13px; border:1px solid rgba(255,255,255,0.05);">
                                        ${detail}
                                    </div>
                                    ${hintHtml}
                                </div>
                            </div>
                        `;
    }).join('')}
                </div>
            </div>

            </div>

            <button class="btn btn-ghost btn-restart" onclick="restartQuiz()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Alte Teste
            </button>
        `;

    els.resultsContainer.innerHTML = html;
    animateScore(results.totalCorrect);
}

function animateScore(target) {
    const el = $('#score-animated');
    if (!el) return;
    const duration = 1500;
    const start = performance.now();

    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
}

/* ========================================================================
   SHARE FUNCTIONALITY
   ======================================================================== */

function getResultsText() {
    return `Rezultate Test C++ — ${state.studentUsername}`;
}


/* ========================================================================
   QUESTION SELECTION & TEST TYPE
   ======================================================================== */

window.startAssignedTest = async function (assignedTestId, examType, questionsIds) {
    state.testType = 'tema';
    state.examType = examType;
    state.assignedTestId = assignedTestId;

    const btns = document.querySelectorAll('#screen-dashboard .btn, #screen-situatie .btn');
    btns.forEach(b => { b.disabled = true; b.style.opacity = '0.7'; });

    try {
        let hasProgress = false;
        // --- Fetch Progress ---
        try {
            const token = localStorage.getItem('active_student_token') || '';
            const progRes = await fetch(`/.netlify/functions/fetch-progress?student_username=${encodeURIComponent(state.studentUsername)}&assigned_test_id=${assignedTestId}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (progRes.ok) {
                const progData = await progRes.json();
                if (progData.has_progress) {
                    hasProgress = true;
                    state.answers = progData.answers_json || [];
                    state.currentQuestion = progData.current_index || 0;
                    // Adjust start time so elapsed calculation works
                    state.startTime = Date.now() - (progData.time_taken_ms || 0);
                }
            }
        } catch (e) { console.error('Eroare fetch progress', e); }
        // ----------------------

        const res = await apiFetch(`/.netlify/functions/fetch-questions?ids=${questionsIds.join(',')}`);
        if (!res.ok) throw new Error();
        const fetchedQs = await res.json();

        if (fetchedQs.length === 0) {
            showToast('Eroare: Întrebările nu mai sunt disponibile.');
            btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
            return;
        }

        questions = fetchedQs;
        timerDurationMs = 60 * 60 * 1000;
        localStorage.setItem('quiz_questions_ids', JSON.stringify(questions.map(q => q.id)));
        localStorage.setItem('quiz_assigned_test_id', assignedTestId);

        startQuiz(hasProgress);
    } catch (e) {
        showToast('Eroare la pornirea testului asignat.');
        btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
    }
};

window.startTest = function (type, examType) {
    const user = state.studentUsername || localStorage.getItem('active_student_username');
    if (!user) {
        showToast('Te rugăm să te autentifici.');
        showScreen('welcome');
        return;
    }
    selectTestType(type, user, examType);
};

window.startPublicInitialTest = async function () {
    state.isPublicInitial = true;
    state.studentUsername = 'Vizitator Nou (Lead)';
    state.studentId = null;
    state.assignedTestId = null;
    state.testType = 'initial';
    state.examType = 'Initial';
    state.answers = [];
    state.currentQuestion = 0;
    state.blurCount = 0;

    const btnPublic = document.getElementById('btn-public-initial');
    if (btnPublic) {
        btnPublic.disabled = true;
        btnPublic.innerHTML = '<span>Se încarcă testul gratuit...</span>';
    }

    try {
        const res = await apiFetch(`/.netlify/functions/fetch-questions?type=initial&examType=Initial`);
        if (!res.ok) throw new Error('Eroare la încărcarea întrebărilor de pe server.');
        const fetchedQs = await res.json();

        if (!fetchedQs || fetchedQs.length === 0) {
            showToast('Nu s-au putut încărca întrebările pentru testul inițial.', true);
            if (btnPublic) {
                btnPublic.disabled = false;
                btnPublic.innerHTML = '<span>🚀 Test Inițial Gratuit (30 min)</span>';
            }
            return;
        }

        questions = fetchedQs;
        timerDurationMs = 30 * 60 * 1000;
        localStorage.setItem('quiz_questions_ids', JSON.stringify(questions.map(q => q.id)));
        localStorage.setItem('quiz_is_public', 'true');

        startQuiz();
    } catch (e) {
        console.error('startPublicInitialTest error:', e);
        showToast('Eroare la pornirea testului: ' + e.message, true);
        if (btnPublic) {
            btnPublic.disabled = false;
            btnPublic.innerHTML = '<span>🚀 Test Inițial Gratuit (30 min)</span>';
        }
    }
};

async function selectTestType(type, username, examType = 'Initial') {
    state.testType = type;
    state.examType = examType;
    state.assignedTestId = null;
    localStorage.removeItem('quiz_assigned_test_id');

    const btnStartInit = document.getElementById('btn-start-initial');
    if (btnStartInit && type === 'initial') {
        btnStartInit.innerHTML = '<span>Se pregătesc întrebările...</span>';
        btnStartInit.disabled = true;
    }

    if (els.btnContinue) {
        els.btnContinue.innerHTML = '<span>Se pregătesc întrebările...</span>';
    }

    const btns = document.querySelectorAll('#screen-dashboard .btn');
    btns.forEach(b => { b.disabled = true; b.style.opacity = '0.7'; });

    try {
        const res = await apiFetch(`/.netlify/functions/fetch-questions?type=${type}&username=${encodeURIComponent(username)}&examType=${encodeURIComponent(examType)}`);
        
        if (res.status === 403) {
            // The backend has blocked access (expired subscription)
            showToast('Abonamentul tău a expirat. Contactează profesorul!', true);
            if (btnStartInit && type === 'initial') {
                btnStartInit.innerHTML = '🚀 Începe Testul Inițial';
                btnStartInit.disabled = false;
            }
            if (type === 'initial' && els.btnContinue) {
                els.btnContinue.innerHTML = '<span>Continuă</span>';
                els.btnContinue.disabled = false;
            }
            btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
            return;
        }

        if (!res.ok) {
            let errorMsg = 'Eroare la încărcarea întrebărilor.';
            try {
                const errData = await res.json();
                if (errData.error) errorMsg = errData.error;
            } catch (e) {}
            showToast(errorMsg, true);
            if (btnStartInit && type === 'initial') {
                btnStartInit.innerHTML = '🚀 Începe Testul Inițial';
                btnStartInit.disabled = false;
            }
            if (type === 'initial' && els.btnContinue) {
                els.btnContinue.innerHTML = '<span>Continuă</span>';
                els.btnContinue.disabled = false;
            }
            btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
            if (examType === 'Zilnic') {
                const activeUser = state.studentUsername || localStorage.getItem('active_student_username');
                const activeId = state.studentId || localStorage.getItem('active_student_id');
                if (activeUser && activeId) loadDashboard(activeUser, activeId);
            }
            return;
        }
        const fetchedQs = await res.json();

        if (fetchedQs.length === 0) {
            showToast(`Nu există întrebări pentru categoria ${examType}.`);
            if (btnStartInit && type === 'initial') {
                btnStartInit.innerHTML = '🚀 Începe Testul Inițial';
                btnStartInit.disabled = false;
            }
            if (type === 'initial' && els.btnContinue) {
                els.btnContinue.innerHTML = '<span>Continuă</span>';
                els.btnContinue.disabled = false;
            }
            btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
            return;
        }

        questions = fetchedQs;
        timerDurationMs = (examType === 'Initial') ? 30 * 60 * 1000 : 60 * 60 * 1000;

        localStorage.setItem('quiz_questions_ids', JSON.stringify(questions.map(q => q.id)));
        startQuiz();
    } catch (e) {
        showToast('Eroare la încărcarea întrebărilor.');
        if (btnStartInit && type === 'initial') {
            btnStartInit.innerHTML = '🚀 Începe Testul Inițial';
            btnStartInit.disabled = false;
        }
        if (type === 'initial' && els.btnContinue) {
            els.btnContinue.innerHTML = '<span>Continuă</span>';
            els.btnContinue.disabled = false;
        }
        btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
    }
}

/* ========================================================================
   QUIZ LIFECYCLE
   ======================================================================== */
async function loadDashboard(username, studentId) {
    try {
        const token = localStorage.getItem('active_student_token') || '';
        const resultsRes = await fetch('/.netlify/functions/check-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ username: username })
        });

        if (resultsRes.status === 401) {
            showToast('Sesiunea a expirat. Te rugăm să te autentifici din nou.', true);
            logoutStudent();
            return;
        }

        const resultsData = await resultsRes.json();

        if (resultsData.exists) {
            // Check if subscription has expired
            if (resultsData.is_expired) {
                const dateLabel = document.getElementById('expired-date-label');
                if (dateLabel) {
                    if (resultsData.expires_at) {
                        let exp;
                        if (resultsData.expires_at.includes('/')) {
                            const parts = resultsData.expires_at.split('/');
                            if (parts.length === 3) {
                                exp = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
                            } else {
                                exp = new Date(resultsData.expires_at);
                            }
                        } else {
                            exp = new Date(resultsData.expires_at);
                        }
                        
                        if (!isNaN(exp.getTime())) {
                            dateLabel.textContent = exp.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        } else {
                            dateLabel.textContent = '-';
                        }
                    } else {
                        dateLabel.textContent = '-';
                    }
                }
                const btnRenew = document.getElementById('btn-whatsapp-renew');
                if (btnRenew) {
                    const tutorPhone = '40740842820';
                    const renewMsg = encodeURIComponent(`Salut! Sunt @${username} și doresc să îmi reînnoiesc abonamentul lunar la AcaDE-QUIZ.`);
                    btnRenew.href = `https://wa.me/${tutorPhone}?text=${renewMsg}`;
                }
                
                // Show expiration banner, hide test buttons
                document.getElementById('dash-expiration-banner').style.display = 'block';
                document.getElementById('dash-initial-section').style.display = 'none';
                document.getElementById('dash-assigned-tests').style.display = 'none';
                document.getElementById('dash-categories-container').style.display = 'none';
                const elTimeHintExp = document.getElementById('dash-test-time-hint');
                if (elTimeHintExp) elTimeHintExp.style.display = 'none';
                document.getElementById('practice-categories-wrapper').style.display = 'none';

                // We do NOT clear the token, so the user can still view their progress/history on the dashboard.
            } else {
                // If not expired, hide banner and show test buttons
                document.getElementById('dash-expiration-banner').style.display = 'none';
                document.getElementById('dash-categories-container').style.display = 'grid';
                const elTimeHintAct = document.getElementById('dash-test-time-hint');
                if (elTimeHintAct) elTimeHintAct.style.display = 'flex';
                document.getElementById('practice-categories-wrapper').style.display = 'block';
                // dash-initial-section and dash-assigned-tests will be shown later if applicable
            }

            state.studentUsername = username;
            state.studentId = studentId;
            document.getElementById('dash-username').textContent = username;

            if (!resultsData.phone_number) {
                const phoneModal = document.getElementById('modal-phone');
                if (phoneModal) {
                    phoneModal.style.display = 'flex';
                }
            }

            // Gamification update
            if (resultsData.gamification) {
                const g = resultsData.gamification;
                const elStreak = document.getElementById('dash-streak');
                const elXp = document.getElementById('dash-xp');
                const elPercentile = document.getElementById('dash-percentile');
                const elLevelText = document.getElementById('dash-level-text');
                const elLevelFill = document.getElementById('dash-level-fill');
                const elDecayMsg = document.getElementById('dash-brain-decay-msg');
                
                if (elStreak) elStreak.textContent = g.streak;
                if (elXp) elXp.textContent = g.xp + ' XP';
                if (elPercentile) elPercentile.textContent = 'Top ' + g.percentile + '%';
                
                if (elLevelText) elLevelText.textContent = parseFloat(g.grade).toFixed(2) + ' / 10';
                if (elLevelFill) {
                    // Slight delay to allow CSS transition to play
                    setTimeout(() => {
                        elLevelFill.style.width = (parseFloat(g.grade) * 10) + '%';
                    }, 300);
                }
                
                if (elDecayMsg) {
                    if (g.streak === 0 && (resultsData.history && resultsData.history.length > 0)) {
                        elDecayMsg.style.display = 'block';
                    } else {
                        elDecayMsg.style.display = 'none';
                    }
                }
            }

            const history = resultsData.history || [];
            const hasCompletedInitial = (resultsData.hasCompletedInitial !== undefined)
                ? !!resultsData.hasCompletedInitial
                : history.some(h => {
                    if (!h || !h.test_type) return false;
                    const t = h.test_type.toLowerCase().trim();
                    if (t === 'category_coverage' || t === 'lead_diagnostic' || t.startsWith('progress_')) return false;
                    return t === 'initial' || t.startsWith('initial');
                });
            state.hasCompletedInitial = hasCompletedInitial;

            const initialSection = document.getElementById('dash-initial-section');
            const categoriesContainer = document.getElementById('dash-categories-container');
            const dashSubtitle = document.getElementById('dash-subtitle');
            const elTimeHint = document.getElementById('dash-test-time-hint');
            const practiceContainer = document.getElementById('dash-practice-container');
            const dashAssigned = document.getElementById('dash-assigned-tests');
            const dashDaily = document.getElementById('dash-daily-test-section');

            if (!hasCompletedInitial) {
                if (initialSection) initialSection.style.display = 'block';
                if (categoriesContainer) categoriesContainer.style.display = 'none';
                if (elTimeHint) elTimeHint.style.display = 'none';
                if (practiceContainer) practiceContainer.style.display = 'none';
                if (dashDaily) dashDaily.style.display = 'none';
                if (dashAssigned) dashAssigned.style.display = 'none';
                if (dashSubtitle) dashSubtitle.textContent = 'Pentru a începe, susține testul de evaluare inițială:';
            } else {
                if (initialSection) initialSection.style.display = 'none';
                if (categoriesContainer) categoriesContainer.style.display = 'grid';
                if (elTimeHint) elTimeHint.style.display = 'flex';
                if (practiceContainer) practiceContainer.style.display = 'block';
                if (dashSubtitle) dashSubtitle.innerHTML = `<span style="font-style: italic; color: var(--text-secondary);">„Un test la informatică pe zi ține AFT-ul la distanță”</span><br><span style="display: block; text-align: right; font-size: 12px; color: var(--text-muted); margin-top: 6px;">~ Citat anonim</span>`;
            }

            // Enable all dashboard buttons
            const allBtns = document.querySelectorAll('#screen-dashboard .btn, #screen-situatie .btn, .dash-cat-btn, #btn-start-initial');
            allBtns.forEach(b => {
                b.disabled = false;
                b.style.opacity = '1';
                b.style.pointerEvents = 'auto';
            });
            const btnStartInit = document.getElementById('btn-start-initial');
            if (btnStartInit) btnStartInit.innerHTML = '🚀 Începe Testul Inițial';

            // Fetch assigned tests (only if initial test is done)
            if (hasCompletedInitial) {
                try {
                    const token = localStorage.getItem('active_student_token') || '';
                    const asRes = await fetch(`/.netlify/functions/manage-assigned-tests?username=${encodeURIComponent(username)}`, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    if (asRes.ok) {
                        const assignedTests = await asRes.json();
                        const pendingTests = assignedTests.filter(t => t.status === 'pending');
                        const dashAssigned = document.getElementById('dash-assigned-tests');

                        if (pendingTests.length > 0) {
                            let html = '<h3 style="font-size: 16px; margin-bottom: 12px; color: var(--accent-purple); text-shadow: 0 0 10px rgba(124,106,255,0.4);">🔥 Teme Primite:</h3>';
                            pendingTests.forEach(pt => {
                                const answered = pt.answered_count || 0;
                                const total = pt.target_length || (pt.questions_ids ? pt.questions_ids.length : 0);
                                const progressLabel = `(${answered}/${total} Întrebări rezolvate)`;
                                const btnText = answered > 0 ? 'Continuă Tema' : 'Începe Tema';

                                html += `
                                            <div style="background: linear-gradient(145deg, rgba(124,106,255,0.15), rgba(0,0,0,0.4)); border: 1px solid var(--accent-purple); border-left: 4px solid var(--accent-purple); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 10px; text-align: left; box-shadow: 0 4px 15px rgba(124,106,255,0.2);">
                                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                                                    <div>
                                                        <div style="font-weight: 700; font-size: 16px; color: #fff;">Test ${pt.exam_type}</div>
                                                        <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Până la: <strong style="color:var(--accent-purple);">${formatEuropeanDateTime(pt.deadline)}</strong></div>
                                                        ${new Date(pt.deadline) < new Date() ? '<span class="badge" style="background:rgba(248,113,113,0.2); color:var(--accent-red); margin-top:6px; display:inline-block;">Întârziat</span>' : ''}
                                                    </div>
                                                    <div style="font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; color: #e2e8f0;">
                                                        ${progressLabel}
                                                    </div>
                                                </div>
                                                <button onclick='startAssignedTest("${pt.id}", "${pt.exam_type}", ${JSON.stringify(pt.questions_ids)})' class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 15px;">${btnText}</button>
                                            </div>
                                        `;
                            });
                            if (dashAssigned) {
                                dashAssigned.innerHTML = html;
                                dashAssigned.style.display = 'block';
                            }
                        } else {
                            if (dashAssigned) {
                                dashAssigned.style.display = 'none';
                                dashAssigned.innerHTML = '';
                            }
                        }
                    }
                } catch (e) {
                    console.error('Eroare fetch assigned tests', e);
                }
            } else {
                if (dashAssigned) {
                    dashAssigned.style.display = 'none';
                    dashAssigned.innerHTML = '';
                }
            }

            // Fetch Daily Test (Coada Azi)
            if (resultsData.hasDailyToday || !hasCompletedInitial) {
                if (dashDaily) {
                    dashDaily.style.display = 'none';
                    dashDaily.innerHTML = '';
                }
            } else {
                try {
                    const dailyRes = await apiFetch(`/.netlify/functions/fetch-mastery?username=${encodeURIComponent(username)}`);
                    if (dailyRes.ok) {
                        const dailyData = await dailyRes.json();
                        const isDailyDone = !!(dailyData.hasDailyToday || resultsData.hasDailyToday);
                        if (isDailyDone || !hasCompletedInitial) {
                            if (dashDaily) {
                                dashDaily.style.display = 'none';
                                dashDaily.innerHTML = '';
                            }
                        } else {
                            const catArray = Object.keys(dailyData.mastery || {}).map(catName => ({
                                category: catName,
                                percent: dailyData.mastery[catName].percentage,
                                mastered: dailyData.mastery[catName].correct,
                                total: dailyData.mastery[catName].seen
                            }));
                            let weakCats = catArray.filter(c => c.percent < 60 && c.total > 0).sort((a,b) => a.percent - b.percent);
                            let coadaText = "Azi poți începe cu un test echilibrat de cunoștințe.";
                            if (weakCats.length > 0) {
                                coadaText = `Astăzi ar trebui să revizuiești întrebările greșite la <strong>${escapeHtml(weakCats[0].category)}</strong> și să îți fortifici cunoștințele.`;
                                if (weakCats.length > 1) {
                                    coadaText = `Astăzi ai de revizuit întrebări la <strong>${escapeHtml(weakCats[0].category)}</strong> și de lucrat suplimentar la <strong>${escapeHtml(weakCats[1].category)}</strong>.`;
                                }
                            }

                            if (dashDaily) {
                                dashDaily.innerHTML = `
                                    <h3 style="font-size: 16px; margin-bottom: 12px; color: #38bdf8; text-shadow: 0 0 10px rgba(56,189,248,0.4); display:flex; align-items:center; gap:8px;">
                                        <span>🎯</span> Test Zilnic Adaptiv
                                    </h3>
                                    <div style="background: linear-gradient(145deg, rgba(56,189,248,0.15), rgba(0,0,0,0.4)); border: 1px solid #38bdf8; border-left: 4px solid #38bdf8; border-radius: var(--radius-sm); padding: 16px; margin-bottom: 10px; text-align: left; box-shadow: 0 4px 15px rgba(56,189,248,0.2);">
                                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                                            <div>
                                                <div style="font-weight: 700; font-size: 16px; color: #fff;">Antrenament Personalizat</div>
                                                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">${coadaText}</div>
                                            </div>
                                            <div style="font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; color: #e2e8f0; display:flex; align-items:center; gap:6px;">
                                                ⏱️ ~ 15 min
                                            </div>
                                        </div>
                                        <button onclick="startTest('intermediar', 'Zilnic')" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 15px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border:none; display:flex; align-items:center; justify-content:center; gap:8px;">
                                            <span>🚀</span> Începe Testul Zilnic
                                        </button>
                                    </div>
                                `;
                                dashDaily.style.display = 'block';
                            }
                        }
                    }
                } catch (e) {
                    console.error('Eroare fetch daily test', e);
                }
            }

            // Load Module 1 Category Practice Coverage only if initial test has been completed
            if (hasCompletedInitial) {
                loadPracticeCoverage(username);
            }

            showScreen('dashboard');

            // Obligativitate setare numar de telefon daca nu exista in baza de date
            if (!resultsData.phone_number) {
                showPhoneModal();
            }
        } else {
            showToast(resultsData.error || 'Eroare la încărcarea profilului.', true);
            showScreen('welcome');
        }
    } catch (e) {
        console.error('loadDashboard error', e);
        showToast('Eroare la încărcarea istoricului.');
        showScreen('welcome');
    }
}

function showPhoneModal() {
    const modal = document.getElementById('modal-phone');
    const input = document.getElementById('phone-input');
    const btnSubmit = document.getElementById('btn-submit-phone');
    if (!modal) return;

    modal.style.display = 'flex';
    if (input) {
        setTimeout(() => input.focus(), 100);
    }

    if (btnSubmit && !btnSubmit.dataset.bound) {
        btnSubmit.dataset.bound = 'true';
        btnSubmit.addEventListener('click', handlePhoneSubmit);
    }
    if (input && !input.dataset.bound) {
        input.dataset.bound = 'true';
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handlePhoneSubmit();
            }
        });
    }
}
window.showPhoneModal = showPhoneModal;

async function handlePhoneSubmit() {
    const input = document.getElementById('phone-input');
    const btnSubmit = document.getElementById('btn-submit-phone');
    const modal = document.getElementById('modal-phone');
    if (!input || !modal) return;

    const phone = input.value.trim();
    let cleanPhone = phone.replace(/\s+/g, '').replace(/[-().]/g, '');
    if (cleanPhone.startsWith('+40')) cleanPhone = '0' + cleanPhone.substring(3);
    else if (cleanPhone.startsWith('40') && cleanPhone.length === 11) cleanPhone = '0' + cleanPhone.substring(2);
    else if (cleanPhone.startsWith('7') && cleanPhone.length === 9) cleanPhone = '0' + cleanPhone;

    const phoneRegex = /^07\d{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
        showToast('Număr invalid! Trebuie să fie de tipul 07XXXXXXXX (10 cifre).', true);
        input.focus();
        return;
    }

    const originalText = btnSubmit ? btnSubmit.textContent : '';
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Se salvează...';
    }

    try {
        const token = localStorage.getItem('active_student_token') || '';
        const username = state.studentUsername || localStorage.getItem('active_student_username') || '';
        const studentId = state.studentId || localStorage.getItem('active_student_id') || '';

        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/.netlify/functions/update-phone', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                student_id: studentId,
                username: username,
                phone_number: cleanPhone,
                phone: cleanPhone
            })
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
            showToast('Numărul de WhatsApp a fost salvat cu succes!');
            modal.style.display = 'none';
        } else {
            showToast(data.error || 'Eroare la salvarea numărului de telefon.', true);
        }
    } catch (err) {
        console.error('handlePhoneSubmit error:', err);
        showToast('Eroare de conexiune la salvarea numărului.', true);
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText || 'E gata, Salvează!';
        }
    }
}
window.handlePhoneSubmit = handlePhoneSubmit;

function logoutStudent() {
    clearStateFromStorage();
    localStorage.removeItem('active_student_username');
    localStorage.removeItem('active_student_id');
    localStorage.removeItem('active_student_token');
    
    state.studentUsername = '';
    state.studentId = null;
    state.assignedTestId = null;
    showScreen('welcome');
}
window.logoutStudent = logoutStudent;

async function handleLogin() {
    const username = els.studentUsername.value.trim().toLowerCase();
    const password = els.studentPassword.value.trim();
    if (!username || !password) {
        showToast('Te rugăm să introduci userul și parola.');
        return;
    }

    els.btnContinue.disabled = true;
    const originalText = els.btnContinue.innerHTML;
    els.btnContinue.innerHTML = '<span>Se autentifică...</span>';

    try {
        const res = await fetch('/.netlify/functions/auth-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            state.studentUsername = data.student.username;
            state.studentId = data.student.id;

            els.btnContinue.innerHTML = '<span>Se verifică istoricul...</span>';

            localStorage.setItem('active_student_username', state.studentUsername);
            localStorage.setItem('active_student_id', state.studentId);
            if (data.token) {
                localStorage.setItem('active_student_token', data.token);
            }

            if (!data.student.phone_number || data.student.phone_number.trim() === '') {
                // Afișează modalul de telefon și blochează dashboard-ul temporar
                els.btnContinue.innerHTML = '<span>Se verifică datele...</span>';
                els.modalPhone.style.display = 'flex';
                els.btnSubmitPhone.onclick = async () => {
                    const phone = els.phoneInput.value.trim();
                    if (!phone) {
                        showToast('Te rugăm să introduci numărul.', true);
                        return;
                    }
                    els.btnSubmitPhone.disabled = true;
                    els.btnSubmitPhone.textContent = 'Se salvează...';
                    
                    try {
                        const token = localStorage.getItem('active_student_token');
                        const phoneRes = await fetch('/.netlify/functions/update-phone', {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}` 
                            },
                            body: JSON.stringify({ 
                                username: state.studentUsername,
                                phone_number: phone
                            })
                        });
                        if (phoneRes.ok) {
                            els.modalPhone.style.display = 'none';
                            els.btnContinue.innerHTML = '<span>Se deschide dashboard-ul...</span>';
                            await loadDashboard(username, data.student.id);
                        } else {
                            const errData = await phoneRes.json();
                            showToast(errData.error || 'Eroare la salvare', true);
                            els.btnSubmitPhone.disabled = false;
                            els.btnSubmitPhone.textContent = 'E gata, Salvează!';
                        }
                    } catch (err) {
                        showToast('Eroare conexiune', true);
                        els.btnSubmitPhone.disabled = false;
                        els.btnSubmitPhone.textContent = 'E gata, Salvează!';
                    }
                };
            } else {
                await loadDashboard(username, data.student.id);
            }
        } else {
            showToast(data.error || 'Eroare la conectare.', true);
            els.btnContinue.innerHTML = originalText;
            els.btnContinue.disabled = false;
        }
    } catch (e) {
        showToast('Eroare la conectare la server.', true);
        els.btnContinue.innerHTML = originalText;
        els.btnContinue.disabled = false;
    }
}

function startQuiz(isResume = false) {
    if (!isResume) {
        state.currentQuestion = 0;
        state.answers = new Array(questions.length).fill(null);
        state.startTime = Date.now();
        state.endTime = null;
        state.blurCount = 0;
        state.questionTimings = new Array(questions.length).fill(0);
        state.questionEnteredAt = null;
    } else {
        if (!state.answers || state.answers.length !== questions.length) {
            const existing = state.answers || [];
            state.answers = new Array(questions.length).fill(null);
            for (let i = 0; i < existing.length && i < questions.length; i++) {
                state.answers[i] = existing[i];
            }
        }
        if (state.currentQuestion >= questions.length) {
            state.currentQuestion = 0;
        }
        const savedStart = localStorage.getItem('quiz_start_time');
        state.startTime = state.startTime || (savedStart ? parseInt(savedStart) : Date.now());
        state.endTime = null;
        state.blurCount = parseInt(localStorage.getItem('quiz_blur_count') || '0');
    }

    const timerBadge = $('#quiz-timer');
    const anticheatBadge = els.anticheatBadge || $('#anticheat-badge');
    const autosaveBadge = $('#assigned-autosave-badge');
    const btnAssignedExitNav = $('#btn-assigned-save-exit');
    const btnExitText = $('#btn-exit-text');
    const btnExitEl = $('#btn-exit');

    if (state.assignedTestId) {
        // STRICT LA TESTELE ASIGNATE: fara afisare timp, fara logica expirare, fara abateri focus
        if (timerBadge) timerBadge.style.display = 'none';
        if (anticheatBadge) anticheatBadge.style.display = 'none';
        if (autosaveBadge) autosaveBadge.style.display = 'inline-flex';
        if (btnAssignedExitNav) btnAssignedExitNav.style.display = 'inline-flex';
        if (btnExitText) btnExitText.textContent = 'Salvează & Ieși';
        if (btnExitEl) {
            btnExitEl.style.background = 'rgba(124, 106, 255, 0.15)';
            btnExitEl.style.borderColor = 'rgba(124, 106, 255, 0.4)';
            btnExitEl.style.color = '#c4b5fd';
            btnExitEl.title = 'Progresul se salvează automat. Poți părăsi tema oricând!';
        }
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    } else {
        if (timerBadge) timerBadge.style.display = '';
        if (anticheatBadge) {
            anticheatBadge.style.display = '';
            anticheatBadge.className = 'anticheat-badge';
        }
        if (autosaveBadge) autosaveBadge.style.display = 'none';
        if (btnAssignedExitNav) btnAssignedExitNav.style.display = 'none';
        if (btnExitText) btnExitText.textContent = 'Ieșire';
        if (btnExitEl) {
            btnExitEl.style.background = '';
            btnExitEl.style.borderColor = '';
            btnExitEl.style.color = '';
            btnExitEl.title = '';
        }
        els.blurCountDisplay.textContent = '0';
        startTimer();
    }

    saveStateToStorage();
    showScreen('quiz');
    renderQuestion();
}

async function finishQuiz(autoSubmitted = false) {
    // Record timing for current question
    if (state.questionEnteredAt !== null) {
        const timeSpent = Date.now() - state.questionEnteredAt;
        state.questionTimings[state.currentQuestion] = (state.questionTimings[state.currentQuestion] || 0) + timeSpent;
        state.questionEnteredAt = null;
    }

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    state.endTime = Date.now();

    // Close any open modals immediately (e.g. exit modal, image zoom)
    const exitModal = document.getElementById('modal-exit');
    if (exitModal) exitModal.style.display = 'none';
    const lightboxModal = document.getElementById('lightbox-modal');
    if (lightboxModal) lightboxModal.style.display = 'none';

    // Disable navigation and option cards immediately to freeze user input
    if (els.btnNext) els.btnNext.disabled = true;
    if (els.btnPrev) els.btnPrev.disabled = true;
    if (els.optionsContainer) {
        const cards = els.optionsContainer.querySelectorAll('.option-card');
        cards.forEach(c => c.style.pointerEvents = 'none');
    }

    const elapsed = state.endTime - state.startTime;

    showScreen('results');
    els.resultsContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Se evaluează testul pe server...</p></div>';

    await submitResult(elapsed);
}

function restartQuiz() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    clearStateFromStorage();
    state.currentQuestion = 0;
    state.answers = [];
    state.startTime = null;
    state.endTime = null;
    state.blurCount = 0;
    state.questionTimings = [];
    state.questionEnteredAt = null;
    state.assignedTestId = null;

    const timerBadge = $('#quiz-timer');
    if (timerBadge) {
        timerBadge.style.display = '';
        timerBadge.classList.remove('warning');
        const countdownEl = $('#timer-countdown');
        if (countdownEl) countdownEl.textContent = '30:00';
    }
    if (els.anticheatBadge) {
        els.anticheatBadge.style.display = '';
        els.anticheatBadge.className = 'anticheat-badge';
    }

    const activeUser = localStorage.getItem('active_student_username');
    const activeId = localStorage.getItem('active_student_id');
    if (activeUser && activeId) {
        state.studentUsername = activeUser;
        state.studentId = activeId;
        loadDashboard(activeUser, activeId);
    } else {
        state.studentUsername = '';
        state.studentId = null;
        showScreen('welcome');
    }

    const allBtns = document.querySelectorAll('#screen-dashboard .btn, #screen-situatie .btn, .dash-cat-btn, #btn-start-initial');
    allBtns.forEach(b => {
        b.disabled = false;
        b.style.opacity = '1';
        b.style.pointerEvents = 'auto';
    });
    const btnStartInit = document.getElementById('btn-start-initial');
    if (btnStartInit) btnStartInit.innerHTML = '🚀 Începe Testul Inițial';

    els.studentUsername.value = '';
    els.studentPassword.value = '';
    els.btnContinue.disabled = false;
    els.btnContinue.innerHTML = `<span>Autentificare & Începe</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                    stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                </svg>`;
}
window.restartQuiz = restartQuiz;


/* ========================================================================
   ANTI-CHEAT: BLUR/FOCUS TRACKING
   ======================================================================== */
let lastBlurTime = 0;
function triggerBlur() {
    if (!els.screenQuiz.classList.contains('active')) return;
    // STRICT LA TESTELE ASIGNATE: Fara abateri/focus tracking
    if (state.assignedTestId) return;

    const lightbox = document.getElementById('lightbox-modal');
    const exitModal = document.getElementById('modal-exit');
    if ((lightbox && lightbox.style.display === 'flex') || (exitModal && exitModal.style.display === 'flex')) {
        return; // Nu penaliza acțiunile pe modalele interne
    }
    const now = Date.now();
    if (now - lastBlurTime < 1000) return; // Debounce duplicate events within 1s
    lastBlurTime = now;

    state.blurCount++;
    els.blurCountDisplay.textContent = state.blurCount;
    showToast(`⚠️ Ai părăsit pagina de test! (Abatere #${state.blurCount})`, 3000);
    saveStateToStorage();

    if (state.blurCount >= 5) {
        els.anticheatBadge.className = 'anticheat-badge danger';
    } else if (state.blurCount >= 2) {
        els.anticheatBadge.className = 'anticheat-badge warned';
    }
}

function setupAntiCheat() {
    document.addEventListener('visibilitychange', () => {
        saveStateToStorage();
        if (state.assignedTestId) saveAssignedProgress();
        if (document.hidden) triggerBlur();
    });
    window.addEventListener('blur', () => {
        saveStateToStorage();
        if (state.assignedTestId) saveAssignedProgress();
        triggerBlur();
    });
    window.addEventListener('pagehide', () => {
        saveStateToStorage();
        if (state.assignedTestId) saveAssignedProgress();
    });
    window.addEventListener('beforeunload', () => {
        saveStateToStorage();
        if (state.assignedTestId) saveAssignedProgress();
    });
}

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
const btnExit = $('#btn-exit');
const modalExit = $('#modal-exit');
const btnCancelExit = $('#btn-cancel-exit');
const btnConfirmExit = $('#btn-confirm-exit');
const modalAssignedExit = $('#modal-assigned-exit');
const btnAssignedCancelExit = $('#btn-assigned-cancel-exit');
const btnAssignedConfirmExit = $('#btn-assigned-confirm-exit');

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
let questionsLoaded = false;

async function initApp() {
    try {
        // Questions are loaded dynamically on login
        questionsLoaded = true;

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
                questions = fetchedQs;
            }

            if (questions.length === 0) {
                // fallback if failed to fetch
                clearStateFromStorage();
                if (activeUser && activeId) {
                    state.studentUsername = activeUser;
                    state.studentId = activeId;
                    return loadDashboard(activeUser, activeId);
                }
                return showScreen('welcome');
            }

            timerDurationMs = (state.examType === 'Initial') ? 30 * 60 * 1000 : 60 * 60 * 1000;

            let maxAllowedTimeMs = timerDurationMs;

            if (!state.assignedTestId && (Date.now() - state.startTime > maxAllowedTimeMs)) {
                showToast('Timpul alocat testului a expirat.', true);
                clearStateFromStorage();
                if (activeUser && activeId) {
                    state.studentUsername = activeUser;
                    state.studentId = activeId;
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
            if (activeUser && activeId) {
                state.studentUsername = activeUser;
                state.studentId = activeId;
                loadDashboard(activeUser, activeId);
            } else {
                // Not logged in
            }
        }
    } catch (err) {
        console.error('Initialization error:', err);
        showToast('Eroare la incarcarea testului.');
    }
}

// Lightbox Functions
function openLightbox(url) {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    if (modal && img && url) {
        img.src = url;
        modal.style.display = 'flex';
    }
}
window.openLightbox = openLightbox;

function closeLightbox() {
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
function showDashboard() {
    showScreen('dashboard');
}
window.showDashboard = showDashboard;

async function showSituatiaMea() {
    if (state.hasCompletedInitial === false) {
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

function generateRadarChartSVG(categories) {
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

    // Dimensiuni & layout: viewBox 580 x 380 oferă spațiu generos pentru etichete pe orizontală și verticală
    const cx = 290;
    const cy = 190;
    const R = 110;
    const n = 5;

    // Scalare logaritmică: log10(1 + 9 * x)
    // Permite vizualizarea clară a progresului inițial (5%, 10%, 20%) fără a rămâne blocat la centru
    const getLogRadius = (pct) => {
        if (!pct || pct <= 0) return 0.08 * R;
        const norm = Math.min(Math.max(pct, 0), 100) / 100;
        const logRatio = Math.log10(1 + 9 * norm);
        return Math.max(logRatio, 0.08) * R;
    };

    // Nivelurile grilei corespunzătoare reperelor logaritmice (10%, 25%, 50%, 75%, 100%)
    const milestoneLevels = [
        { pct: 10, ratio: Math.log10(1 + 9 * 0.10) }, // ~0.28 R
        { pct: 25, ratio: Math.log10(1 + 9 * 0.25) }, // ~0.51 R
        { pct: 50, ratio: Math.log10(1 + 9 * 0.50) }, // ~0.74 R
        { pct: 75, ratio: Math.log10(1 + 9 * 0.75) }, // ~0.89 R
        { pct: 100, ratio: 1.0 }                      // 1.00 R
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
        gridSvg += `<text x="${cx + 4}" y="${labelY.toFixed(1)}" fill="rgba(255,255,255,0.3)" font-size="8" font-family="monospace">${m.pct}%</text>`;
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

        // Poziție etichetă în afara cercului exterior cu margini sigure
        const labelR = R + 22;
        const lx = cx + labelR * Math.cos(angle);
        const ly = cy + labelR * Math.sin(angle);
        let textAnchor = 'middle';
        if (Math.abs(Math.cos(angle)) > 0.3) {
            textAnchor = Math.cos(angle) > 0 ? 'start' : 'end';
        }

        const pctColor = pct >= 75 ? '#34d399' : (pct >= 50 ? '#fbbf24' : (pct > 0 ? '#f87171' : '#94a3b8'));

        labelsSvg += `
            <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${textAnchor}" class="radar-axis-label" dominant-baseline="central">
                ${catInfo.icon} ${catInfo.name}
                <tspan dx="4" fill="${pctColor}" font-weight="900">(${pct}%)</tspan>
            </text>
        `;
    }

    return `
        <svg viewBox="0 0 580 380" class="radar-svg" xmlns="http://www.w3.org/2000/svg">
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

async function loadSituatiaCoverage(username) {
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
            ${data.hasDailyToday ? '' : `
            <div class="glow-card" style="background: linear-gradient(145deg, rgba(56,189,248,0.15), rgba(0,0,0,0.4)); border: 1px solid #38bdf8; border-left: 4px solid #38bdf8; border-radius: var(--radius-sm); padding: 16px; margin-bottom: 20px; text-align: left; box-shadow: 0 4px 15px rgba(56,189,248,0.2);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                    <div>
                        <div style="font-weight: 700; font-size: 16px; color: #fff; display:flex; align-items:center; gap:8px;">
                            <span>🎯</span> Test Zilnic Adaptiv
                        </div>
                        <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">${coadaText}</div>
                    </div>
                    <div style="font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; color: #e2e8f0; display:flex; align-items:center; gap:6px;">
                        ⏱️ ~ 15 min
                    </div>
                </div>
                <button onclick="startTest('intermediar', 'Zilnic')" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 15px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border:none; display:flex; align-items:center; justify-content:center; gap:8px;">
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
                <div class="coverage-cat-card">
                    <div class="coverage-cat-top">
                        <span class="coverage-cat-title">${icon} ${escapeHtml(cat.category)}</span>
                        <span class="coverage-cat-percent">${cat.percent}%</span>
                    </div>
                    <div class="practice-mini-bar" style="margin-bottom: 8px;">
                        <div class="practice-mini-fill" style="width: ${cat.percent}%;"></div>
                    </div>
                    <div class="coverage-cat-footer">
                        ${cat.mastered} / ${cat.total} întrebări răspuns corect
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

function getTestDisplayInfo(ht) {
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
        return {
            title: `Temă (${cat})`,
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

function renderSituatiaStudent(historyTests) {
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

function toggleHistoryDetails(id) {
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

function generateHistoryDetailsHTML(details, htId = '', isIntermediate = false) {
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

/* ========================================================================
   MODULE 1: LUCRU INDIVIDUAL, SPACED REPETITION & CALCULUL PROGRESULUI
   ======================================================================== */
const practiceState = {
    category: '',
    subcategory: '',
    queue: [],
    firstAttemptSet: new Set(),
    masteredInSession: new Set(),
    correctQuestionsInSession: new Set(),
    currentSelectedIndex: null,
    totalOriginal: 0,
    solvedCount: 0,
    earnedXp: 0
};

async function loadPracticeCoverage(username) {
    const user = username || state.studentUsername || localStorage.getItem('active_student_username');
    if (!user) return;
    const token = localStorage.getItem('active_student_token') || '';

    const listEl = document.getElementById('practice-categories-list');
    const globalPercentEl = document.getElementById('practice-global-percent');
    const masterFillEl = document.getElementById('practice-master-fill');
    const masteredCountEl = document.getElementById('practice-mastered-count');

    try {
        const res = await fetch(`/.netlify/functions/manage-practice?action=get_coverage&student_username=${encodeURIComponent(user)}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) return;
        const data = await res.json();

        if (globalPercentEl) globalPercentEl.textContent = `${data.overall_percent}%`;
        if (masterFillEl) masterFillEl.style.width = `${data.overall_percent}%`;
        if (masteredCountEl) masteredCountEl.textContent = `${data.total_mastered} / ${data.total_questions} rezolvate din prima`;

        if (listEl && Array.isArray(data.categories)) {
            listEl.innerHTML = data.categories.map(cat => {
                const subcatOptions = (cat.subcategories || []).map(s => `
                    <option value="${escapeHtml(s.subcategory)}">${escapeHtml(s.subcategory)} (${s.mastered}/${s.total} - ${s.percent}%)</option>
                `).join('');

                const catIcons = {
                    'Fundamente': '📘',
                    'Organizarea Datelor': '📗',
                    'Subprograme': '📙',
                    'Backtracking': '📕',
                    'Grafuri si Arbori': '📓'
                };
                const icon = catIcons[cat.category] || '📂';

                return `
                    <div class="practice-cat-item">
                        <div class="practice-cat-top">
                            <span class="practice-cat-name">${icon} ${escapeHtml(cat.category)}</span>
                            <span class="practice-cat-badge">${cat.mastered}/${cat.total} (${cat.percent}%)</span>
                        </div>
                        <div class="practice-mini-bar">
                            <div class="practice-mini-fill" style="width: ${cat.percent}%;"></div>
                        </div>
                        <div class="practice-cat-actions">
                            <select id="select-subcat-${escapeHtml(cat.category.replace(/[^a-zA-Z0-9]/g, ''))}" class="practice-subcat-select">
                                <option value="all">Toată categoria (${cat.total} întrebări)</option>
                                ${subcatOptions}
                            </select>
                            <button class="practice-start-btn" onclick="startPracticeFromSelect('${escapeHtml(cat.category)}')">
                                ▶ Exersează
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (e) {
        console.error('Error loading practice coverage:', e);
    }
}
window.loadPracticeCoverage = loadPracticeCoverage;

function startPracticeFromSelect(category) {
    const safeId = category.replace(/[^a-zA-Z0-9]/g, '');
    const select = document.getElementById(`select-subcat-${safeId}`);
    const subcategory = select ? select.value : 'all';
    startPracticeSession(category, subcategory);
}
window.startPracticeFromSelect = startPracticeFromSelect;

async function startPracticeSession(category, subcategory = 'all') {
    if (state.hasCompletedInitial === false) {
        showToast('Trebuie să susții testul de evaluare inițială mai întâi!', true);
        return;
    }
    const user = state.studentUsername || localStorage.getItem('active_student_username');
    const token = localStorage.getItem('active_student_token') || '';
    if (!user) {
        showToast('Te rugăm să te autentifici din nou.', true);
        return;
    }

    showToast('Se pregătește sesiunea de exercițiu...');

    try {
        let url = `/.netlify/functions/manage-practice?action=get_session_questions&category=${encodeURIComponent(category)}&student_username=${encodeURIComponent(user)}`;
        if (subcategory && subcategory !== 'all') {
            url += `&subcategory=${encodeURIComponent(subcategory)}`;
        }

        const res = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (res.status === 403) {
            showToast('Abonamentul tău a expirat. Contactează profesorul!', true);
            return;
        }

        if (!res.ok) throw new Error('Nu s-au putut încărca întrebările.');
        const data = await res.json();

        if (!data.questions || data.questions.length === 0) {
            showToast('Nu există întrebări disponibile în această categorie.', true);
            return;
        }

        practiceState.category = category;
        practiceState.subcategory = subcategory;
        practiceState.queue = [...data.questions];
        practiceState.firstAttemptSet = new Set(data.questions.map(q => q.id));
        practiceState.masteredInSession = new Set();
        practiceState.correctQuestionsInSession = new Set();
        practiceState.wrongAnswersInSession = new Map();
        practiceState.currentSelectedIndex = null;
        practiceState.totalOriginal = data.questions.length;
        practiceState.solvedCount = 0;
        practiceState.earnedXp = 0;

        if (data.all_mastered) {
            showToast('🎉 Ai rezolvat deja toate întrebările din această categorie din prima încercare! Începi o sesiune de recapitulare.');
        }

        showScreen('practice');
        renderPracticeQuestion();

    } catch (e) {
        console.error('startPracticeSession error', e);
        showToast(e.message || 'Eroare la pornirea sesiunii.', true);
    }
}
window.startPracticeSession = startPracticeSession;

function renderPracticeQuestion() {
    if (practiceState.queue.length === 0) {
        finishPracticeSession();
        return;
    }

    const q = practiceState.queue[0];
    practiceState.currentSelectedIndex = null;

    document.getElementById('practice-badge-topic').textContent = q.category;
    document.getElementById('practice-badge-subcat').textContent = q.subcategory || 'General';
    document.getElementById('practice-badge-queue').textContent = `Coadă: ${practiceState.queue.length}`;
    document.getElementById('practice-progress-text').textContent = `Rezolvate: ${practiceState.solvedCount}`;

    const diffMap = {
        easy: { text: 'Ușoară', class: 'badge-easy' },
        medium: { text: 'Medie', class: 'badge-medium' },
        hard: { text: 'Grea', class: 'badge-hard' }
    };
    const diff = diffMap[q.difficulty] || { text: 'Medie', class: 'badge-medium' };
    const diffEl = document.getElementById('practice-badge-difficulty');
    if (diffEl) {
        diffEl.textContent = diff.text;
        diffEl.className = 'badge ' + diff.class;
    }

    document.getElementById('practice-question-number').textContent = String(practiceState.solvedCount + 1).padStart(2, '0');

    // Progress Bar
    const progPercent = practiceState.totalOriginal > 0 ? Math.min(100, Math.round((practiceState.solvedCount / practiceState.totalOriginal) * 100)) : 0;
    const progBar = document.getElementById('practice-progress-bar');
    if (progBar) progBar.style.width = `${progPercent}%`;

    // Question content
    document.getElementById('practice-question-text').textContent = cleanSymbols(q.text);

    // Images
    const qImages = parseImageUrls(q.image_url);
    const imgContainer = document.getElementById('practice-images-container');
    if (imgContainer) {
        if (qImages.length > 0) {
            imgContainer.style.display = 'flex';
            imgContainer.innerHTML = qImages.map((url, i) => `
                <img src="${url}" class="question-img-item" alt="Imagine întrebare ${i + 1}" onclick="openLightbox('${url}')">
            `).join('');
        } else {
            imgContainer.style.display = 'none';
            imgContainer.innerHTML = '';
        }
    }

    // Code
    const codeWrapper = document.getElementById('practice-code-wrapper');
    const codeContent = document.getElementById('practice-code-content');
    if (q.code) {
        codeWrapper.style.display = 'block';
        const cleanCode = cleanSymbols(q.code);
        const codeHtml = escapeHtml(cleanCode).replace(
            /_{4,}/g,
            '<span class="code-blank">????????</span>'
        );
        codeContent.innerHTML = `<pre class="language-cpp" style="background:transparent; margin:0; padding:0;"><code class="language-cpp">${codeHtml}</code></pre>`;
        if (window.Prism) {
            setTimeout(() => {
                const codeEl = codeContent.querySelector('code');
                if (codeEl) Prism.highlightElement(codeEl);
            }, 0);
        }
    } else {
        codeWrapper.style.display = 'none';
    }

    // Options
    const optionsContainer = document.getElementById('practice-options-container');
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const isCodeOption = q.type === 'code' ? ' code-option' : '';
    optionsContainer.innerHTML = (q.options || []).map((opt, idx) => `
        <div class="option-card practice-option" data-index="${idx}" onclick="selectPracticeOption(${idx})" role="button" tabindex="0" aria-label="Opțiunea ${letters[idx]}">
            <div class="option-letter">${letters[idx]}</div>
            <div class="option-text${isCodeOption}">${escapeHtml(opt)}</div>
        </div>
    `).join('');

    // Reset feedback
    document.getElementById('practice-feedback-box').style.display = 'none';
    document.getElementById('practice-reappear-notice').style.display = 'none';
    document.getElementById('practice-hint-auto').style.display = 'none';

    // Reset Buttons
    const btnCheck = document.getElementById('btn-practice-check');
    const btnNext = document.getElementById('btn-practice-next');
    btnCheck.style.display = 'inline-flex';
    btnCheck.disabled = true;
    btnNext.style.display = 'none';
}

function selectPracticeOption(idx) {
    if (document.getElementById('btn-practice-next').style.display === 'inline-flex') return;

    practiceState.currentSelectedIndex = idx;
    const cards = document.querySelectorAll('.practice-option');
    cards.forEach(c => {
        const optIdx = parseInt(c.dataset.index);
        if (optIdx === idx) {
            c.classList.add('selected');
        } else {
            c.classList.remove('selected');
        }
    });

    const btnCheck = document.getElementById('btn-practice-check');
    if (btnCheck) btnCheck.disabled = false;
}
window.selectPracticeOption = selectPracticeOption;

async function checkPracticeAnswer() {
    if (practiceState.currentSelectedIndex === null || practiceState.queue.length === 0) return;

    const btnCheck = document.getElementById('btn-practice-check');
    const btnNext = document.getElementById('btn-practice-next');
    btnCheck.disabled = true;

    const q = practiceState.queue[0];
    const selectedIdx = practiceState.currentSelectedIndex;
    const isFirstAttempt = practiceState.firstAttemptSet.has(q.id);

    try {
        const user = state.studentUsername || localStorage.getItem('active_student_username');
        const token = localStorage.getItem('active_student_token') || '';

        const res = await fetch('/.netlify/functions/manage-practice', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': token ? 'Bearer ' + token : ''
            },
            body: JSON.stringify({
                action: 'check_answer',
                question_id: q.id,
                selected_index: selectedIdx,
                student_username: user
            })
        });
        if (!res.ok) throw new Error('Eroare la verificare.');
        const result = await res.json();

        // Highlight options
        const cards = document.querySelectorAll('.practice-option');
        cards.forEach(c => {
            c.classList.remove('selected');
            const optIdx = parseInt(c.dataset.index);
            c.style.pointerEvents = 'none';
            if (optIdx === result.correct_index) {
                c.classList.add('correct-instant');
            }
            if (optIdx === selectedIdx && !result.is_correct) {
                c.classList.add('wrong-instant');
            }
        });

        const feedbackBox = document.getElementById('practice-feedback-box');
        const reappearNotice = document.getElementById('practice-reappear-notice');
        const hintBox = document.getElementById('practice-hint-auto');
        const hintText = document.getElementById('practice-hint-text');

        feedbackBox.style.display = 'block';

        if (result.is_correct) {
            reappearNotice.style.display = 'none';
            if (isFirstAttempt) {
                practiceState.masteredInSession.add(q.id);
            }
            if (!practiceState.correctQuestionsInSession.has(q.id)) {
                practiceState.correctQuestionsInSession.add(q.id);
                practiceState.earnedXp += 10;
            }
            practiceState.solvedCount++;
        } else {
            reappearNotice.style.display = 'flex';
            practiceState.firstAttemptSet.delete(q.id);
            if (!practiceState.wrongAnswersInSession) practiceState.wrongAnswersInSession = new Map();
            practiceState.wrongAnswersInSession.set(q.id, selectedIdx);
        }

        if (result.hint && result.hint.trim() !== '') {
            hintText.textContent = result.hint.trim();
            hintBox.style.display = 'block';
        } else {
            hintBox.style.display = 'none';
        }

        btnCheck.style.display = 'none';
        btnNext.style.display = 'inline-flex';

    } catch (e) {
        console.error('checkPracticeAnswer error', e);
        showToast('Eroare la verificarea răspunsului.', true);
        btnCheck.disabled = false;
    }
}
window.checkPracticeAnswer = checkPracticeAnswer;

function nextPracticeQuestion() {
    if (practiceState.queue.length === 0) {
        finishPracticeSession();
        return;
    }

    const lastCheckWrong = document.getElementById('practice-reappear-notice').style.display === 'flex';
    
    if (lastCheckWrong) {
        const failedQ = practiceState.queue.shift();
        practiceState.queue.push(failedQ);
    } else {
        practiceState.queue.shift();
    }

    renderPracticeQuestion();
}
window.nextPracticeQuestion = nextPracticeQuestion;

async function finishPracticeSession() {
    const user = state.studentUsername || localStorage.getItem('active_student_username');
    const token = localStorage.getItem('active_student_token') || '';
    const xpToSync = practiceState.earnedXp || (practiceState.masteredInSession.size * 10);
    const wrongArr = practiceState.wrongAnswersInSession ? 
        Array.from(practiceState.wrongAnswersInSession.entries()).map(([qId, sIdx]) => ({
            id: qId,
            studentAnswer: sIdx
        })) : [];

    if ((practiceState.masteredInSession.size > 0 || xpToSync > 0 || wrongArr.length > 0) && user) {
        try {
            const syncRes = await fetch('/.netlify/functions/manage-practice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    action: 'sync_coverage',
                    student_username: user,
                    newly_mastered_ids: Array.from(practiceState.masteredInSession),
                    wrong_answers: wrongArr,
                    earned_xp: xpToSync
                })
            });
            if (syncRes.ok) {
                const syncData = await syncRes.json();
                if (syncData.newTotalXp !== undefined) {
                    const elXp = document.getElementById('dash-xp');
                    if (elXp) elXp.textContent = `${syncData.newTotalXp} XP`;
                }
                if (syncData.newStreak !== undefined) {
                    const elStreak = document.getElementById('dash-streak');
                    if (elStreak) elStreak.textContent = syncData.newStreak;
                }
            }
        } catch (e) {
            console.error('Error syncing coverage:', e);
        }
    }

    showScreen('results');
    const resultsContainer = document.getElementById('results-container');
    const firstTryCount = practiceState.masteredInSession.size;
    const totalCount = practiceState.totalOriginal;

    resultsContainer.innerHTML = `
        <div class="results-header">
            <div class="results-icon">🎉</div>
            <h2>Sesiune de Exercițiu Finalizată!</h2>
            <p class="results-name">${escapeHtml(practiceState.category)} ${practiceState.subcategory !== 'all' ? '• ' + escapeHtml(practiceState.subcategory) : ''}</p>
        </div>

        <div class="score-display">
            <div class="score-value">
                <span class="score-number">${firstTryCount}</span>
                <span class="score-max">/${totalCount}</span>
            </div>
            <div class="score-percent">Rezolvate corect din prima încercare</div>
            ${xpToSync > 0 ? `
                <div style="margin-top: 12px;">
                    <span style="display: inline-flex; align-items: center; gap: 6px; background: rgba(251, 191, 36, 0.12); border: 1px solid rgba(251, 191, 36, 0.35); color: #fbbf24; font-weight: 800; font-size: 16px; padding: 6px 16px; border-radius: 20px;">
                        ⚡ +${xpToSync} XP Câștigați!
                    </span>
                </div>` : ''}
        </div>

        <div style="background: rgba(124, 106, 255, 0.1); border: 1px solid var(--accent-purple); border-radius: var(--radius-md); padding: 18px 24px; margin: 24px 0; text-align: center;">
            <p style="font-size: 14px; color: var(--text-primary); margin-bottom: 6px;">
                ✨ Ai parcurs toate întrebările sesiunii și ai consolidat noțiunile greșite!
            </p>
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">
                Progresul tău de acoperire a materiei și punctele XP au fost salvate în cont.
            </p>
        </div>

        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
            <button class="btn btn-secondary" onclick="showDashboard()" style="padding: 12px 24px; font-size: 14px;">
                🏠 Înapoi la Dashboard
            </button>
            <button class="btn btn-primary" onclick="startPracticeSession('${escapeHtml(practiceState.category)}', '${escapeHtml(practiceState.subcategory)}')" style="padding: 12px 24px; font-size: 14px;">
                🔄 Repetă Sesiunea
            </button>
        </div>
    `;

    loadPracticeCoverage(user);
}
window.finishPracticeSession = finishPracticeSession;

async function exitPracticeSession() {
    const user = state.studentUsername || localStorage.getItem('active_student_username');
    const token = localStorage.getItem('active_student_token') || '';
    const xpToSync = practiceState.earnedXp || (practiceState.masteredInSession.size * 10);
    const wrongArr = practiceState.wrongAnswersInSession ? 
        Array.from(practiceState.wrongAnswersInSession.entries()).map(([qId, sIdx]) => ({
            id: qId,
            studentAnswer: sIdx
        })) : [];

    // Sync any newly mastered questions, wrong answers and earned XP in the background
    if ((practiceState.masteredInSession.size > 0 || xpToSync > 0 || wrongArr.length > 0) && user) {
        try {
            const syncRes = await fetch('/.netlify/functions/manage-practice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    action: 'sync_coverage',
                    student_username: user,
                    newly_mastered_ids: Array.from(practiceState.masteredInSession),
                    wrong_answers: wrongArr,
                    earned_xp: xpToSync
                })
            });
            if (syncRes.ok) {
                const syncData = await syncRes.json();
                if (syncData.newTotalXp !== undefined) {
                    const elXp = document.getElementById('dash-xp');
                    if (elXp) elXp.textContent = `${syncData.newTotalXp} XP`;
                }
                if (syncData.newStreak !== undefined) {
                    const elStreak = document.getElementById('dash-streak');
                    if (elStreak) elStreak.textContent = syncData.newStreak;
                }
            }
        } catch (e) {
            console.error('Error syncing coverage on exit:', e);
        }
    }

    showDashboard();
    loadPracticeCoverage(user);
}
window.exitPracticeSession = exitPracticeSession;

// Dynamic Mouse-Following Gradient Border Glow
function initDynamicBorderGlow() {
    document.addEventListener('mousemove', (e) => {
        const cards = document.querySelectorAll('.glow-card, .dash-cat-btn, .practice-cat-item, .stat-card, .glass-card, .welcome-container');
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            if (e.clientX >= rect.left - 60 && e.clientX <= rect.right + 60 &&
                e.clientY >= rect.top - 60 && e.clientY <= rect.bottom + 60) {
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            }
        });
    });
}

// Initialize App
initApp();
initDynamicBorderGlow();
setTimeout(() => {
    if (els.studentUsername) els.studentUsername.focus();
}, 500);

/* ========================================================================
   PWA INSTALLATION LOGIC
   ======================================================================== */
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
});

window.installPWA = function() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
            const installBtn = document.getElementById('btn-install-pwa');
            if (installBtn) {
                installBtn.style.display = 'none';
            }
        });
    } else {
        showToast('Meniul automat nu s-a putut deschide. Caută opțiunea "Adaugă pe ecran" / "Install" în meniul browserului tău (sus-dreapta).', 6000);
    }
};