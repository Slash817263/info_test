import { apiFetch } from './api.js';
import { openLightbox } from './auth.js';
import { $, $$, els } from './dom.js';
import { loadPracticeCoverage } from './practice.js';
import { questions, state, setQuestions } from './state.js';
import { showScreen, renderResults } from './ui.js';
import { escapeHtml, formatEuropeanDateTime, parseImageUrls, cleanSymbols, showToast } from './utils.js';
import { renderMath } from './math.js';

/* ========================================================================
   QUIZ RENDERING
   ======================================================================== */
export function renderQuestion() {
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
    if (els.progressBar) els.progressBar.style.width = progress + '%';
    if (els.progressText) els.progressText.textContent = `Întrebarea ${num} din ${questions.length}`;
    const pctBadge = document.getElementById('progress-percent-badge');
    if (pctBadge) pctBadge.textContent = `${Math.round(progress)}%`;

    // Question number
    els.questionNumber.textContent = num.toString().padStart(2, '0');

    // Difficulty badge
    const diffMap = {
        easy: { text: 'Ușoară', class: 'badge-easy' },
        usor: { text: 'Ușoară', class: 'badge-easy' },
        'ușoară': { text: 'Ușoară', class: 'badge-easy' },
        medium: { text: 'Medie', class: 'badge-medium' },
        mediu: { text: 'Medie', class: 'badge-medium' },
        hard: { text: 'Grea', class: 'badge-hard' },
        greu: { text: 'Grea', class: 'badge-hard' }
    };
    const diffKey = String(q.difficulty || 'medium').toLowerCase();
    const diff = diffMap[diffKey] || { text: 'Medie', class: 'badge-medium' };
    els.badgeDifficulty.textContent = diff.text;
    els.badgeDifficulty.className = 'badge ' + diff.class;

    // Type badge (optional / removed)
    if (els.badgeType) {
        els.badgeType.textContent = q.type === 'code' ? 'Completare Cod' : 'Grilă';
    }

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

    // Code block with dynamic Syntax Highlighting (C++ vs Pseudocod)
    if (q.code) {
        els.codeWrapper.style.display = 'block';
        const isPseudocode = q.subcategory === 'Pseudocod' || (q.code && (q.code.includes('←') || q.code.includes('citește') || q.code.includes('scrie') || q.code.includes('<-')));
        const codeLabel = els.codeWrapper.querySelector('.code-label');
        if (codeLabel) {
            codeLabel.textContent = isPseudocode ? 'Pseudocod' : 'C++';
        }
        const cleanCode = cleanSymbols(q.code);
        const codeHtml = escapeHtml(cleanCode).replace(
            /_{4,}/g,
            '<span class="code-blank">________</span>'
        );
        const langClass = isPseudocode ? 'language-none' : 'language-cpp';
        els.codeContent.innerHTML = `<pre class="${langClass}" style="background:transparent; margin:0; padding:0;"><code class="${langClass}">${codeHtml}</code></pre>`;
        if (!isPseudocode && window.Prism) {
            setTimeout(() => {
                const codeEl = els.codeContent.querySelector('code');
                if (codeEl && window.Prism) window.Prism.highlightElement(codeEl);
            }, 0);
        }

        // Reset scroll position and collapse on new question
        const scrollContainer = document.getElementById('code-container-scroll');
        if (scrollContainer) {
            scrollContainer.classList.remove('expanded');
            scrollContainer.scrollTop = 0;
            if (!scrollContainer.dataset.scrollBound) {
                scrollContainer.dataset.scrollBound = 'true';
                scrollContainer.addEventListener('scroll', () => {
                    const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 12;
                    if (isAtBottom) scrollContainer.classList.add('scrolled-bottom');
                    else scrollContainer.classList.remove('scrolled-bottom');
                });
            }
        }
        const expandText = document.getElementById('expand-code-text');
        if (expandText) expandText.textContent = 'Extinde';
        const copyText = document.getElementById('copy-code-text');
        if (copyText) copyText.textContent = 'Copiază';
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
        const isCodeOption = (q.type === 'code' || (opt && (opt.includes('\n') || opt.includes(';')))) ? ' code-option' : '';
        const letter = letters[displayIndex] || String.fromCharCode(65 + displayIndex);
        optionsHtml += `
                <div class="option-card ${selectedClass}" data-index="${originalIndex}" role="button" tabindex="0" aria-label="Opțiunea ${letter}">
                    <div class="option-letter">${letter}</div>
                    <div class="option-text${isCodeOption}">${escapeHtml(opt)}</div>
                    <kbd class="option-kbd-hint">${letter}</kbd>
                </div>`;
    });
    els.optionsContainer.innerHTML = optionsHtml;
    renderMath(els.questionText);
    renderMath(els.optionsContainer);

    // Hint handling in progress: Allowed ONLY for 'tema' (assigned test) OR 'intermediar' test. NEVER for 'initial'.
    const isInitialTest = (state.testType === 'initial' || state.examType === 'Initial');
    const isAllowedInProgress = !isInitialTest && (state.testType === 'intermediar' || state.testType === 'tema' || !!state.assignedTestId);

    const btnHint = $('#btn-hint');
    const hintBox = $('#hint-box');
    const hintContent = $('#hint-content');

    if (hintBox) hintBox.style.display = 'none'; // reset collapsed on question change

    if (isAllowedInProgress && q.hint && q.hint.trim() !== '') {
        if (btnHint) btnHint.style.display = 'inline-flex';
        if (hintContent) {
            hintContent.textContent = q.hint.trim();
            renderMath(hintContent);
        }
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

export function copyQuizCode() {
    const codeEl = document.getElementById('code-content');
    const btn = document.getElementById('btn-copy-code');
    const label = document.getElementById('copy-code-text');
    if (!codeEl) return;
    const text = codeEl.innerText || codeEl.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
        if (btn) btn.classList.add('copied');
        if (label) label.textContent = 'Copiat!';
        setTimeout(() => {
            if (btn) btn.classList.remove('copied');
            if (label) label.textContent = 'Copiază';
        }, 1800);
    }).catch(() => {
        showToast('Nu s-a putut copia codul automat.');
    });
}
window.copyQuizCode = copyQuizCode;

export function toggleQuizCodeExpand() {
    const container = document.getElementById('code-container-scroll');
    const btn = document.getElementById('btn-expand-code');
    const label = document.getElementById('expand-code-text');
    if (!container) return;
    const isExpanded = container.classList.toggle('expanded');
    if (label) label.textContent = isExpanded ? 'Restrânge' : 'Extinde';
    if (btn) {
        if (isExpanded) btn.classList.add('active');
        else btn.classList.remove('active');
    }
}
window.toggleQuizCodeExpand = toggleQuizCodeExpand;

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
export function saveStateToStorage() {
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

export function clearStateFromStorage() {
    try {
        ['quiz_current_question', 'quiz_answers', 'quiz_start_time', 'quiz_student_username',
            'quiz_student_id', 'quiz_test_type', 'quiz_exam_type', 'quiz_blur_count', 'quiz_question_timings',
            'quiz_questions_ids', 'quiz_assigned_test_id', 'quiz_display_orders',
            'quiz_lead_first_name', 'quiz_lead_last_name', 'quiz_lead_phone', 'quiz_is_public_initial'].forEach(k => localStorage.removeItem(k));
    } catch (e) {
        console.error('Failed to clear state from localStorage', e);
    }
}

export let timerDurationMs = 0;
export function setTimerDurationMs(v) { timerDurationMs = v; }
export let timerInterval = null;
export function setTimerInterval(v) { timerInterval = v; }

export function startTimer() {
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
            setTimerInterval(null);
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
    setTimerInterval(setInterval(updateTimer, 1000));
}


export function autoSubmitQuiz() {
    showToast('Timpul a expirat! Testul a fost trimis automat.');
    finishQuiz(true);
}

export async function executePublicInitialTest() {
    if (state.leadGdpr !== true) {
        showToast('Trebuie să accepți Politica de Confidențialitate pentru a susține testul.', true);
        startPublicInitialTest();
        return;
    }

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

        setQuestions(rawQs);
        setTimerDurationMs(30 * 60 * 1000);
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

export function startPublicInitialTest() {
    renderPublicLeadStartModal();
}
window.startPublicInitialTest = startPublicInitialTest;

export function saveLeadDraft() {
    const fnInput = document.getElementById('start-first-name');
    const lnInput = document.getElementById('start-last-name');
    const phInput = document.getElementById('start-phone');
    const gdInput = document.getElementById('start-gdpr');

    const fn = fnInput ? fnInput.value : '';
    const ln = lnInput ? lnInput.value : '';
    const ph = phInput ? phInput.value : '';
    const gd = gdInput ? gdInput.checked : false;

    state.leadFirstName = fn;
    state.leadLastName = ln;
    state.leadPhone = ph;
    state.leadGdpr = gd;

    try {
        localStorage.setItem('quiz_lead_draft_first_name', fn);
        localStorage.setItem('quiz_lead_draft_last_name', ln);
        localStorage.setItem('quiz_lead_draft_phone', ph);
        localStorage.setItem('quiz_lead_draft_gdpr', gd ? 'true' : 'false');
    } catch (e) {}
}
window.saveLeadDraft = saveLeadDraft;

export function closePublicLeadStartModal() {
    const modal = document.getElementById('lead-start-modal');
    if (modal) modal.remove();
    try {
        localStorage.removeItem('quiz_lead_modal_open');
    } catch (e) {}
}
window.closePublicLeadStartModal = closePublicLeadStartModal;

export function openPrivacyPolicyModal() {
    saveLeadDraft();
    let pModal = document.getElementById('privacy-policy-modal');
    if (!pModal) {
        pModal = document.createElement('div');
        pModal.id = 'privacy-policy-modal';
        pModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.88); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); padding: 14px; box-sizing: border-box;';
        pModal.innerHTML = `
            <div style="background: linear-gradient(175deg, rgba(22, 24, 58, 0.98), rgba(12, 13, 34, 0.99)); border: 1px solid rgba(124, 106, 255, 0.4); border-radius: var(--radius-lg, 16px); width: 100%; max-width: 680px; max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(124, 106, 255, 0.25); position: relative; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.02); flex-shrink: 0;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 20px;">🛡️</span>
                        <h3 style="margin: 0; font-size: 16.5px; font-weight: 800; color: #fff;">Politica de Confidențialitate</h3>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <a href="/politica-de-confidentialitate.html" target="_blank" rel="noopener noreferrer" title="Deschide în pagină separată" style="color: var(--text-muted); font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px; padding: 5px 9px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); text-decoration: none;">
                            <span>Filă nouă</span>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                        <button type="button" class="btn-close" onclick="closePrivacyPolicyModal()" aria-label="Închide" style="position: static; font-size: 20px; line-height: 1; padding: 4px 8px;">&times;</button>
                    </div>
                </div>
                <div id="privacy-policy-modal-body" style="flex: 1 1 auto; overflow-y: auto; padding: 20px; font-size: 13.5px; line-height: 1.65; color: #cbd5e1; -webkit-overflow-scrolling: touch;">
                    <div style="text-align: center; padding: 30px 10px;">
                        <p style="color: var(--text-muted); font-size: 13px;">Se încarcă politica de confidențialitate...</p>
                    </div>
                </div>
                <div style="padding: 12px 20px; border-top: 1px solid rgba(255, 255, 255, 0.08); background: rgba(0, 0, 0, 0.35); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; flex-shrink: 0;">
                    <span style="font-size: 11.5px; color: var(--text-muted);">AcaDe-QUIZ • GDPR</span>
                    <button type="button" class="btn btn-primary" onclick="closePrivacyPolicyModal()" style="padding: 8px 18px; font-size: 13px; font-weight: 700;">
                        ✓ Înapoi la formular
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(pModal);

        pModal.addEventListener('click', (e) => {
            if (e.target === pModal) closePrivacyPolicyModal();
        });
    }

    pModal.style.display = 'flex';

    fetch('/politica-de-confidentialitate.html')
        .then(r => r.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const cards = doc.querySelectorAll('.privacy-card');
            const bodyEl = document.getElementById('privacy-policy-modal-body');
            if (bodyEl) {
                if (cards.length > 0) {
                    bodyEl.innerHTML = Array.from(cards).map(c => c.outerHTML).join('');
                } else {
                    bodyEl.innerHTML = doc.body.innerHTML;
                }
            }
        })
        .catch(() => {
            const bodyEl = document.getElementById('privacy-policy-modal-body');
            if (bodyEl) {
                bodyEl.innerHTML = `
                    <p>Prezenta Politică de Confidențialitate stabilește modul în care platforma educațională <strong>AcaDe-QUIZ</strong> colectează și protejează datele cu caracter personal conform GDPR (Regulamentul UE 2016/679).</p>
                    <p>Pentru vizitatorii testului inițial gratuit, colectăm exclusiv numele, prenumele și numărul de telefon WhatsApp pentru generarea și comunicarea rezultatelor evaluării.</p>
                `;
            }
        });
}
window.openPrivacyPolicyModal = openPrivacyPolicyModal;

export function closePrivacyPolicyModal() {
    const pModal = document.getElementById('privacy-policy-modal');
    if (pModal) pModal.style.display = 'none';
}
window.closePrivacyPolicyModal = closePrivacyPolicyModal;

export function renderPublicLeadStartModal() {
    const existing = document.getElementById('lead-start-modal');
    if (existing) existing.remove();

    const savedFirst = localStorage.getItem('quiz_lead_draft_first_name') || localStorage.getItem('quiz_lead_first_name') || state.leadFirstName || '';
    const savedLast = localStorage.getItem('quiz_lead_draft_last_name') || localStorage.getItem('quiz_lead_last_name') || state.leadLastName || '';
    const savedPhone = localStorage.getItem('quiz_lead_draft_phone') || localStorage.getItem('quiz_lead_phone') || state.leadPhone || '';
    const savedGdpr = (localStorage.getItem('quiz_lead_draft_gdpr') === 'true') || state.leadGdpr === true;

    const modal = document.createElement('div');
    modal.id = 'lead-start-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px);';
    modal.innerHTML = `
        <div style="background: linear-gradient(175deg, rgba(22, 24, 58, 0.96), rgba(12, 13, 34, 0.98)); border: 1px solid rgba(124, 106, 255, 0.4); border-radius: var(--radius-lg, 16px); padding: 32px 26px; max-width: 480px; width: 90%; box-shadow: 0 15px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(124, 106, 255, 0.2); position: relative; backdrop-filter: blur(16px);">
            <button onclick="closePublicLeadStartModal()" class="btn-close" style="position: absolute; top: 14px; right: 14px;" aria-label="Închide">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <div style="width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(135deg, rgba(124, 106, 255, 0.2), rgba(56, 189, 248, 0.2)); border: 1px solid rgba(124, 106, 255, 0.4); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; box-shadow: 0 0 25px rgba(124, 106, 255, 0.3);">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                </svg>
            </div>
            <h2 style="font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 10px; text-align: center; letter-spacing: -0.3px;">Test Inițial Gratuit</h2>
            <p style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 22px; text-align: center; line-height: 1.55;">
                Completează datele de mai jos pentru a începe testul (durează max 30 min). 
                La final vei primi pe loc nota și nivelul tău, iar raportul detaliat va fi trimis automat pe WhatsApp.
            </p>
            <form id="lead-start-form" onsubmit="handlePublicLeadStartSubmit(event)">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                    <div>
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Prenume *</label>
                        <input type="text" id="start-first-name" class="form-control" placeholder="ex: Andrei" value="${escapeHtml(savedFirst)}" required style="width: 100%; padding: 11px 12px; background: rgba(10, 10, 30, 0.8); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: #fff; box-sizing: border-box; font-size: 14px;">
                    </div>
                    <div>
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Nume de familie *</label>
                        <input type="text" id="start-last-name" class="form-control" placeholder="ex: Popescu" value="${escapeHtml(savedLast)}" required style="width: 100%; padding: 11px 12px; background: rgba(10, 10, 30, 0.8); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: #fff; box-sizing: border-box; font-size: 14px;">
                    </div>
                </div>
                <div style="margin-bottom: 18px;">
                    <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Număr de Telefon (WhatsApp) *</label>
                    <input type="tel" id="start-phone" class="form-control" placeholder="07XXXXXXXX" maxlength="10" inputmode="numeric" pattern="07[0-9]{8}" autocomplete="tel" value="${escapeHtml(savedPhone)}" required style="width: 100%; padding: 11px 12px; background: rgba(10, 10, 30, 0.8); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: #fff; box-sizing: border-box; font-size: 14px; transition: border-color 0.2s, box-shadow 0.2s;">
                    <div id="start-phone-error" style="font-size: 11.5px; margin-top: 5px; color: #ef4444; display: none; line-height: 1.4;"></div>
                </div>
                <div style="margin-bottom: 22px;">
                    <label class="custom-checkbox-wrapper" for="start-gdpr">
                        <input type="checkbox" id="start-gdpr" ${savedGdpr ? 'checked' : ''} required>
                        <span style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.45; cursor: pointer;">
                            * Am citit și sunt de acord cu <a href="/politica-de-confidentialitate.html" id="link-privacy-policy" style="color: var(--accent-blue, #38bdf8); text-decoration: underline;">Politica de Confidențialitate</a>. 
                            Sunt de acord să fiu contactat pe WhatsApp cu rezultatul testului și detaliile sesiunii gratuite.
                        </span>
                    </label>
                </div>
                <button type="submit" id="btn-start-lead-submit" class="btn btn-primary btn-full" style="padding: 14px; font-size: 15px; font-weight: 800; background: linear-gradient(135deg, #7c6aff, #38bdf8); box-shadow: 0 4px 20px rgba(124, 106, 255, 0.35);">
                    <span>Începe Testul Acum &rarr;</span>
                </button>
                <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 14px; font-size: 11.5px; color: var(--text-muted);">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <span>Datele tale sunt în siguranță. Nu trimitem spam.</span>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    // Auto-save on every keystroke & live validation
    const fnInput = modal.querySelector('#start-first-name');
    const lnInput = modal.querySelector('#start-last-name');
    const phInput = modal.querySelector('#start-phone');
    const gdInput = modal.querySelector('#start-gdpr');
    const phError = modal.querySelector('#start-phone-error');

    function cleanPhoneNumberInput(val) {
        if (!val) return '';
        let cleaned = val.trim().replace(/[\s\-\.\(\)]/g, '');
        if (cleaned.startsWith('+40')) cleaned = '0' + cleaned.substring(3);
        else if (cleaned.startsWith('40') && cleaned.length > 10) cleaned = '0' + cleaned.substring(2);
        return cleaned.replace(/\D/g, '').slice(0, 10);
    }

    function validatePhoneLive(showIncomplete = false) {
        if (!phInput) return false;
        const clean = cleanPhoneNumberInput(phInput.value);
        if (phInput.value !== clean) {
            phInput.value = clean;
        }

        if (!clean) {
            if (showIncomplete) {
                phInput.style.borderColor = '#ef4444';
                phInput.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.25)';
                if (phError) {
                    phError.style.display = 'block';
                    phError.textContent = 'Numărul de telefon este obligatoriu.';
                }
            } else {
                phInput.style.borderColor = 'var(--border-subtle)';
                phInput.style.boxShadow = 'none';
                if (phError) phError.style.display = 'none';
            }
            return false;
        }

        if (clean.length >= 2 && !clean.startsWith('07')) {
            phInput.style.borderColor = '#ef4444';
            phInput.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.25)';
            if (phError) {
                phError.style.display = 'block';
                phError.textContent = 'Numărul de telefon trebuie să înceapă cu 07 (ex: 07XXXXXXXX).';
            }
            return false;
        }

        if (clean.length === 10 && clean.startsWith('07')) {
            phInput.style.borderColor = '#10b981';
            phInput.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.25)';
            if (phError) phError.style.display = 'none';
            return true;
        }

        if (showIncomplete && clean.length < 10) {
            phInput.style.borderColor = '#ef4444';
            phInput.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.25)';
            if (phError) {
                phError.style.display = 'block';
                phError.textContent = `Numărul de telefon trebuie să aibă exact 10 cifre (ai introdus ${clean.length} cifre).`;
            }
            return false;
        }

        phInput.style.borderColor = 'var(--border-subtle)';
        phInput.style.boxShadow = 'none';
        if (phError) phError.style.display = 'none';
        return false;
    }

    [fnInput, lnInput].forEach(inp => {
        if (inp) {
            inp.addEventListener('input', saveLeadDraft);
            inp.addEventListener('change', saveLeadDraft);
        }
    });

    if (phInput) {
        phInput.addEventListener('input', () => {
            validatePhoneLive(false);
            saveLeadDraft();
        });
        phInput.addEventListener('change', () => {
            validatePhoneLive(false);
            saveLeadDraft();
        });
        phInput.addEventListener('blur', () => {
            if (phInput.value.length > 0 && phInput.value.length < 10) {
                validatePhoneLive(true);
            }
        });
        if (phInput.value) {
            validatePhoneLive(false);
        }
    }

    if (gdInput) {
        gdInput.addEventListener('change', saveLeadDraft);
    }

    // Intercept privacy policy link on mobile & web to open smooth in-app reader modal
    const privacyLink = modal.querySelector('#link-privacy-policy');
    if (privacyLink) {
        privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            saveLeadDraft();
            try {
                localStorage.setItem('quiz_lead_modal_open', 'true');
            } catch (err) {}
            openPrivacyPolicyModal();
        });
    }
}

export function handlePublicLeadStartSubmit(event) {
    event.preventDefault();
    const firstName = document.getElementById('start-first-name').value.trim();
    const lastName = document.getElementById('start-last-name').value.trim();
    const phoneInput = document.getElementById('start-phone');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const gdpr = document.getElementById('start-gdpr').checked;
    
    if (!firstName || !lastName || !phone) {
        showToast('Te rugăm să completezi toate datele.', true);
        return;
    }

    let cleanPhone = phone.replace(/[\s\-\.\(\)]/g, '');
    if (cleanPhone.startsWith('+40')) cleanPhone = '0' + cleanPhone.substring(3);
    else if (cleanPhone.startsWith('40') && cleanPhone.length === 11) cleanPhone = '0' + cleanPhone.substring(2);
    else if (cleanPhone.startsWith('7') && cleanPhone.length === 9) cleanPhone = '0' + cleanPhone;

    if (!/^07\d{8}$/.test(cleanPhone)) {
        showToast('Numărul de telefon trebuie să aibă exact 10 cifre și să înceapă cu 07 (ex: 07XXXXXXXX).', true);
        if (phoneInput) {
            phoneInput.focus();
            phoneInput.style.borderColor = '#ef4444';
            phoneInput.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.25)';
        }
        const phError = document.getElementById('start-phone-error');
        if (phError) {
            phError.style.display = 'block';
            phError.textContent = 'Numărul de telefon trebuie să aibă exact 10 cifre și să înceapă cu 07 (ex: 07XXXXXXXX).';
        }
        return;
    }

    if (!gdpr) {
        showToast('Trebuie să accepți Politica de Confidențialitate.', true);
        return;
    }

    state.leadFirstName = firstName;
    state.leadLastName = lastName;
    state.leadPhone = cleanPhone;
    state.leadGdpr = gdpr;

    try {
        localStorage.setItem('quiz_lead_first_name', firstName);
        localStorage.setItem('quiz_lead_last_name', lastName);
        localStorage.setItem('quiz_lead_phone', cleanPhone);
        localStorage.setItem('quiz_is_public_initial', 'true');
        // Clear drafts upon successful submission
        localStorage.removeItem('quiz_lead_draft_first_name');
        localStorage.removeItem('quiz_lead_draft_last_name');
        localStorage.removeItem('quiz_lead_draft_phone');
        localStorage.removeItem('quiz_lead_draft_gdpr');
        localStorage.removeItem('quiz_lead_modal_open');
    } catch (e) {}

    const leadModal = document.getElementById('lead-start-modal');
    if (leadModal) leadModal.remove();
    executePublicInitialTest();
}
window.handlePublicLeadStartSubmit = handlePublicLeadStartSubmit;

let isQuizSubmitting = false;

export async function submitResult(timeTakenMs) {
    if (isQuizSubmitting) return;
    isQuizSubmitting = true;

    const studentToken = localStorage.getItem('active_student_token');
    const isPublicStored = localStorage.getItem('quiz_is_public_initial') === 'true';
    const isGuest = state.isPublicInitial || isPublicStored || !studentToken || !state.studentUsername;

        if (isGuest) {
            state.isPublicInitial = true;
            state.pendingPublicTime = timeTakenMs;
            
            // Trimitere automată a rezultatului, deoarece avem deja datele lead-ului din formularul de la început
            try {
            showToast('Se analizează răspunsurile...', false, 2000);
            
            const questionIds = questions.map(q => q.id);
            const safeAnswers = questions.map((_, i) => (state.answers && state.answers[i] !== undefined && state.answers[i] !== null) ? state.answers[i] : null);

            const firstName = state.leadFirstName || localStorage.getItem('quiz_lead_first_name') || '';
            const lastName = state.leadLastName || localStorage.getItem('quiz_lead_last_name') || '';
            const phone = state.leadPhone || localStorage.getItem('quiz_lead_phone') || '';

            const res = await fetch('/.netlify/functions/submit-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    phone: phone,
                    gdpr_consent: state.leadGdpr !== undefined ? state.leadGdpr : true,
                    time_taken_ms: timeTakenMs || 0,
                    blur_count: state.blurCount || 0,
                    answers_json: safeAnswers,
                    question_ids: questionIds
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Eroare la salvarea rezultatelor.');

            state.isPublicInitial = false; // test finished
            state.studentUsername = `${firstName} ${lastName}`.trim();

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

            // Banner după finalizare
            const header = els.resultsContainer.querySelector('.results-header');
            if (header) {
                const banner = document.createElement('div');
                banner.innerHTML = `
                    <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(56, 189, 248, 0.15)); border: 1px solid #10b981; border-radius: var(--radius-md); padding: 16px 20px; margin-bottom: 24px; text-align: center;">
                        <div style="font-size: 16px; font-weight: 700; color: #34d399; margin-bottom: 4px;">🎉 Analiză Finalizată!</div>
                        <div style="font-size: 13px; color: #e2e8f0; line-height: 1.5;">
                            Mulțumim, <strong>${escapeHtml(data.student_name)}</strong>! Raportul detaliat a fost înregistrat și trimis către tine. Te vom contacta pe WhatsApp la <strong>${escapeHtml(data.phone)}</strong> cu pașii următori și invitația la sesiunea gratuită (30 min).
                        </div>
                    </div>
                `;
                header.insertAdjacentElement('beforebegin', banner);
            }
            
            showToast('🎉 Testul a fost evaluat cu succes!');
            clearStateFromStorage();

        } catch (e) {
            console.error('Public lead auto-submit error:', e);
            els.resultsContainer.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                    <h3 style="color: var(--accent-red); margin-bottom: 8px;">Conexiunea cu serverul a fost întreruptă</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 24px; max-width: 480px; margin-left: auto; margin-right: auto;">
                        Eroare la evaluarea testului. Verifică conexiunea la internet și apasă butonul de mai jos pentru a retrimite.
                    </p>
                    <button class="btn btn-primary" onclick="submitResult(${timeTakenMs})" style="padding: 12px 28px; font-size: 16px;">
                        🔄 Reîncearcă Evaluarea
                    </button>
                </div>
            `;
        } finally {
            isQuizSubmitting = false;
        }
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
        assigned_test_id: state.assignedTestId,
        test_title: state.assignedTestTitle || undefined
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
                    backToDashboard();
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
            const totalCorrect = results.totalCorrect;
            const totalQuestions = questions.length;
            const earnedXpVal = (data && data.earned_xp !== undefined) ? data.earned_xp : (totalCorrect * 10);
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
                            <button class="btn btn-primary" onclick="backToDashboard()">Înapoi la Panou</button>
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
    } finally {
        isQuizSubmitting = false;
    }
}

export function backToDashboard() {
    state.assignedTestId = null;
    clearStateFromStorage();
    const user = state.studentUsername || localStorage.getItem('active_student_username');
    const id = state.studentId || localStorage.getItem('active_student_id');
    showScreen('dashboard');
    if (user && window.loadDashboard) {
        window.loadDashboard(user, id);
    }
}
window.backToDashboard = backToDashboard;

export function retryPendingSubmission(timeTakenMs) {
    els.resultsContainer.innerHTML = '<div style="text-align:center; padding:40px;"><p>Se retrimite...</p></div>';
    submitResult(timeTakenMs);
}
window.retryPendingSubmission = retryPendingSubmission;

/* ========================================================================
   ANSWER HANDLING
   ======================================================================== */
export function selectAnswer(index) {
    state.answers[state.currentQuestion] = index;
    saveStateToStorage();
    if (state.assignedTestId) {
        saveAssignedProgress();
    }
    
    // Direct DOM update: toggle .selected without re-rendering or triggering animation flash
    if (els.optionsContainer) {
        const cards = els.optionsContainer.querySelectorAll('.option-card');
        cards.forEach(c => {
            const optIdx = parseInt(c.dataset.index);
            if (optIdx === index) {
                c.classList.add('selected');
            } else {
                c.classList.remove('selected');
            }
        });
    }

    if (els.btnNext) {
        els.btnNext.disabled = false;
    }
}

export function saveAssignedProgress() {
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
export function goNext() {
    if (state.answers[state.currentQuestion] === null) return;

    if (state.currentQuestion === questions.length - 1) {
        finishQuiz();
    } else {
        state.currentQuestion++;
        saveStateToStorage();
        if (state.assignedTestId) saveAssignedProgress();
        renderQuestion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

export function goPrev() {
    if (state.currentQuestion > 0) {
        state.currentQuestion--;
        saveStateToStorage();
        if (state.assignedTestId) saveAssignedProgress();
        renderQuestion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/* ========================================================================
   RESULTS CALCULATION (Moved to server)
   ======================================================================== */

/* ========================================================================
   QUESTION SELECTION & TEST TYPE
   ======================================================================== */

window.startAssignedTest = async function (assignedTestId, examType, questionsIds, testTitle = '') {
    if (state.isExpired) {
        showToast('Abonamentul tău a expirat. Contactează profesorul pentru reînnoire.', true);
        return;
    }
    state.testType = 'tema';
    state.examType = examType;
    state.assignedTestId = assignedTestId;
    state.assignedTestTitle = testTitle || '';

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

        setQuestions(fetchedQs);
        setTimerDurationMs(60 * 60 * 1000);
        localStorage.setItem('quiz_questions_ids', JSON.stringify(questions.map(q => q.id)));
        localStorage.setItem('quiz_assigned_test_id', assignedTestId);

        startQuiz(hasProgress);
    } catch (e) {
        showToast('Eroare la pornirea testului asignat.');
        btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
    }
};

window.startTest = function (type, examType) {
    if (state.isExpired) {
        showToast('Abonamentul tău a expirat. Contactează profesorul pentru reînnoire.', true);
        return;
    }
    const user = state.studentUsername || localStorage.getItem('active_student_username');
    if (!user) {
        showToast('Te rugăm să te autentifici.');
        showScreen('welcome');
        return;
    }
    selectTestType(type, user, examType);
};

export async function selectTestType(type, username, examType = 'Initial') {
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

        setQuestions(fetchedQs);
        setTimerDurationMs((examType === 'Initial') ? 30 * 60 * 1000 : 60 * 60 * 1000);

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
export async function loadDashboard(username, studentId) {
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
            const isExpired = !!resultsData.is_expired;
            state.isExpired = isExpired;
            if (isExpired) {
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

            // Nivel general (Notă estimată)
            const gradeVal = (resultsData.grade !== undefined)
                ? resultsData.grade
                : (resultsData.gamification && resultsData.gamification.grade ? resultsData.gamification.grade : 0);
            const elLevelText = document.getElementById('dash-level-text');
            const elLevelFill = document.getElementById('dash-level-fill');
            if (elLevelText) elLevelText.textContent = parseFloat(gradeVal || 0).toFixed(2) + ' / 10';
            if (elLevelFill) {
                setTimeout(() => {
                    elLevelFill.style.width = (parseFloat(gradeVal || 0) * 10) + '%';
                }, 300);
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
            const hubTabs = document.getElementById('dash-hub-tabs');
            const paneSimulari = document.getElementById('dash-pane-simulari');
            const paneCapitole = document.getElementById('dash-pane-capitole');

            if (isExpired) {
                if (initialSection) initialSection.style.display = 'none';
                if (categoriesContainer) categoriesContainer.style.display = 'none';
                if (elTimeHint) elTimeHint.style.display = 'none';
                if (dashDaily) dashDaily.style.display = 'none';
                if (dashAssigned) dashAssigned.style.display = 'none';
                if (practiceContainer) practiceContainer.style.display = 'block';
                if (hubTabs) hubTabs.style.display = 'none';
                if (paneSimulari) paneSimulari.style.display = 'none';
                if (paneCapitole) paneCapitole.style.display = 'block';
                const practiceCatWrapper = document.getElementById('practice-categories-wrapper');
                if (practiceCatWrapper) practiceCatWrapper.style.display = 'none';
                if (dashSubtitle) dashSubtitle.innerHTML = `<span style="font-style: italic; color: var(--text-secondary);">„Un test la informatică pe zi ține AFT-ul la distanță”</span><br><span style="display: block; text-align: center; font-size: 12px; color: var(--text-muted); margin-top: 4px;">~ Citat anonim</span>`;
            } else if (!hasCompletedInitial) {
                if (initialSection) initialSection.style.display = 'block';
                if (categoriesContainer) categoriesContainer.style.display = 'none';
                if (elTimeHint) elTimeHint.style.display = 'none';
                if (practiceContainer) practiceContainer.style.display = 'none';
                if (dashDaily) dashDaily.style.display = 'none';
                if (dashAssigned) dashAssigned.style.display = 'none';
                if (hubTabs) hubTabs.style.display = 'none';
                if (paneSimulari) paneSimulari.style.display = 'none';
                if (paneCapitole) paneCapitole.style.display = 'none';
                if (dashSubtitle) dashSubtitle.textContent = 'Pentru a începe, susține testul de evaluare inițială:';
            } else {
                if (initialSection) initialSection.style.display = 'none';
                if (categoriesContainer) categoriesContainer.style.display = 'grid';
                if (elTimeHint) elTimeHint.style.display = 'flex';
                if (practiceContainer) practiceContainer.style.display = 'block';
                if (hubTabs) hubTabs.style.display = 'flex';
                if (paneSimulari && (!paneCapitole || paneCapitole.style.display !== 'block')) {
                    paneSimulari.style.display = 'block';
                }
                const practiceCatWrapper = document.getElementById('practice-categories-wrapper');
                if (practiceCatWrapper) practiceCatWrapper.style.display = 'block';
                if (dashSubtitle) dashSubtitle.innerHTML = `<span style="font-style: italic; color: var(--text-secondary);">„Un test la informatică pe zi ține AFT-ul la distanță”</span><br><span style="display: block; text-align: center; font-size: 12px; color: var(--text-muted); margin-top: 4px;">~ Citat anonim</span>`;
            }

            // Enable all dashboard buttons
            const allBtns = document.querySelectorAll('#screen-dashboard .btn, #screen-situatie .btn, .dash-cat-btn, #btn-start-initial, .dash-btn-action');
            allBtns.forEach(b => {
                b.disabled = false;
                b.style.opacity = '1';
                b.style.pointerEvents = 'auto';
            });
            const btnStartInit = document.getElementById('btn-start-initial');
            if (btnStartInit) btnStartInit.innerHTML = '🚀 Începe Testul Inițial';

            // Fetch assigned tests (only if not expired and initial test is done)
            if (!isExpired && hasCompletedInitial) {
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
                            let html = '<div class="dash-section-header"><span class="dash-section-icon">🔥</span><h3 class="dash-section-title">Teme Asignate</h3></div>';
                            pendingTests.forEach(pt => {
                                const answered = pt.answered_count || 0;
                                const total = pt.target_length || (pt.questions_ids ? pt.questions_ids.length : 0);
                                const percent = total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0;
                                const isLate = new Date(pt.deadline) < new Date();
                                const btnText = answered > 0 ? 'Continuă Tema' : 'Începe Tema';

                                html += `
                                    <div class="dash-hw-card ${isLate ? 'is-late' : ''}">
                                        <div class="dash-hw-header">
                                            <div class="dash-hw-title">${escapeHtml(pt.title || ('Test ' + pt.exam_type))}</div>
                                            <div class="dash-hw-badges">
                                                <span class="dash-tag dash-tag-exam">${escapeHtml(pt.exam_type)}</span>
                                                ${isLate 
                                                    ? '<span class="dash-tag dash-tag-late">⚠️ Întârziat</span>' 
                                                    : '<span class="dash-tag dash-tag-active">⏳ Activ</span>'
                                                }
                                            </div>
                                        </div>
                                        <div class="dash-hw-meta">
                                            Termen predare: <strong>${formatEuropeanDateTime(pt.deadline)}</strong>
                                        </div>
                                        <div class="dash-hw-footer">
                                            <div class="dash-hw-progress-info">
                                                <span class="dash-hw-progress-text">${answered} / ${total} întrebări rezolvate (${percent}%)</span>
                                                <div class="dash-hw-progress-bar">
                                                    <div class="dash-hw-progress-fill" style="width: ${percent}%;"></div>
                                                </div>
                                            </div>
                                            <button onclick='startAssignedTest("${pt.id}", "${pt.exam_type}", ${JSON.stringify(pt.questions_ids)}, "${(pt.title || "").replace(/"/g, "&quot;")}")' class="dash-btn-action">
                                                <span>${btnText}</span>
                                                <span class="btn-arrow">→</span>
                                            </button>
                                        </div>
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
            if (isExpired || resultsData.hasDailyToday || !hasCompletedInitial) {
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
                                    <div class="dash-section-header">
                                        <span class="dash-section-icon">🎯</span>
                                        <h3 class="dash-section-title" style="color: #38bdf8;">Test Zilnic Adaptiv</h3>
                                    </div>
                                    <div class="dash-daily-card">
                                        <div class="dash-daily-content">
                                            <div class="dash-hw-title" style="color: #e0f2fe; margin-bottom: 4px;">Antrenament Personalizat</div>
                                            <div class="dash-hw-meta" style="margin-top: 0; line-height: 1.45; color: #cbd5e1;">
                                                ${coadaText}
                                            </div>
                                        </div>
                                        <button onclick="startTest('intermediar', 'Zilnic')" class="dash-btn-action dash-btn-daily" style="flex-shrink: 0;">
                                            <span>Începe Testul Zilnic</span>
                                            <span class="btn-arrow">→</span>
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

            // Load Module 1 Category Practice Coverage (for expired or active students who completed initial or have practice data)
            if (isExpired || hasCompletedInitial) {
                await loadPracticeCoverage(username);
                if (isExpired) {
                    const practiceCatWrapper = document.getElementById('practice-categories-wrapper');
                    if (practiceCatWrapper) practiceCatWrapper.style.display = 'none';
                }
            }

            showScreen('dashboard');

            // Obligativitate setare numar de telefon daca nu exista in baza de date
            if (!resultsData.phone_number) {
                showPhoneModal();
            }
        } else {
            showToast(resultsData.error || 'Eroare la încărcarea profilului.', true);
            const token = localStorage.getItem('active_student_token');
            if (!token) showScreen('welcome');
        }
    } catch (e) {
        console.error('loadDashboard error', e);
        showToast('Eroare la încărcarea istoricului.');
        const token = localStorage.getItem('active_student_token');
        if (!token) showScreen('welcome');
    }
}

let onPhoneSavedCallback = null;

export function showPhoneModal(onSuccess = null) {
    onPhoneSavedCallback = onSuccess;
    const modal = document.getElementById('modal-phone');
    const input = document.getElementById('phone-input');
    const btnSubmit = document.getElementById('btn-submit-phone');
    if (!modal) return;

    modal.style.display = 'flex';
    if (input) {
        setTimeout(() => input.focus(), 100);
    }

    if (btnSubmit) {
        btnSubmit.onclick = null;
        if (!btnSubmit.dataset.bound) {
            btnSubmit.dataset.bound = 'true';
            btnSubmit.addEventListener('click', handlePhoneSubmit);
        }
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

export async function handlePhoneSubmit() {
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
            if (typeof onPhoneSavedCallback === 'function') {
                const cb = onPhoneSavedCallback;
                onPhoneSavedCallback = null;
                await cb();
            }
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

export function logoutStudent() {
    clearStateFromStorage();
    localStorage.removeItem('active_student_username');
    localStorage.removeItem('active_student_id');
    localStorage.removeItem('active_student_token');
    
    state.studentUsername = '';
    state.studentId = null;
    state.assignedTestId = null;

    if (els.btnContinue) {
        els.btnContinue.disabled = false;
        els.btnContinue.innerHTML = `<span>Autentificare & Conectare</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>`;
    }
    if (els.studentPassword) {
        els.studentPassword.value = '';
    }

    showScreen('welcome');
}
window.logoutStudent = logoutStudent;

function showAuthError(msg) {
    const banner = document.getElementById('auth-error-banner');
    const text = document.getElementById('auth-error-text');
    if (banner && text) {
        text.textContent = msg;
        banner.style.display = 'flex';
        banner.style.animation = 'none';
        void banner.offsetWidth;
        banner.style.animation = '';
    } else {
        showToast(msg, true);
    }
}

function hideAuthError() {
    const banner = document.getElementById('auth-error-banner');
    if (banner) banner.style.display = 'none';
}

export async function handleLogin() {
    const username = els.studentUsername.value.trim().toLowerCase();
    const password = els.studentPassword.value.trim();
    if (!username || !password) {
        showAuthError('Te rugăm să introduci atât utilizatorul, cât și parola.');
        if (!username) els.studentUsername.focus();
        else els.studentPassword.focus();
        return;
    }

    hideAuthError();
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
            hideAuthError();
            state.studentUsername = data.student.username;
            state.studentId = data.student.id;

            els.btnContinue.innerHTML = '<span>Se verifică istoricul...</span>';

            localStorage.setItem('active_student_username', state.studentUsername);
            localStorage.setItem('active_student_id', state.studentId);
            if (data.token) {
                localStorage.setItem('active_student_token', data.token);
            }

            if (!data.student.phone_number || data.student.phone_number.trim() === '') {
                // Afișează modalul de telefon și blochează dashboard-ul temporar până la salvare
                els.btnContinue.innerHTML = '<span>Se verifică datele...</span>';
                showPhoneModal(async () => {
                    els.btnContinue.innerHTML = '<span>Se deschide dashboard-ul...</span>';
                    await loadDashboard(username, data.student.id);
                });
            } else {
                await loadDashboard(username, data.student.id);
            }
        } else {
            showAuthError(data.error || 'Nume de utilizator sau parolă incorectă.');
            els.btnContinue.innerHTML = originalText;
            els.btnContinue.disabled = false;
        }
    } catch (e) {
        showAuthError('Eroare de conexiune la server. Încearcă din nou.');
        els.btnContinue.innerHTML = originalText;
        els.btnContinue.disabled = false;
    }
}

export function startQuiz(isResume = false) {
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
    const btnAssignedExitNav = $('#btn-assigned-save-exit');
    const btnExitText = $('#btn-exit-text');
    const btnExitEl = $('#btn-exit');

    if (state.assignedTestId) {
        // STRICT LA TESTELE ASIGNATE: fara afisare timp, fara logica expirare, fara abateri focus
        if (timerBadge) timerBadge.style.display = 'none';
        if (anticheatBadge) anticheatBadge.style.display = 'none';
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
            setTimerInterval(null);
        }
    } else {
        if (timerBadge) timerBadge.style.display = '';
        if (anticheatBadge) {
            anticheatBadge.style.display = '';
            anticheatBadge.className = 'anticheat-badge';
        }
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

export async function finishQuiz(autoSubmitted = false) {
    // Record timing for current question
    if (state.questionEnteredAt !== null) {
        const timeSpent = Date.now() - state.questionEnteredAt;
        state.questionTimings[state.currentQuestion] = (state.questionTimings[state.currentQuestion] || 0) + timeSpent;
        state.questionEnteredAt = null;
    }

    if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
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

export function restartQuiz() {
    if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
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

    const activeUser = state.studentUsername || localStorage.getItem('active_student_username');
    const activeId = state.studentId || localStorage.getItem('active_student_id');
    if (activeUser) {
        state.studentUsername = activeUser;
        state.studentId = activeId || null;
        showScreen('dashboard');
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
export let lastBlurTime = 0;
export function setLastBlurTime(v) { lastBlurTime = v; }
export function triggerBlur() {
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
    setLastBlurTime(now);

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

export function setupAntiCheat() {
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

