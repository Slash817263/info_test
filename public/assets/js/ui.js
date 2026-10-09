import { openLightbox } from './auth.js';
import { $, $$, els } from './dom.js';
import { restartQuiz } from './quiz.js';
import { questions, state } from './state.js';
import { escapeHtml, parseImageUrls, showToast, formatTime } from './utils.js';
import { renderMath } from './math.js';

/* ========================================================================
   SCREEN MANAGEMENT
   ======================================================================== */
export function showScreen(screenId) {
    document.documentElement.classList.remove('app-preload-student', 'app-preload-quiz');
    $$('.screen').forEach(s => s.classList.remove('active'));
    $(`#screen-${screenId}`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ========================================================================
   DIAGNOSTIC CATEGORY REPORT RENDERING
   ======================================================================== */
export function renderCategoryDiagnosticSection(details) {
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
            statusBadge = `<span class="diagnostic-badge-critical">${pct === 0 ? 'Lipsuri majore' : 'De consolidat'}</span>`;
            feedbackNote = pct === 0 
                ? 'Nu ai rezolvat nicio cerință din această categorie.'
                : 'Necesită consolidare pe conceptele de bază.';
        } else if (pct < 75) {
            cardClass = 'medium';
            fillClass = 'medium';
            textColor = '#fbbf24';
            statusBadge = `<span class="diagnostic-badge-medium">Nivel mediu</span>`;
            feedbackNote = 'Înțelegere bună, cu mici ezitări pe cazurile particulare.';
        } else {
            cardClass = 'good';
            fillClass = 'good';
            textColor = '#34d399';
            statusBadge = `<span class="diagnostic-badge-good">Consolidat</span>`;
            feedbackNote = 'Conceptele din această categorie sunt bine consolidate.';
        }

        // Subcategories with errors (minimized chips)
        const weakSubcats = Object.entries(cat.subcategories)
            .filter(([_, data]) => data.wrong > 0)
            .map(([name, data]) => `<span class="diag-subcat-chip ${data.correct === 0 ? 'chip-zero' : 'chip-partial'}">${escapeHtml(name)}: <strong>${data.correct}/${data.total}</strong></span>`)
            .join(' ');

        return `
            <div class="diagnostic-cat-card ${cardClass}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <span style="font-size: 15px; font-weight: 700; color: #fff;">${escapeHtml(cat.name)}</span>
                    </div>
                    <div>
                        ${statusBadge}
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                    <span style="font-size: 12.5px; color: var(--text-secondary);">Răspunsuri corecte: <strong>${cat.correct} din ${cat.total}</strong> (${cat.wrong} ${cat.wrong === 1 ? 'greșeală' : 'greșeli'})</span>
                    <span style="font-size: 16px; font-weight: 800; color: ${textColor};">${pct}%</span>
                </div>

                <div class="diagnostic-progress-bar">
                    <div class="diagnostic-progress-fill ${fillClass}" style="width: ${pct}%;"></div>
                </div>

                <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin-bottom: ${weakSubcats ? '6px' : '0'};">
                    ${feedbackNote}
                </div>

                ${weakSubcats ? `
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.08); font-size: 11px; color: var(--text-muted); display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                        <span style="font-weight: 500; color: var(--text-muted); margin-right: 4px;">Subcapitole cu greșeli:</span> ${weakSubcats}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    return `
        <div class="diagnostic-category-section">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <h3 style="font-size: 16px; font-weight: 700; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
                    <span>📊</span> Raport pe Categorii de Materie
                </h3>
                <span class="diag-header-pill ${hasCritical ? 'critical' : 'stable'}">
                    ${hasCritical ? criticalCategories.length + ' ' + (criticalCategories.length === 1 ? 'categorie de consolidat' : 'categorii de consolidat') : 'Pregătire echilibrată'}
                </span>
            </div>

            ${hasCritical ? `
                <div class="diagnostic-alert-banner critical">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 1px; color: #f87171;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <div style="font-size: 13px; color: #e2e8f0; line-height: 1.5;">
                        Au fost identificate goluri de materie majore la <strong>${criticalCategories.map(c => c.name).join(', ')}</strong>.
                    </div>
                </div>
            ` : ''}

            <div class="diagnostic-cards-grid">
                ${cardsHtml}
            </div>
        </div>
    `;
}

/* ========================================================================
   RESULTS RENDERING
   ======================================================================== */
export function renderResults(results) {
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
            <div class="results-blur-notice">
                <span>⚠️ Ai părăsit pagina de ${state.blurCount} ${state.blurCount === 1 ? 'dată' : 'ori'} în timpul testului</span>
            </div>` : ''}

            ${renderCategoryDiagnosticSection(results.details)}

            <div class="review-section">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h3 style="margin:0;">Detalii întrebări</h3>
                    <button type="button" class="btn btn-ghost" style="padding:5px 12px; font-size:11.5px; border-radius:6px; font-weight:600;" onclick="toggleAllReviewItems()">
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
                                    <div style="font-size:11px; font-weight:700; color:var(--accent-purple); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Enunțul întrebării:</div>
                                    <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:10px; line-height:1.6; white-space:pre-wrap;">${escapeHtml(d.text.replace(/\\n/g, '\n'))}</div>
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

            <button class="btn btn-ghost btn-restart" onclick="restartQuiz()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Alte Teste
            </button>
        `;

    els.resultsContainer.innerHTML = html;
    renderMath(els.resultsContainer);
    animateScore(results.totalCorrect);
}

export function animateScore(target) {
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

export function getResultsText() {
    return `Rezultate Test C++ — ${state.studentUsername}`;
}


/* ========================================================================
   DASHBOARD HUB TABS & PWA INSTALLATION LOGIC
   ======================================================================== */
export function switchDashTab(tabName) {
    const btnSimulari = document.getElementById('tab-btn-simulari');
    const btnCapitole = document.getElementById('tab-btn-capitole');
    const paneSimulari = document.getElementById('dash-pane-simulari');
    const paneCapitole = document.getElementById('dash-pane-capitole');

    if (tabName === 'capitole') {
        if (btnCapitole) btnCapitole.classList.add('active');
        if (btnSimulari) btnSimulari.classList.remove('active');
        if (paneCapitole) paneCapitole.style.display = 'block';
        if (paneSimulari) paneSimulari.style.display = 'none';

        const list = document.getElementById('practice-categories-list');
        if (list && list.children.length === 0 && window.loadPracticeCoverage) {
            window.loadPracticeCoverage();
        }
    } else {
        if (btnSimulari) btnSimulari.classList.add('active');
        if (btnCapitole) btnCapitole.classList.remove('active');
        if (paneSimulari) paneSimulari.style.display = 'block';
        if (paneCapitole) paneCapitole.style.display = 'none';
    }
}
window.switchDashTab = switchDashTab;

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    const banner = document.getElementById('dash-pwa-banner');
    if (banner && localStorage.getItem('pwa_dismissed') !== '1') {
        banner.style.display = 'flex';
    }
});

export function dismissPWABanner() {
    try {
        localStorage.setItem('pwa_dismissed', '1');
    } catch (_) {}
    const banner = document.getElementById('dash-pwa-banner');
    if (banner) {
        banner.style.display = 'none';
    }
}
window.dismissPWABanner = dismissPWABanner;

window.installPWA = function() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
            const banner = document.getElementById('dash-pwa-banner');
            if (banner) banner.style.display = 'none';
            const installBtn = document.getElementById('btn-install-pwa');
            if (installBtn) {
                installBtn.style.display = 'none';
            }
        });
    } else {
        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIos) {
            showToast('Pe iOS: apasă pe butonul Partajare (Share din Safari) și alege „Adaugă pe ecranul principal”.', 6000);
        } else {
            showToast('Pentru instalare, deschide meniul browserului (⋮ sau Partajare) și alege „Instalează aplicația” sau „Adaugă pe ecran”.', 6000);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (!isStandalone) {
        const banner = document.getElementById('dash-pwa-banner');
        if (banner && localStorage.getItem('pwa_dismissed') !== '1') {
            banner.style.display = 'flex';
        }
    }
});
