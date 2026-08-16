/* ========================================================================
           CONFIGURATION
           ======================================================================== */
const CONFIG = {
    tutorPhone: '',
    tutorEmail: '',
    timerInitial: 20 * 60 * 1000,      // 20 minutes for "Șocul Realității"
    timerIntermediar: 30 * 60 * 1000,   // 30 minutes for intermediate tests
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
    questionImage: $('#question-image'),
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
        q.displayOrder = [0, 1, 2, 3];
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

    // Image (click to zoom)
    if (q.image_url) {
        els.questionImage.src = q.image_url;
        els.questionImage.style.display = 'block';
        els.questionImage.style.cursor = 'zoom-in';
        els.questionImage.onclick = () => openLightbox(q.image_url);
    } else {
        els.questionImage.removeAttribute('src');
        els.questionImage.style.display = 'none';
        els.questionImage.onclick = null;
        els.questionImage.style.cursor = 'default';
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

    // Options
    const letters = ['A', 'B', 'C', 'D'];
    let optionsHtml = '';
    q.displayOrder.forEach((originalIndex, displayIndex) => {
        const opt = q.options[originalIndex];
        const selectedClass = state.answers[idx] === originalIndex ? 'selected' : '';
        const isCodeOption = q.type === 'code' ? ' code-option' : '';
        optionsHtml += `
                <div class="option-card ${selectedClass}" data-index="${originalIndex}" role="button" tabindex="0" aria-label="Opțiunea ${letters[displayIndex]}">
                    <div class="option-letter">${letters[displayIndex]}</div>
                    <div class="option-text${isCodeOption}">${escapeHtml(opt)}</div>
                </div>`;
    });
    els.optionsContainer.innerHTML = optionsHtml;

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
    } catch (e) {
        console.error('Failed to save state to localStorage', e);
    }
}

function clearStateFromStorage() {
    try {
        ['quiz_current_question', 'quiz_answers', 'quiz_start_time', 'quiz_student_username',
            'quiz_student_id', 'quiz_test_type', 'quiz_exam_type', 'quiz_blur_count', 'quiz_question_timings',
            'quiz_questions_ids', 'quiz_assigned_test_id'].forEach(k => localStorage.removeItem(k));
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
            if (isInitial) {
                const overtimeLimit = -10 * 60 * 1000; // -10 minutes
                if (remaining <= overtimeLimit) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    countdownEl.textContent = '-10:00';
                    timerBadge.classList.add('warning');
                    autoSubmitQuiz();
                    return;
                } else {
                    // Display overtime (negative timer)
                    const overTimeSecs = Math.floor((-remaining) / 1000);
                    const minutes = Math.floor(overTimeSecs / 60);
                    const seconds = overTimeSecs % 60;
                    countdownEl.textContent = `-${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    timerBadge.classList.add('warning');
                    timerBadge.style.color = 'var(--accent-red)';
                    return; // skip the positive timer rendering below
                }
            } else {
                // For non-initial tests, strictly end at 0
                clearInterval(timerInterval);
                timerInterval = null;
                countdownEl.textContent = '00:00';
                timerBadge.classList.add('warning');
                autoSubmitQuiz();
                return;
            }
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
    try {
        const questionIds = questions.map(q => q.id);

        const response = await fetch('/.netlify/functions/save-result', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (localStorage.getItem('active_student_token') || '')
            },
            body: JSON.stringify({
                student_username: state.studentUsername,
                student_id: state.studentId,
                test_type: state.assignedTestId ? 'tema' : state.testType,
                exam_type: state.examType,
                time_taken_ms: state.assignedTestId ? 0 : timeTakenMs,
                blur_count: state.assignedTestId ? 0 : state.blurCount,
                answers_json: state.answers,
                question_ids: questionIds,
                assigned_test_id: state.assignedTestId
            })
        });

        if (!response.ok) {
            console.error('Server error saving results');
            els.resultsContainer.innerHTML = '<div class="empty-state"><p style="color:var(--accent-red);">Eroare la salvarea rezultatelor pe server.</p></div>';
            return;
        }

        const data = await response.json();

        const results = {
            totalCorrect: data.evaluatedDetails.filter(d => d.isCorrect).length,
            totalPoints: data.score,
            maxPoints: data.totalPoints,
            easyCorrect: data.stats.easy.c, easyTotal: data.stats.easy.t,
            mediumCorrect: data.stats.medium.c, mediumTotal: data.stats.medium.t,
            hardCorrect: data.stats.hard.c, hardTotal: data.stats.hard.t,
            details: data.evaluatedDetails
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
        els.resultsContainer.innerHTML = '<div class="empty-state"><p style="color:var(--accent-red);">Eroare de rețea. Nu s-a putut conecta la server.</p></div>';
    }
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
                <h3>Detalii întrebări</h3>
                <div class="review-list">
                    ${results.details.map(d => {
        const diffClass = `review-diff-${d.difficulty}`;
        const correctClass = d.isCorrect ? 'review-correct' : 'review-wrong';
        const icon = d.isCorrect ? '✓' : '✗';
        const studentOptText = d.studentAnswer !== null ? (d.options[d.studentAnswer] || '—') : '—';
        const correctOptText = d.options[d.correctAnswer] || '—';
        const detail = d.isCorrect
            ? `Răspuns corect: ${escapeHtml(correctOptText)}`
            : `Tu: ${escapeHtml(studentOptText)} <br> Corect: ${escapeHtml(correctOptText)}`;
        return `
                            <div class="review-item ${correctClass}">
                                <span class="review-num">${d.number}</span>
                                <span class="review-diff ${diffClass}"></span>
                                <span class="review-text">${escapeHtml(d.text.replace(/\\n/g, '\n'))}</span>
                                <span class="review-icon">${icon}</span>
                                <div class="review-answer-detail">
                                    <strong>${detail}</strong>
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

window.startTest = function (type, examType) {
    selectTestType(type, state.studentUsername, examType);
};

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
            const hasCompletedInitial = history.some(h => h.test_type === 'initial');

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
                                                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Până la: ${new Date(pt.deadline).toLocaleString('ro-RO')}</div>
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

function logoutStudent() {
    localStorage.removeItem('active_student_username');
    localStorage.removeItem('active_student_id');
    localStorage.removeItem('active_student_token');
    state.studentUsername = '';
    state.studentId = null;
    showScreen('welcome');
}

async function handleLogin() {
    const username = els.studentUsername.value.trim();
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
        state.startTime = state.startTime || Date.now();
        state.endTime = null;
        state.blurCount = 0;
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

    if (e.key >= '1' && e.key <= '4') {
        const pressedIndex = parseInt(e.key) - 1;
        const q = questions[state.currentQuestion];
        if (q && q.displayOrder) {
            selectAnswer(q.displayOrder[pressedIndex]);
        } else {
            selectAnswer(pressedIndex);
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

function renderSituatiaStudent(historyTests) {
    const listHistory = document.getElementById('list-situatia-history');
    if (!listHistory) return;

    // Render History
    if (!historyTests || historyTests.length === 0) {
        listHistory.innerHTML = '<p style="color: var(--text-muted); font-size: 14px; padding: 20px 0;">Nu ai susținut încă niciun test.</p>';
    } else {
        listHistory.innerHTML = historyTests.map((ht, idx) => {
            const pct = Math.round((ht.score / ht.total_points) * 100) || 0;
            const isAssigned = ht.assigned_test_id || ht.test_type === 'tema';
            const isInitial = ht.test_type === 'initial';
            let testTitle = `Test Intermediar (${ht.exam_type || 'General'})`;
            if (isAssigned) {
                testTitle = `Temă (${ht.exam_type || 'BAC'})`;
            } else if (isInitial) {
                testTitle = `Test Inițial`;
            }
            const timeInfo = isAssigned ? '' : ` | Timp: ${formatTime(ht.time_taken_ms)}`;

            return `
                        <div class="option-card" style="margin-bottom: 12px; display:block; padding: 16px;" onclick="toggleHistoryDetails('history-details-${ht.id}')">
                            <div style="display:flex; justify-content:space-between; align-items:center; cursor: pointer;">
                                <div>
                                    <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${testTitle} - ${ht.score}/${ht.total_points} puncte</div>
                                    <div style="font-size: 13px; color: var(--text-secondary);">Data: ${new Date(ht.created_at).toLocaleString('ro-RO')}${timeInfo}</div>
                                </div>
                                <div style="font-weight: 700; color: var(--accent-purple); font-size: 18px;">${pct}%</div>
                            </div>
                            <div id="history-details-${ht.id}" style="display:none; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
                                ${generateHistoryDetailsHTML(ht.details_json)}
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

function generateHistoryDetailsHTML(details) {
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
        const imageHtml = d.image_url ? `<img src="${d.image_url}" style="margin: 10px 0; max-height: 150px; border-radius: 8px;">` : '';

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
                    </div>
                `;
    }).join('');
}

// Initialize App
initApp();
setTimeout(() => els.studentUsername.focus(), 500);