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
  // All 50 questions from DB
        let questions = [];     // Active quiz questions (50 or 30 subset)

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
            } catch (e) {
                console.error('Failed to save state to localStorage', e);
            }
        }

        function clearStateFromStorage() {
            try {
                 ['quiz_current_question', 'quiz_answers', 'quiz_start_time', 'quiz_student_username',
                 'quiz_student_id', 'quiz_test_type', 'quiz_exam_type', 'quiz_blur_count', 'quiz_question_timings',
                 'quiz_questions_ids'].forEach(k => localStorage.removeItem(k));
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        student_username: state.studentUsername,
                        student_id: state.studentId,
                        test_type: state.testType,
                        exam_type: state.examType,
                        time_taken_ms: timeTakenMs,
                        blur_count: state.blurCount,
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
                
                window.lastResults = results;
                renderResults(results);
                
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
            renderQuestion();
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
                renderQuestion();
            }
        }

        function goPrev() {
            if (state.currentQuestion > 0) {
                state.currentQuestion--;
                saveStateToStorage();
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
                            <div class="review-item ${correctClass}" onclick="this.classList.toggle('expanded')">
                                <span class="review-num">${d.number}</span>
                                <span class="review-diff ${diffClass}"></span>
                                <span class="review-text">${escapeHtml(d.text.replace(/\\n/g, '\n'))}</span>
                                <span class="review-icon">${icon}</span>
                                <div class="review-answer-detail">
                                    <strong>${detail}</strong><br>
                                    ${escapeHtml(d.explanation || '')}
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            </div>

            <div class="share-section">
                <h3>Trimite rezultatele</h3>
                <div class="share-buttons">
                    <button class="btn btn-whatsapp" onclick="shareWhatsApp()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                    </button>
                    <button class="btn btn-copy" onclick="copyResults()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        Copiază
                    </button>
                    <button class="btn btn-email" onclick="shareEmail()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>
                        Email
                    </button>
                </div>
            </div>

            <button class="btn btn-ghost btn-restart" onclick="restartQuiz()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Reia Testul
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
            const results = window.lastResults;
            const elapsed = state.endTime - state.startTime;
            const timeStr = formatTime(elapsed);
            const percent = Math.round((results.totalPoints / results.maxPoints) * 100);
            const date = new Date().toLocaleDateString('ro-RO');
            const testLabel = `Test ${state.examType} (${questions.length} întrebări)`;

            return `📋 Test Introductiv Informatică C++
━━━━━━━━━━━━━━━━━━━━━━━
👤 Elev: ${state.studentUsername}
📄 Tip: ${testLabel}
📊 Scor: ${results.totalPoints}/${results.maxPoints} puncte (${percent}%)
🏆 Nivel: ${results.level.name}
━━━━━━━━━━━━━━━━━━━━━━━
✅ Ușoare: ${results.easyCorrect}/${results.easyTotal} corecte
✅ Medii: ${results.mediumCorrect}/${results.mediumTotal} corecte
✅ Grele: ${results.hardCorrect}/${results.hardTotal} corecte
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Timp: ${timeStr}
📅 Data: ${date}`;
        }

        function shareWhatsApp() {
            const text = encodeURIComponent(getResultsText());
            const phone = CONFIG.tutorPhone;
            const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
            window.open(url, '_blank');
        }

        function copyResults() {
            const text = getResultsText();
            navigator.clipboard.writeText(text).then(() => {
                showToast('✓ Rezultatele au fost copiate!');
            }).catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                try { document.execCommand('copy'); showToast('✓ Rezultatele au fost copiate!'); }
                catch (e) { showToast('Nu s-a putut copia. Încearcă din nou.'); }
                document.body.removeChild(textarea);
            });
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


        window.startTest = function(type, examType) {
            selectTestType(type, state.studentUsername, examType);
        };

        window.startAssignedTest = async function(assignedTestId, examType, questionsIds) {
            state.testType = 'intermediar';
            state.examType = examType;
            state.assignedTestId = assignedTestId;

            const btns = document.querySelectorAll('#screen-dashboard .btn, #screen-situatie .btn');
            btns.forEach(b => { b.disabled = true; b.style.opacity = '0.7'; });

            try {
                const res = await fetch(`/.netlify/functions/fetch-questions?ids=${questionsIds.join(',')}`);
                if (!res.ok) throw new Error();
                const fetchedQs = await res.json();

                if (fetchedQs.length === 0) {
                    showToast('Eroare: Întrebările nu mai sunt disponibile.');
                    btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
                    return;
                }

                questions = fetchedQs;
                // Assigned tests use the normal intermediate rules (60 min)
                timerDurationMs = 60 * 60 * 1000;
                
                localStorage.setItem('quiz_questions_ids', JSON.stringify(questions.map(q => q.id)));
                startQuiz();
            } catch(e) {
                showToast('Eroare la pornirea testului asignat.');
                btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
            }
        };

        async function selectTestType(type, username, examType = 'Initial') {
            state.testType = type;
            state.examType = examType;
            
            if (type === 'initial') {
                els.btnContinue.innerHTML = '<span>Se pregătesc întrebările...</span>';
            } else {
                const btns = document.querySelectorAll('#screen-dashboard .btn');
                btns.forEach(b => { b.disabled = true; b.style.opacity = '0.7'; });
            }
            
            try {
                const res = await fetch(`/.netlify/functions/fetch-questions?type=${type}&username=${encodeURIComponent(username)}&examType=${encodeURIComponent(examType)}`);
                if (!res.ok) throw new Error();
                const fetchedQs = await res.json();
                
                if (fetchedQs.length === 0) {
                    showToast(`Nu există întrebări pentru categoria ${examType}.`);
                    if (type === 'initial') {
                        els.btnContinue.innerHTML = '<span>Continuă</span>';
                        els.btnContinue.disabled = false;
                    } else {
                        const btns = document.querySelectorAll('#screen-dashboard .btn');
                        btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
                    }
                    return;
                }

                questions = fetchedQs;
                timerDurationMs = (examType === 'Initial') ? 30 * 60 * 1000 : 60 * 60 * 1000;
                
                localStorage.setItem('quiz_questions_ids', JSON.stringify(questions.map(q => q.id)));
                startQuiz();
            } catch(e) {
                showToast('Eroare la încărcarea întrebărilor.');
                if (type === 'initial') {
                    els.btnContinue.innerHTML = '<span>Continuă</span>';
                    els.btnContinue.disabled = false;
                }
            }
        }

        /* ========================================================================
           QUIZ LIFECYCLE
           ======================================================================== */
        async function loadDashboard(username, studentId) {
    try {
        const resultsRes = await fetch('/.netlify/functions/check-user', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: username }) 
        });
        
        const resultsData = await resultsRes.json();
        
        if (resultsData.exists) {
            document.getElementById('dash-username').textContent = username;
            
            const historyEl = document.getElementById('dash-history');
            if (historyEl && resultsData.history && resultsData.history.length > 0) {
                let historyHtml = '<h4 style="font-size:13px; color:var(--text-secondary); margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">Istoricul tău de teste</h4><div style="display:flex; flex-direction:column; gap:8px;">';
                resultsData.history.forEach(h => {
                    const scorePct = h.score !== undefined && h.total_points ? Math.round((h.score / h.total_points) * 100) : 0;
                    const dateStr = h.created_at ? new Date(h.created_at).toLocaleDateString('ro-RO', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
                    historyHtml += `
                        <div style="background:rgba(15,15,40,0.6); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div style="font-weight:600; font-size:13px; color:var(--text-primary);">${h.test_type === 'initial' ? 'Test Inițial' : 'Test Intermediar'}</div>
                                <div style="font-size:11px; color:var(--text-muted);">${dateStr}</div>
                            </div>
                            <div style="font-weight:700; font-size:14px; color:${scorePct >= 80 ? 'var(--accent-green)' : (scorePct >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)')};">
                                ${scorePct}%
                            </div>
                        </div>
                    `;
                });
                historyHtml += '</div>';
                historyEl.innerHTML = historyHtml;
            }
            
            try {
                const countRes = await fetch('/.netlify/functions/fetch-questions?type=counts');
                if (countRes.ok) {
                    const counts = await countRes.json();
                    const btnAcademie = document.getElementById('btn-intermediar-admitere');
                    const btnPoli = document.getElementById('btn-intermediar-poli');
                    const btnBac = document.getElementById('btn-intermediar-bac');
                    const btnDiverse = document.getElementById('btn-intermediar-diverse');
                    
                    if (counts['Academie'] && btnAcademie) btnAcademie.innerHTML = `📝 Test Intermediar - Academie <br><span style="font-size:13px; opacity:0.9">(${counts['Academie']} întrebări totale)</span>`;
                    if (counts['Poli'] && btnPoli) btnPoli.innerHTML = `🏛️ Test Intermediar - Poli <br><span style="font-size:13px; opacity:0.9">(${counts['Poli']} întrebări totale)</span>`;
                    if (counts['BAC'] && btnBac) btnBac.innerHTML = `🎓 Test Intermediar - BAC <br><span style="font-size:13px; opacity:0.9">(${counts['BAC']} întrebări totale)</span>`;
                    if (counts['Diverse'] && btnDiverse) btnDiverse.innerHTML = `🧠 Test Intermediar - Diverse <br><span style="font-size:13px; opacity:0.9">(${counts['Diverse']} întrebări totale)</span>`;
                }
            } catch(e) {
                console.error('Eroare fetch counts', e);
            }

            // Fetch assigned tests
            try {
                const asRes = await fetch(`/.netlify/functions/manage-assigned-tests?username=${encodeURIComponent(username)}`);
                if (asRes.ok) {
                    const assignedTests = await asRes.json();
                    const pendingTests = assignedTests.filter(t => t.status === 'pending');
                    const dashAssigned = document.getElementById('dash-assigned-tests');
                    
                    if (pendingTests.length > 0) {
                        let html = '<h3 style="font-size: 16px; margin-bottom: 12px; color: var(--accent-purple); text-shadow: 0 0 10px rgba(124,106,255,0.4);">🔥 Teme Primite:</h3>';
                        pendingTests.forEach(pt => {
                            html += `
                                <div style="background: linear-gradient(145deg, rgba(124,106,255,0.15), rgba(0,0,0,0.4)); border: 1px solid var(--accent-purple); border-left: 4px solid var(--accent-purple); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 10px; text-align: left; box-shadow: 0 4px 15px rgba(124,106,255,0.2);">
                                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                                        <div>
                                            <div style="font-weight: 700; font-size: 16px; color: #fff;">Test ${pt.exam_type}</div>
                                            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Până la: ${new Date(pt.deadline).toLocaleString('ro-RO')}</div>
                                            ${new Date(pt.deadline) < new Date() ? '<span class="badge" style="background:rgba(248,113,113,0.2); color:var(--accent-red); margin-top:6px; display:inline-block;">Întârziat</span>' : ''}
                                        </div>
                                        <div style="font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px;">
                                            ${pt.target_length} întrebări
                                        </div>
                                    </div>
                                    <button onclick='startAssignedTest("${pt.id}", "${pt.exam_type}", ${JSON.stringify(pt.questions_ids)})' class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 15px;">Incepe Tema</button>
                                </div>
                            `;
                        });
                        if(dashAssigned) {
                            dashAssigned.innerHTML = html;
                            dashAssigned.style.display = 'block';
                        }
                    } else {
                        if(dashAssigned) {
                            dashAssigned.style.display = 'none';
                            dashAssigned.innerHTML = '';
                        }
                    }
                }
            } catch(e) {
                console.error('Eroare fetch assigned tests', e);
            }

            showScreen('dashboard');
        } else {
            await selectTestType('initial', username, 'Initial');
        }
    } catch(e) {
        showToast('Eroare la încărcarea istoricului.');
        showScreen('welcome');
    }
}

        function logoutStudent() {
            localStorage.removeItem('active_student_username');
            localStorage.removeItem('active_student_id');
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
                    await loadDashboard(username, data.student.id);
                } else {
                    showToast(data.error || 'Eroare la conectare.', true);
                    els.btnContinue.innerHTML = originalText;
                    els.btnContinue.disabled = false;
                }
            } catch(e) {
                showToast('Eroare la conectare la server.', true);
                els.btnContinue.innerHTML = originalText;
                els.btnContinue.disabled = false;
            }
        }

        function startQuiz() {
            state.currentQuestion = 0;
            state.answers = new Array(questions.length).fill(null);
            state.startTime = Date.now();
            state.endTime = null;
            state.blurCount = 0;
            state.questionTimings = new Array(questions.length).fill(0);
            state.questionEnteredAt = null;

            els.blurCountDisplay.textContent = '0';
            els.anticheatBadge.className = 'anticheat-badge';

            saveStateToStorage();
            startTimer();

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
            els.studentUsername.value = '';
            els.studentPassword.value = '';
            els.btnContinue.disabled = false;
            els.btnContinue.innerHTML = `<span>Autentificare & Începe</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                    stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                </svg>`;

            const timerBadge = $('#quiz-timer');
            if (timerBadge) {
                timerBadge.classList.remove('warning');
                const countdownEl = $('#timer-countdown');
                if (countdownEl) countdownEl.textContent = '30:00';
            }
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
                if (document.hidden) triggerBlur();
            });
            window.addEventListener('blur', () => {
                triggerBlur();
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
            btnExit.addEventListener('click', () => { modalExit.style.display = 'flex'; });
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

                if (savedStartTime && savedStudentUsername && savedAnswers && savedQuestionsIds && savedStudentId) {
                    state.startTime = parseInt(savedStartTime);
                    state.studentUsername = savedStudentUsername;
                    state.studentId = savedStudentId;
                    state.testType = savedTestType || 'initial';
                    state.examType = savedExamType || 'Initial';
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

                    if (Date.now() - state.startTime > maxAllowedTimeMs) {
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

                    // Update blur display
                    els.blurCountDisplay.textContent = state.blurCount;
                    if (state.blurCount >= 5) els.anticheatBadge.className = 'anticheat-badge danger';
                    else if (state.blurCount >= 2) els.anticheatBadge.className = 'anticheat-badge warned';

                    // Pre-fill username
                    els.studentUsername.value = state.studentUsername;

                    startTimer();
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
            document.getElementById('list-situatia-assigned').innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';
            document.getElementById('list-situatia-history').innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';
            
            try {
                // Fetch assigned tests (only pending)
                const resAssigned = await fetch(`/.netlify/functions/manage-assigned-tests?username=${encodeURIComponent(state.studentUsername)}`);
                let assignedTests = [];
                if (resAssigned.ok) {
                    assignedTests = await resAssigned.json();
                }

                // Fetch past results for the student
                const resHistory = await fetch(`/.netlify/functions/fetch-results?username=${encodeURIComponent(state.studentUsername)}`);
                let historyTests = [];
                if (resHistory.ok) {
                    historyTests = await resHistory.json();
                }

                renderSituatiaStudent(assignedTests, historyTests);
            } catch(e) {
                console.error(e);
                showToast('Eroare la încărcarea situației.', true);
                document.getElementById('list-situatia-assigned').innerHTML = '<p style="color:var(--accent-red)">Eroare la încărcare.</p>';
                document.getElementById('list-situatia-history').innerHTML = '<p style="color:var(--accent-red)">Eroare la încărcare.</p>';
            }
        }

        function renderSituatiaStudent(assignedTests, historyTests) {
            const listAssigned = document.getElementById('list-situatia-assigned');
            const listHistory = document.getElementById('list-situatia-history');

            // Render Assigned
            if (!assignedTests || assignedTests.length === 0) {
                listAssigned.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">Nu ai niciun test asignat în așteptare.</p>';
            } else {
                listAssigned.innerHTML = assignedTests.map(at => {
                    const deadlineDate = new Date(at.deadline);
                    const isOverdue = deadlineDate < new Date();
                    const warningHtml = isOverdue ? `<div style="color:var(--accent-red); font-weight:bold; font-size:12px; margin-bottom: 8px;">⚠️ VINE ADMITEREA! Deadline depășit.</div>` : '';
                    
                    return `
                        <div class="option-card" style="margin-bottom: 12px; display:block; padding: 16px;">
                            ${warningHtml}
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">Test ${at.exam_type} (${at.target_length} întrebări)</div>
                                    <div style="font-size: 13px; color: var(--text-secondary);">Deadline: ${deadlineDate.toLocaleString('ro-RO')}</div>
                                </div>
                                <button class="btn btn-primary" style="padding: 8px 16px; font-size: 13px;" onclick='startAssignedTest("${at.id}", "${at.exam_type}", ${JSON.stringify(at.questions_ids)})'>Începe Testul</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // Render History
            if (!historyTests || historyTests.length === 0) {
                listHistory.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">Nu ai susținut încă niciun test.</p>';
            } else {
                listHistory.innerHTML = historyTests.map((ht, idx) => {
                    const pct = Math.round((ht.score / ht.total_points) * 100) || 0;
                    return `
                        <div class="option-card" style="margin-bottom: 12px; display:block; padding: 16px;" onclick="toggleHistoryDetails('history-details-${ht.id}')">
                            <div style="display:flex; justify-content:space-between; align-items:center; cursor: pointer;">
                                <div>
                                    <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">Test ${ht.exam_type || 'Intermediar'} - ${ht.score}/${ht.total_points} puncte</div>
                                    <div style="font-size: 13px; color: var(--text-secondary);">Data: ${new Date(ht.created_at).toLocaleString('ro-RO')} | Timp: ${formatTime(ht.time_taken_ms)}</div>
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
                const explHtml = d.explanation ? `<div style="background:rgba(124,106,255,0.1); border-left:3px solid var(--accent-purple); padding:8px 12px; font-size:13px; color:#d0c8ff; margin-top:8px;">💡 ${escapeHtml(d.explanation)}</div>` : '';

                return `
                    <div style="background:rgba(255,255,255,0.02); border-radius:8px; padding:12px; margin-bottom:12px; border:1px solid ${isOk ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'};">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <span style="font-size:13px; font-weight:bold; color:var(--text-primary);">#${i+1}</span>
                            ${badge}
                        </div>
                        <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:8px; white-space:pre-wrap;">${escapeHtml(d.text)}</div>
                        ${codeHtml}
                        ${imageHtml}
                        <div style="margin-top:8px;">${optsHtml}</div>
                        ${explHtml}
                    </div>
                `;
            }).join('');
        }

        // Initialize App
        initApp();
        setTimeout(() => els.studentUsername.focus(), 500);