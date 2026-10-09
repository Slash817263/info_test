import { initApp, openLightbox, showDashboard } from './auth.js';
import { els } from './dom.js';
import { questions, state } from './state.js';
import { showScreen } from './ui.js';
import { escapeHtml, parseImageUrls, cleanSymbols, showToast } from './utils.js';
import { renderMath } from './math.js';

/* ========================================================================
   MODULE 1: LUCRU INDIVIDUAL, SPACED REPETITION & CALCULUL PROGRESULUI
   ======================================================================== */
export const practiceState = {
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

export async function loadPracticeCoverage(username) {
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
        if (masteredCountEl) masteredCountEl.textContent = `${data.total_mastered} / ${data.total_questions} Rezolvate corect`;

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

export function startPracticeFromSelect(category) {
    if (state.isExpired) {
        showToast('Abonamentul tău a expirat. Contactează profesorul pentru reînnoire.', true);
        return;
    }
    const safeId = category.replace(/[^a-zA-Z0-9]/g, '');
    const select = document.getElementById(`select-subcat-${safeId}`);
    const subcategory = select ? select.value : 'all';
    startPracticeSession(category, subcategory);
}
window.startPracticeFromSelect = startPracticeFromSelect;

export async function startPracticeSession(category, subcategory = 'all') {
    if (state.isExpired) {
        showToast('Abonamentul tău a expirat. Contactează profesorul pentru reînnoire.', true);
        return;
    }
    const user = state.currentUser || state.studentUsername || localStorage.getItem('active_student_username');
    const token = state.token || localStorage.getItem('active_student_token');
    if (!user || !token) {
        showToast('Trebuie să fii autentificat pentru a exersa.', true);
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
            showToast('🎉 Ai rezolvat deja toate întrebările din această categorie! Începi o sesiune de recapitulare.');
        }

        showScreen('practice');
        renderPracticeQuestion();

    } catch (e) {
        console.error('startPracticeSession error', e);
        showToast(e.message || 'Eroare la pornirea sesiunii.', true);
    }
}
window.startPracticeSession = startPracticeSession;

export function renderPracticeQuestion() {
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
        const isPseudocode = q.subcategory === 'Pseudocod' || (q.code && (q.code.includes('←') || q.code.includes('citește') || q.code.includes('scrie') || q.code.includes('<-')));
        const codeLabel = codeWrapper.querySelector('.code-label');
        if (codeLabel) {
            codeLabel.textContent = isPseudocode ? 'Pseudocod' : 'C++';
        }
        const cleanCode = cleanSymbols(q.code);
        const codeHtml = escapeHtml(cleanCode).replace(
            /_{4,}/g,
            '<span class="code-blank">________</span>'
        );
        const langClass = isPseudocode ? 'language-none' : 'language-cpp';
        codeContent.innerHTML = `<pre class="${langClass}" style="background:transparent; margin:0; padding:0;"><code class="${langClass}">${codeHtml}</code></pre>`;
        if (!isPseudocode && window.Prism) {
            setTimeout(() => {
                const codeEl = codeContent.querySelector('code');
                if (codeEl && window.Prism) window.Prism.highlightElement(codeEl);
            }, 0);
        }

        // Reset scroll position and collapse on new question
        const scrollContainer = document.getElementById('practice-code-container-scroll');
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
        const expandText = document.getElementById('practice-expand-code-text');
        if (expandText) expandText.textContent = 'Extinde';
        const copyText = document.getElementById('practice-copy-code-text');
        if (copyText) copyText.textContent = 'Copiază';
    } else {
        codeWrapper.style.display = 'none';
    }

    // Options
    const optionsContainer = document.getElementById('practice-options-container');
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    optionsContainer.innerHTML = (q.options || []).map((opt, idx) => {
        const isCodeOption = (q.type === 'code' || (opt && (opt.includes('\n') || opt.includes(';')))) ? ' code-option' : '';
        return `
        <div class="option-card practice-option" data-index="${idx}" onclick="selectPracticeOption(${idx})" role="button" tabindex="0" aria-label="Opțiunea ${letters[idx]}">
            <div class="option-letter">${letters[idx]}</div>
            <div class="option-text${isCodeOption}">${escapeHtml(opt)}</div>
        </div>`;
    }).join('');
    renderMath(document.getElementById('practice-question-text'));
    renderMath(optionsContainer);

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

export function copyPracticeCode() {
    const codeEl = document.getElementById('practice-code-content');
    const btn = document.getElementById('btn-practice-copy-code');
    const label = document.getElementById('practice-copy-code-text');
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
window.copyPracticeCode = copyPracticeCode;

export function togglePracticeCodeExpand() {
    const container = document.getElementById('practice-code-container-scroll');
    const btn = document.getElementById('btn-practice-expand-code');
    const label = document.getElementById('practice-expand-code-text');
    if (!container) return;
    const isExpanded = container.classList.toggle('expanded');
    if (label) label.textContent = isExpanded ? 'Restrânge' : 'Extinde';
    if (btn) {
        if (isExpanded) btn.classList.add('active');
        else btn.classList.remove('active');
    }
}
window.togglePracticeCodeExpand = togglePracticeCodeExpand;

export function selectPracticeOption(idx) {
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

export async function checkPracticeAnswer() {
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
            practiceState.masteredInSession.add(q.id);
            if (!practiceState.correctQuestionsInSession.has(q.id)) {
                practiceState.correctQuestionsInSession.add(q.id);
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

export function nextPracticeQuestion() {
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

export async function finishPracticeSession() {
    const user = state.studentUsername || localStorage.getItem('active_student_username');
    const token = localStorage.getItem('active_student_token') || '';
    const wrongArr = practiceState.wrongAnswersInSession ? 
        Array.from(practiceState.wrongAnswersInSession.entries()).map(([qId, sIdx]) => ({
            id: qId,
            studentAnswer: sIdx
        })) : [];

    if ((practiceState.masteredInSession.size > 0 || wrongArr.length > 0) && user) {
        try {
            await fetch('/.netlify/functions/manage-practice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    action: 'sync_coverage',
                    student_username: user,
                    newly_mastered_ids: Array.from(practiceState.masteredInSession),
                    wrong_answers: wrongArr
                })
            });
        } catch (e) {
            console.error('Error syncing coverage:', e);
        }
    }

    showScreen('results');
    const resultsContainer = document.getElementById('results-container');
    const solvedCorrectCount = practiceState.masteredInSession.size;
    const totalCount = practiceState.totalOriginal;

    resultsContainer.innerHTML = `
        <div class="results-header">
            <div class="results-icon">🎉</div>
            <h2>Sesiune de Exercițiu Finalizată!</h2>
            <p class="results-name">${escapeHtml(practiceState.category)} ${practiceState.subcategory !== 'all' ? '• ' + escapeHtml(practiceState.subcategory) : ''}</p>
        </div>

        <div class="score-display">
            <div class="score-value">
                <span class="score-number">${solvedCorrectCount}</span>
                <span class="score-max">/${totalCount}</span>
            </div>
            <div class="score-percent">Rezolvate corect</div>
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

export async function exitPracticeSession() {
    const user = state.studentUsername || localStorage.getItem('active_student_username');
    const token = localStorage.getItem('active_student_token') || '';
    const wrongArr = practiceState.wrongAnswersInSession ? 
        Array.from(practiceState.wrongAnswersInSession.entries()).map(([qId, sIdx]) => ({
            id: qId,
            studentAnswer: sIdx
        })) : [];

    // Sync any newly mastered questions and wrong answers in the background
    if ((practiceState.masteredInSession.size > 0 || wrongArr.length > 0) && user) {
        try {
            await fetch('/.netlify/functions/manage-practice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    action: 'sync_coverage',
                    student_username: user,
                    newly_mastered_ids: Array.from(practiceState.masteredInSession),
                    wrong_answers: wrongArr
                })
            });
        } catch (e) {
            console.error('Error syncing coverage on exit:', e);
        }
    }

    showDashboard();
    loadPracticeCoverage(user);
}
window.exitPracticeSession = exitPracticeSession;

// Dynamic Mouse-Following Gradient Border Glow
export function initDynamicBorderGlow() {
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
