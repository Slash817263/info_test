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

    if (idx === questions.length - 1) {
        els.btnNextText.textContent = 'Finalizează Testul';
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

async function submitResult(timeTakenMs) {
    const questionIds = questions.map(q => q.id);
    const payload = {
        student_username: state.studentUsername,
        student_id: state.studentId,
        test_type: state.assignedTestId ? 'tema' : state.testType,
        exam_type: state.examType,
        time_taken_ms: state.assignedTestId ? 0 : timeTakenMs,
        blur_count: state.assignedTestId ? 0 : state.blurCount,
        answers_json: state.answers,
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

        // Confetti for score >= 80%
        if (pct >= 0.80 && window.confetti) {
            window.confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        }

        if (state.assignedTestId) {
            els.resultsContainer.innerHTML = `
                        <div class="empty-state">
                            <h2 style="color:var(--accent-green); margin-bottom: 20px;">Ai finalizat tema!</h2>
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

function shareEmail() {
    const subject = encodeURIComponent(`Rezultate Test C++ — ${state.studentUsername}`);
    const body = encodeURIComponent(getResultsText());
    const email = CONFIG.tutorEmail;
    const mailtoUrl = email ? `mailto:${email}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;
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

        const res = await fetch(`/.netlify/functions/fetch-questions?ids=${questionsIds.join(',')}`);
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
        const res = await fetch(`/.netlify/functions/fetch-questions?type=${type}&username=${encodeURIComponent(username)}&examType=${encodeURIComponent(examType)}`);
        if (!res.ok) throw new Error();
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
            state.studentUsername = username;
            state.studentId = studentId;
            document.getElementById('dash-username').textContent = username;

            const history = resultsData.history || [];
            const hasCompletedInitial = (resultsData.hasCompletedInitial !== undefined)
                ? !!resultsData.hasCompletedInitial
                : history.some(h => {
                    if (!h || !h.test_type) return true;
                    const t = h.test_type.toLowerCase().trim();
                    return t === 'initial' || t.startsWith('initial') || (!t.startsWith('intermediar') && !t.startsWith('tema') && !t.startsWith('progress_'));
                });

            const initialSection = document.getElementById('dash-initial-section');
            const categoriesContainer = document.getElementById('dash-categories-container');
            const dashSubtitle = document.getElementById('dash-subtitle');

            if (!hasCompletedInitial) {
                if (initialSection) initialSection.style.display = 'block';
                if (categoriesContainer) categoriesContainer.style.display = 'none';
                if (dashSubtitle) dashSubtitle.textContent = 'Pentru a începe, susține testul de evaluare inițială:';
            } else {
                if (initialSection) initialSection.style.display = 'none';
                if (categoriesContainer) categoriesContainer.style.display = 'grid';
                if (dashSubtitle) dashSubtitle.textContent = 'Ai finalizat testul introductiv. Alege tipul de test intermediar pe care vrei să-l susții:';
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

            // Fetch assigned tests
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
        input.value = '';
        setTimeout(() => input.focus(), 50);
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

async function handlePhoneSubmit() {
    const input = document.getElementById('phone-input');
    const btnSubmit = document.getElementById('btn-submit-phone');
    const modal = document.getElementById('modal-phone');
    if (!input || !modal) return;

    const phone = input.value.trim();
    const phoneRegex = /^07\d{8}$/;
    if (!phoneRegex.test(phone)) {
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
        const res = await fetch('/.netlify/functions/update-phone', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                student_id: state.studentId || localStorage.getItem('active_student_id'),
                username: state.studentUsername || localStorage.getItem('active_student_username'),
                phone_number: phone
            })
        });

        if (res.ok) {
            showToast('Numărul de WhatsApp a fost salvat cu succes!');
            modal.style.display = 'none';
        } else {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.error || 'Eroare la salvarea numărului de telefon.', true);
        }
    } catch (err) {
        showToast('Eroare de conexiune la salvarea numărului.', true);
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
        }
    }
}

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
            await loadDashboard(username, data.student.id);
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

    if (state.assignedTestId) {
        // STRICT LA TESTELE ASIGNATE: fara afisare timp, fara logica expirare, fara abateri focus
        if (timerBadge) timerBadge.style.display = 'none';
        if (anticheatBadge) anticheatBadge.style.display = 'none';
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

    // Nu stergem state-ul inca pentru a preveni pierderea datelor daca pica netul/inchide tab-ul prematur

    if (autoSubmitted) {
        els.btnNext.disabled = true;
        els.btnPrev.disabled = true;
        const cards = els.optionsContainer.querySelectorAll('.option-card');
        cards.forEach(c => c.style.pointerEvents = 'none');
    }

    const elapsed = state.endTime - state.startTime;

    showScreen('results');
    els.resultsContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Se evaluează testul pe server...</p></div>';

    await submitResult(elapsed);
    clearStateFromStorage(); // Acum stergem starea locala, dupa ce testul a fost trimis
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

/* ========================================================================
   FORM VALIDATION
   ======================================================================== */
function validateWelcomeForm() {
    const userOk = els.studentUsername.value.trim().length > 0;
    const passOk = els.studentPassword.value.trim().length > 0;
    els.btnContinue.disabled = !userOk || !passOk || !questionsLoaded;
}

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
    if (!els.screenQuiz.classList.contains('active')) return;

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
});

// Exit test button
const btnExit = $('#btn-exit');
const modalExit = $('#modal-exit');
const btnCancelExit = $('#btn-cancel-exit');
const btnConfirmExit = $('#btn-confirm-exit');

if (btnExit && modalExit && btnCancelExit && btnConfirmExit) {
    btnExit.addEventListener('click', () => {
        if (state.assignedTestId) {
            // STRICT LA TESTELE ASIGNATE: Ieșire directă fără dialog de avertisment
            restartQuiz();
        } else {
            modalExit.style.display = 'flex';
        }
    });
    btnCancelExit.addEventListener('click', () => { modalExit.style.display = 'none'; });
    btnConfirmExit.addEventListener('click', () => { modalExit.style.display = 'none'; restartQuiz(); });
    modalExit.addEventListener('click', (e) => { if (e.target === modalExit) modalExit.style.display = 'none'; });
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
            const res = await fetch(`/.netlify/functions/fetch-questions?ids=${idsParam}`);
            if (res.ok) {
                const fetchedQs = await res.json();
                questions = fetchedQs;
            }

            if (questions.length === 0) {
                // fallback if failed to fetch
                clearStateFromStorage();
                return showScreen('welcome');
            }

            timerDurationMs = (state.examType === 'Initial') ? 30 * 60 * 1000 : 60 * 60 * 1000;

            let maxAllowedTimeMs = timerDurationMs;

            if (!state.assignedTestId && (Date.now() - state.startTime > maxAllowedTimeMs)) {
                showToast('Sesiunea a expirat.');
                clearStateFromStorage();
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
            const activeUser = localStorage.getItem('active_student_username');
            const activeId = localStorage.getItem('active_student_id');
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
function closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (modal) modal.style.display = 'none';
}
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

async function showSituatiaMea() {
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
    } catch (e) {
        console.error(e);
        showToast('Eroare la încărcarea situației.', true);
        if (listHistory) listHistory.innerHTML = '<p style="color:var(--accent-red)">Eroare la încărcare.</p>';
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

    // Render History
    if (!historyTests || historyTests.length === 0) {
        listHistory.innerHTML = '<p style="color: var(--text-muted); font-size: 14px; padding: 20px 0;">Nu ai susținut încă niciun test.</p>';
    } else {
        listHistory.innerHTML = historyTests.map((ht, idx) => {
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
    if (el.style.display === 'none') {
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

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

// ==================== MODAL TELEFON OBLIGATORIU ====================
function showPhoneModal() {
    const modal = document.getElementById('modal-phone');
    if (modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('phone-input');
        if (input) {
            setTimeout(() => input.focus(), 300);
            input.onkeydown = (e) => {
                if (e.key === 'Enter') handlePhoneSubmit();
            };
        }
    }
}

async function handlePhoneSubmit() {
    const input = document.getElementById('phone-input');
    const btn = document.getElementById('btn-submit-phone');
    if (!input || !btn) return;

    const phone = input.value.trim();
    const phoneRegex = /^07\d{8}$/;
    if (!phoneRegex.test(phone)) {
        showToast('Numărul trebuie să înceapă cu 07 și să aibă exact 10 cifre (ex: 0712345678).', true);
        input.focus();
        return;
    }

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Se salvează...';

    try {
        const token = localStorage.getItem('active_student_token') || '';
        const username = state.studentUsername || localStorage.getItem('active_student_username') || '';
        const studentId = state.studentId || localStorage.getItem('active_student_id') || '';

        const res = await fetch('/.netlify/functions/update-phone', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                student_id: studentId,
                username: username,
                phone_number: phone
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast('Număr de telefon salvat cu succes!');
            const modal = document.getElementById('modal-phone');
            if (modal) modal.style.display = 'none';
        } else {
            showToast(data.error || 'Eroare la salvarea numărului de telefon.', true);
        }
    } catch (e) {
        showToast('Eroare de conexiune cu serverul.', true);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

const btnSubmitPhone = document.getElementById('btn-submit-phone');
if (btnSubmitPhone) {
    btnSubmitPhone.addEventListener('click', handlePhoneSubmit);
}

// Initialize App
initApp();
setTimeout(() => {
    if (els.studentUsername) els.studentUsername.focus();
}, 500);