const API_RESULTS = '/.netlify/functions/fetch-results';
const API_QUESTIONS = '/.netlify/functions/fetch-questions';
const API_MANAGE_Q = '/.netlify/functions/manage-questions';
const API_DEL_RESULT = '/.netlify/functions/delete-result';
const API_FETCH_WAITING = '/.netlify/functions/fetch-waiting-questions';
const API_MANAGE_WAITING = '/.netlify/functions/manage-waiting-questions';
const API_MANAGE_STUDENTS = '/.netlify/functions/manage-students';
const API_ASSIGNED_TESTS = '/.netlify/functions/manage-assigned-tests';

// Token-ul este gestionat acum 100% de browser (HttpOnly cookie)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('token')) {
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
}

function normalizeSearchText(str) {
    if (!str) return '';
    return str.toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[șş]/g, 's')
        .replace(/[țţ]/g, 't')
        .trim();
}



const fetchWithToken = async (url, options = {}) => {
    // Cererile vor trimite automat cookie-ul HttpOnly
    try {
        const res = await fetch(url, options);
        if (res.status === 401 || res.status === 403) {
            showToast('Sesiune expirată sau neautorizată.', true);
            setTimeout(() => { window.location.href = '/admin-login.html'; }, 1500);
        }
        return res;
    } catch (e) {
        throw e;
    }
};

let resultsData = [];
let questionsData = [];
let waitingQuestionsData = [];
let currentWaitingEditId = null;
let studentsData = [];

const subcategoriesMap = {
    "Fundamente": ["Citire si afisare date", "Operatori si expresii", "Structuri de control", "Complexitati", "Pseudocod"],
    "Organizarea Datelor": ["Vectori", "Matrice", "Siruri de caractere", "Structuri de date (struct)"],
    "Subprograme": ["Transmitere prin valoare", "Transmitere prin referinta", "Recursivitate"],
    "Backtracking": ["Teorie si aplicare practica"],
    "Grafuri si Arbori": ["Terminologie grafuri", "Grafuri orientate", "Grafuri neorientate", "Arbori"]
};

let currentExamTab = 'Initial'; // Default
window.setExamTab = function (type) {
    currentExamTab = type;
    document.getElementById('tab-intrebari-title').textContent = 'Bază de Întrebări - ' + type;
    renderQuestions();
};

/* ==================== UTILS ==================== */
const escapeHtml = (text) => { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; };
const formatCodeText = (code) => {
    if (!code) return '';
    return String(code).replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '    ');
};
const formatQuestionText = (text) => {
    if (!text) return '';
    return String(text).replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
};
const formatTime = (ms) => { const sec = Math.floor(ms / 1000); return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`; };
const formatDate = (iso) => new Date(iso).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

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

const MONTH_NAMES_RO = [
    '01 - Ianuarie', '02 - Februarie', '03 - Martie', '04 - Aprilie',
    '05 - Mai', '06 - Iunie', '07 - Iulie', '08 - August',
    '09 - Septembrie', '10 - Octombrie', '11 - Noiembrie', '12 - Decembrie'
];

function initDateTimeSelects(prefix) {
    const dayEl = document.getElementById(`${prefix}-day`);
    const monthEl = document.getElementById(`${prefix}-month`);
    const yearEl = document.getElementById(`${prefix}-year`);
    const hourEl = document.getElementById(`${prefix}-hour`);

    if (dayEl && dayEl.options.length === 0) {
        for (let d = 1; d <= 31; d++) {
            const val = String(d).padStart(2, '0');
            dayEl.add(new Option(val, val));
        }
    }
    if (monthEl && monthEl.options.length === 0) {
        MONTH_NAMES_RO.forEach((mName, idx) => {
            const val = String(idx + 1).padStart(2, '0');
            monthEl.add(new Option(mName, val));
        });
    }
    if (yearEl && yearEl.options.length === 0) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y <= currentYear + 3; y++) {
            yearEl.add(new Option(String(y), String(y)));
        }
    }
    if (hourEl && hourEl.options.length === 0) {
        for (let h = 0; h < 24; h++) {
            const val = String(h).padStart(2, '0');
            hourEl.add(new Option(`${val}:00`, val));
        }
    }
}

function setDateTimeSelects(prefix, targetDate) {
    initDateTimeSelects(prefix);
    const d = targetDate instanceof Date ? targetDate : new Date(targetDate);
    if (isNaN(d.getTime())) return;

    const dayEl = document.getElementById(`${prefix}-day`);
    const monthEl = document.getElementById(`${prefix}-month`);
    const yearEl = document.getElementById(`${prefix}-year`);
    const hourEl = document.getElementById(`${prefix}-hour`);

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    const hh = String(d.getHours()).padStart(2, '0');

    if (dayEl) dayEl.value = dd;
    if (monthEl) monthEl.value = mm;
    if (yearEl) yearEl.value = yyyy;
    if (hourEl) hourEl.value = hh;
}

function getDateTimeFromSelects(prefix) {
    const dayEl = document.getElementById(`${prefix}-day`);
    const monthEl = document.getElementById(`${prefix}-month`);
    const yearEl = document.getElementById(`${prefix}-year`);
    const hourEl = document.getElementById(`${prefix}-hour`);

    if (!dayEl || !monthEl || !yearEl || !hourEl) return null;

    const day = parseInt(dayEl.value);
    const month = parseInt(monthEl.value) - 1;
    const year = parseInt(yearEl.value);
    const hour = parseInt(hourEl.value);

    const dt = new Date(year, month, day, hour, 0, 0, 0);
    return dt.toISOString();
}

function setAssignQuickDate(daysFromNow, hour = 20) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    setDateTimeSelects('assign', d);
    updateAssignDeadlinePreview();
}
window.setAssignQuickDate = setAssignQuickDate;

function setEditDeadlineQuickDate(daysFromNow, hour = 20) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    setDateTimeSelects('edit-deadline', d);
    updateEditDeadlinePreview();
}
window.setEditDeadlineQuickDate = setEditDeadlineQuickDate;

function updateAssignDeadlinePreview() {
    const iso = getDateTimeFromSelects('assign');
    const preview = document.getElementById('assign-deadline-preview');
    if (!preview) return;
    if (iso) {
        preview.textContent = `📅 Termen: ${formatEuropeanDateTime(iso)} (Format 24h)`;
    } else {
        preview.textContent = '📅 Termen: Selectează data și ora';
    }
}
window.updateAssignDeadlinePreview = updateAssignDeadlinePreview;

function updateEditDeadlinePreview() {
    const iso = getDateTimeFromSelects('edit-deadline');
    const preview = document.getElementById('edit-deadline-preview');
    if (!preview) return;
    if (iso) {
        preview.textContent = `📅 Termen: ${formatEuropeanDateTime(iso)} (Format 24h)`;
    } else {
        preview.textContent = '📅 Termen: Selectează data și ora';
    }
}
window.updateEditDeadlinePreview = updateEditDeadlinePreview;

function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast show ${isError ? 'error' : ''}`;
    setTimeout(() => t.className = 'toast', 2500);
}

/* ==================== TABS ==================== */
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');

        if (btn.dataset.target === 'tab-rezultate') {
            closeSituatieDetail();
            loadSituatie();
        }
        if (btn.dataset.target === 'tab-intrebari' && questionsData.length === 0) loadQuestions();
        if (btn.dataset.target === 'tab-waiting') loadWaitingQuestions();
        if (btn.dataset.target === 'tab-elevi' && studentsData.length === 0) loadStudents();
        if (btn.dataset.target === 'tab-leads') loadLeads();
    });
});

/* ==================== REZULTATE ==================== */
async function loadResults() {
    try {
        const res = await fetchWithToken(API_RESULTS);
        if (!res.ok) throw new Error();
        resultsData = await res.json();
    } catch (e) {
        console.error('Error loading results:', e);
    }
}

function getAdminTestInfo(r) {
    const rawType = (r.test_type || 'initial').toLowerCase().trim();
    const isAssigned = r.assigned_test_id || rawType === 'tema' || rawType.startsWith('tema');
    const isInitial = !isAssigned && (rawType === 'initial' || rawType.startsWith('initial') || !r.test_type);

    let examCategory = r.exam_type || '';
    if (!examCategory && (rawType.includes(':') || (rawType.includes('_') && !rawType.startsWith('progress_')))) {
        examCategory = rawType.split(/[:_]/)[1];
    }

    if (!examCategory && Array.isArray(r.details_json) && r.details_json.length > 0) {
        const firstWithExam = r.details_json.find(d => d && d.exam_type);
        if (firstWithExam) {
            examCategory = firstWithExam.exam_type;
        } else {
            const has6Opts = r.details_json.some(d => d && Array.isArray(d.options) && d.options.length > 4);
            if (has6Opts) {
                examCategory = 'Poli';
            } else if (r.details_json.length === 9) {
                examCategory = 'Academie';
            } else if (r.details_json.length === 50) {
                examCategory = 'Inițial';
            } else {
                examCategory = 'Diverse';
            }
        }
    }

    if (isInitial) {
        return {
            title: 'Test Inițial',
            label: '📋 Inițial',
            badge: '<span class="badge badge-easy">Inițial</span>'
        };
    }
    if (isAssigned) {
        const cat = examCategory && examCategory !== 'Initial' ? examCategory : 'BAC';
        return {
            title: `Temă (${cat})`,
            label: `📚 TEMĂ (${cat})`,
            badge: `<span class="badge" style="background:rgba(124,106,255,0.2); color:#c4b5fd; border:1px solid rgba(124,106,255,0.4);">TEMĂ (${cat})</span>`
        };
    }
    if (examCategory === 'Zilnic' || rawType.includes('zilnic')) {
        return {
            title: 'Test Zilnic Adaptiv',
            label: '🎯 Zilnic',
            badge: '<span class="badge" style="background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.4);">🎯 Zilnic</span>'
        };
    }
    const cat = examCategory || 'Diverse';
    return {
        title: `Test Intermediar (${cat})`,
        label: `🎯 Intermediar (${cat})`,
        badge: `<span class="badge badge-medium">Intermediar (${cat})</span>`
    };
}



/* ==================== MODAL DETALII REZULTAT ==================== */
let currentSelectedResult = null;
let currentDetailsFilter = 'all';

function openDetailsModal(resultId, defaultFilter = 'all') {
    let r = resultsData.find(x => x.id == resultId);
    if (!r && Array.isArray(window.lastLoadedResults)) {
        r = window.lastLoadedResults.find(x => x.id == resultId);
    }
    if (!r) {
        showToast('Eroare: Rezultatul nu a fost găsit în datele încărcate.', true);
        return;
    }
    currentSelectedResult = r;
    currentDetailsFilter = defaultFilter;

    const pct = Math.round((r.score / r.total_points) * 100) || 0;
    const testInfo = getAdminTestInfo(r);
    const testTitle = testInfo.title || 'Test';
    document.getElementById('details-student-name').textContent = `Rezultat: ${r.student_name || r.student_username || 'Anonim'}`;
    document.getElementById('details-student-meta').textContent = `${testTitle} • Scor: ${r.score || 0}/${r.total_points || 0} (${pct}%) • Timp: ${formatTime(r.time_taken_ms || 0)} • ${r.blur_count || 0} pierderi focus`;

    let details = r.details_json;
    if (typeof details === 'string') {
        try { details = JSON.parse(details); } catch (e) { details = []; }
    }
    if (!Array.isArray(details)) {
        if (details && typeof details === 'object') {
            details = Object.values(details);
        } else {
            details = [];
        }
    }

    const totalQs = details.length;
    const correctQs = details.filter(d => d && (d.isCorrect === true || d.is_correct === true || d.correct === true || (d.studentAnswer !== null && d.studentAnswer !== undefined && d.studentAnswer === d.correctAnswer))).length;
    const wrongQs = totalQs - correctQs;

    document.getElementById('count-all').textContent = totalQs;
    document.getElementById('count-wrong').textContent = wrongQs;
    document.getElementById('count-correct').textContent = correctQs;

    // Reset filter buttons UI
    document.querySelectorAll('.details-filter-btn').forEach(btn => btn.classList.remove('active'));
    const defaultFilterBtn = document.getElementById('filter-btn-' + defaultFilter);
    if (defaultFilterBtn) defaultFilterBtn.classList.add('active');

    renderDetailsList(details, defaultFilter);
    document.getElementById('modal-details').style.display = 'flex';
}

window.viewResultDetails = openDetailsModal;

function closeDetailsModal() {
    document.getElementById('modal-details').style.display = 'none';
}

/* ==================== MODAL RAPORT ==================== */
async function openReportModal(resultId) {
    const r = resultsData.find(x => x.id == resultId);
    if (!r) return;

    // Ensure questions are loaded so we can get categories
    if (questionsData.length === 0) {
        try {
            await loadQuestions();
        } catch (e) {
            console.error("Failed to load questions", e);
        }
    }

    const pct = Math.round((r.score / r.total_points) * 100) || 0;
    document.getElementById('report-student-name').textContent = `Raport: ${r.student_name || 'Anonim'}`;
    document.getElementById('report-student-meta').textContent = `Scor: ${r.score || 0}/${r.total_points || 0} (${pct}%)`;

    let details = r.details_json;
    if (typeof details === 'string') {
        try { details = JSON.parse(details); } catch (e) { details = []; }
    }
    if (!Array.isArray(details)) details = [];

    // Aggregate data
    const stats = {};
    details.forEach(item => {
        // Find original question in questionsData to get category and subcategory
        // Using loose equality (==) for id, and fallback to text match for older results that lacked item.id
        let orig = questionsData.find(q => item.id && q.id == item.id);
        if (!orig && item.text) {
            orig = questionsData.find(q => q.text === item.text);
        }

        // For old tests, we fallback to 'Altele' / 'Nespecificat' if question was completely deleted
        const cat = orig?.category || 'Altele';
        const subcat = orig?.subcategory || 'Nespecificat';

        if (!stats[cat]) stats[cat] = {};
        if (!stats[cat][subcat]) stats[cat][subcat] = { total: 0, correct: 0 };

        stats[cat][subcat].total++;
        if (item.isCorrect) {
            stats[cat][subcat].correct++;
        }
    });

    // Build rich category diagnostic cards
    const categoryList = Object.entries(stats).map(([catName, subcats]) => {
        let catTotal = 0;
        let catCorrect = 0;
        Object.values(subcats).forEach(s => {
            catTotal += s.total;
            catCorrect += s.correct;
        });
        const catWrong = catTotal - catCorrect;
        const pct = Math.round((catCorrect / catTotal) * 100) || 0;
        return {
            name: catName,
            total: catTotal,
            correct: catCorrect,
            wrong: catWrong,
            pct: pct,
            subcategories: subcats
        };
    });

    categoryList.sort((a, b) => (a.correct / a.total) - (b.correct / b.total));
    const criticalList = categoryList.filter(c => c.pct < 50);
    const hasCritical = criticalList.length > 0;

    let html = `
        <div style="margin-bottom: 20px;">
            <div class="diagnostic-alert-banner ${hasCritical ? 'critical' : 'stable'}" style="margin-bottom: 16px;">
                <span style="font-size: 22px; flex-shrink: 0;">${hasCritical ? '🚨' : '📊'}</span>
                <div style="font-size: 13px; color: #e2e8f0; line-height: 1.5;">
                    ${hasCritical
            ? `<strong>Atenție:</strong> Elevul are lipsuri majore la <strong>${criticalList.map(c => c.name).join(', ')}</strong>. Este necesară o intervenție didactică pe aceste capitole.`
            : `Elevul are o bază echilibrată. Continuă cu consolidarea noțiunilor unde au apărut ezitări.`}
                </div>
            </div>
            <div class="diagnostic-cards-grid">
                ${categoryList.map(cat => {
                let cardClass = 'good';
                let fillClass = 'good';
                let textColor = '#34d399';
                let badge = '<span class="diagnostic-badge-good">✔️ Bine Consolidat</span>';

                if (cat.pct < 50) {
                    cardClass = 'critical';
                    fillClass = 'critical';
                    textColor = '#f87171';
                    badge = `<span class="diagnostic-badge-critical">⚠️ ${cat.pct === 0 ? '0%! Lipsuri Majore' : 'Nivel Critic'}</span>`;
                } else if (cat.pct < 75) {
                    cardClass = 'medium';
                    fillClass = 'medium';
                    textColor = '#fbbf24';
                    badge = '<span class="diagnostic-badge-medium">⚠️ Nivel Mediu</span>';
                }

                const subItems = Object.entries(cat.subcategories).map(([subName, sData]) => {
                    const sPct = Math.round((sData.correct / sData.total) * 100);
                    const sColor = sPct >= 75 ? 'var(--accent-green)' : (sPct >= 50 ? '#fbbf24' : 'var(--accent-red)');
                    const sIcon = sPct >= 75 ? '✔️' : (sPct >= 50 ? '⚠️' : '❌');
                    return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 12px; margin-top: 4px; border: 1px solid rgba(255,255,255,0.05);">
                                <span style="color: var(--text-primary);">${escapeHtml(subName)}</span>
                                <span style="font-weight: 700; color: ${sColor};">${sData.correct}/${sData.total} (${sPct}%) ${sIcon}</span>
                            </div>
                        `;
                }).join('');

                return `
                        <div class="diagnostic-cat-card ${cardClass}">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-size: 15px; font-weight: 800; color: #fff;">${escapeHtml(cat.name)}</span>
                                ${badge}
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                                <span style="font-size: 12px; color: var(--text-secondary);">${cat.correct} din ${cat.total} corecte (${cat.wrong} greșite)</span>
                                <span style="font-size: 16px; font-weight: 800; color: ${textColor};">${cat.pct}%</span>
                            </div>
                            <div class="diagnostic-progress-bar">
                                <div class="diagnostic-progress-fill ${fillClass}" style="width: ${cat.pct}%;"></div>
                            </div>
                            <div style="margin-top: 8px;">
                                ${subItems}
                            </div>
                        </div>
                    `;
            }).join('')}
            </div>
        </div>
    `;

    if (categoryList.length === 0) {
        html = '<div style="text-align:center; padding: 20px; color: var(--text-secondary);">Nu există date de afișat.</div>';
    }

    document.getElementById('report-content').innerHTML = html;
    document.getElementById('modal-report').style.display = 'flex';
}

function closeReportModal() {
    document.getElementById('modal-report').style.display = 'none';
}

function setDetailsFilter(filterType, btn) {
    currentDetailsFilter = filterType;
    document.querySelectorAll('.details-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (!currentSelectedResult) return;
    let details = currentSelectedResult.details_json;
    if (typeof details === 'string') {
        try { details = JSON.parse(details); } catch (e) { }
    }
    if (!Array.isArray(details)) details = [];
    renderDetailsList(details, filterType);
}

function renderDetailsList(details, filter) {
    const container = document.getElementById('details-list');
    if (!details || details.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary);">Nu există detalii stocate pentru acest test (răspunsurile individuale nu au fost salvate).</div>`;
        return;
    }

    const filtered = details.filter(d => {
        if (!d) return false;
        const isOk = d.isCorrect === true || d.is_correct === true || d.correct === true || (d.studentAnswer !== null && d.studentAnswer !== undefined && d.studentAnswer === d.correctAnswer);
        if (filter === 'wrong') return !isOk;
        if (filter === 'correct') return isOk;
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary);">Nicio întrebare găsită pentru filtrul selectat.</div>`;
        return;
    }

    const html = filtered.map((item, idx) => {
        if (!item) return '';
        const isOk = item.isCorrect === true || item.is_correct === true || item.correct === true || (item.studentAnswer !== null && item.studentAnswer !== undefined && item.studentAnswer === item.correctAnswer);
        const statusBadge = isOk
            ? `<span class="score-badge score-excellent">✔️ Corect</span>`
            : `<span class="score-badge score-low">❌ Greșit</span>`;

        const diffMap = { easy: 'Ușoară', medium: 'Medie', hard: 'Grea' };
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
                tagHtml = `<span class="detail-opt-tag tag-wrong">Ales de student (Incorect)</span>`;
            }

            const optLetter = String.fromCharCode(65 + optIdx); // A, B, C, D
            return `
                        <div class="detail-opt ${optClass}">
                            <span><strong>${optLetter}.</strong> ${escapeHtml(optText)}</span>
                            ${tagHtml}
                        </div>
                    `;
        }).join('');

        const formattedCode = formatCodeText(item.code);
        const formattedText = formatQuestionText(item.text);
        const codeHtml = formattedCode ? `<div class="detail-code" style="background:#0c0d1e; padding:10px; border-radius:6px; font-size:13px; color:#a6accd; margin:8px 0; max-width:100%; overflow-x:auto;"><pre style="margin:0; font-family: monospace; white-space: pre-wrap; word-break: break-word;">${escapeHtml(formattedCode)}</pre></div>` : '';
        const itemImgs = parseImageUrls(item.image_url);
        const imageHtml = itemImgs.length > 0 ? `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; margin:12px auto; text-align:center; width:100%;">
                ${itemImgs.map(u => `<img src="${u}" style="max-height:220px; max-width:100%; border-radius:8px; border:1px solid rgba(255,255,255,0.1); margin:0 auto; display:block; box-shadow:0 4px 12px rgba(0,0,0,0.3); cursor:zoom-in;" onclick="openAdminLightbox('${u}')" title="Click pentru mărire">`).join('')}
            </div>` : '';
        const hintHtml = (item.hint || item.explanation) ? `<div style="margin-top:8px; font-size:12px; color:var(--text-secondary); background:rgba(255,255,255,0.03); padding:6px 10px; border-radius:6px; border-left:3px solid var(--accent-purple);">💡 <em>${escapeHtml(item.hint || item.explanation)}</em></div>` : '';

        return `
                    <div class="detail-card ${isOk ? 'correct' : 'wrong'}" style="overflow: hidden;">
                        <div class="detail-header">
                            <div>
                                <span style="font-weight:700; color:var(--accent-purple); font-size:13px;">#${item.number || (idx + 1)}</span>
                                <span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-secondary); margin-left:6px;">Dificultate: ${diffLabel}</span>
                            </div>
                            <div>${statusBadge}</div>
                        </div>
                        <div style="font-size:15px; font-weight:600; color:var(--text-primary); margin-bottom:8px; white-space:pre-wrap; word-break:break-word;">${escapeHtml(formattedText)}</div>
                        ${codeHtml}
                        ${imageHtml}
                        <div style="margin-top:12px;">${optsHtml}</div>
                        ${hintHtml}
                    </div>
                `;
    }).join('');

    container.innerHTML = html;
}

/* ==================== INTREBARI CMS ==================== */

function updateFilterCounts() {
    const catSelect = document.getElementById('filter-cat');
    if (!catSelect) return;
    const currentCat = catSelect.value;
    catSelect.innerHTML = '<option value="">Toate categoriile</option>';
    Object.keys(subcategoriesMap).forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === currentCat) opt.selected = true;
        catSelect.appendChild(opt);
    });
}

function initFilters() {
    const catSelect = document.getElementById('filter-cat');
    catSelect.innerHTML = '<option value="">Toate categoriile</option>';
    Object.keys(subcategoriesMap).forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat; opt.textContent = cat;
        catSelect.appendChild(opt);
    });
}

function updateFilterSub() {
    const cat = document.getElementById('filter-cat').value;
    const subSelect = document.getElementById('filter-sub');
    subSelect.innerHTML = '<option value="">Toate subcategoriile</option>';
    if (cat && subcategoriesMap[cat]) {
        subcategoriesMap[cat].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            subSelect.appendChild(opt);
        });
    }
}

async function loadQuestions() {
    try {
        initFilters();
        const res = await fetchWithToken(API_QUESTIONS + '?admin=true');
        if (!res.ok) throw new Error();
        questionsData = await res.json();

        // ADDED DYNAMIC COUNTS
        if (typeof updateFilterCounts === 'function') updateFilterCounts();
        const loadingEl = document.getElementById('loading-questions');
        if (loadingEl) loadingEl.style.display = 'none';

        if (questionsData.length === 0) {
            const emptyEl = document.getElementById('empty-questions');
            if (emptyEl) emptyEl.style.display = 'block';
        } else {
            const wrapEl = document.getElementById('wrapper-questions');
            if (wrapEl) wrapEl.style.display = 'block';
            if (document.getElementById('filter-cat')) renderQuestions();
        }
    } catch (e) {
        const loadingEl = document.getElementById('loading-questions');
        if (loadingEl) loadingEl.innerHTML = `<p style="color:var(--accent-red)">Eroare la încărcare întrebări.</p>`;
    }
}

function toggleSubcategory(id) {
    const el = document.getElementById('sub-list-' + id);
    if (el.classList.contains('open')) el.classList.remove('open');
    else el.classList.add('open');
}

function renderQuestions() {
    const wrapper = document.getElementById('wrapper-questions');
    const fCat = document.getElementById('filter-cat').value;
    const fSub = document.getElementById('filter-sub').value;
    const fDiff = document.getElementById('filter-diff').value;
    const fSearch = normalizeSearchText(document.getElementById('filter-search').value);

    // Calculate counts for tabs
    const counts = { 'Initial': 0, 'Academie': 0, 'Poli': 0, 'BAC': 0, 'Diverse': 0 };
    questionsData.forEach(q => {
        const qType = q.exam_type || 'Diverse';
        ['Initial', 'Academie', 'Poli', 'BAC', 'Diverse'].forEach(tab => {
            if (qType.includes(tab)) counts[tab]++;
        });
    });

    // Update tab texts
    ['Initial', 'Academie', 'Poli', 'BAC', 'Diverse'].forEach(tab => {
        const el = document.getElementById(`tab-count-${tab}`);
        if (el) el.textContent = counts[tab];
    });

    // Filter data for the current view
    const filtered = questionsData.filter(q => {
        const qType = q.exam_type || 'Diverse';
        if (!qType.includes(currentExamTab) && currentExamTab !== 'Toate') return false;
        if (fCat && q.category !== fCat) return false;
        if (fSub && q.subcategory !== fSub) return false;
        if (fDiff && q.difficulty !== fDiff) return false;
        if (fSearch && !normalizeSearchText(q.text || '').includes(fSearch)) return false;
        return true;
    });

    if (filtered.length === 0) {
        wrapper.style.display = 'none';
        document.getElementById('empty-questions').style.display = 'block';
        return;
    }

    document.getElementById('empty-questions').style.display = 'none';
    wrapper.style.display = 'block';

    // Group by category -> subcategory
    const grouped = {};
    filtered.forEach(q => {
        const c = q.category || 'Altele';
        const s = q.subcategory || 'Fără subcategorie';
        if (!grouped[c]) grouped[c] = {};
        if (!grouped[c][s]) grouped[c][s] = [];
        grouped[c][s].push(q);
    });

    const htmlArr = [];
    let subIdCounter = 0;

    // Define the canonical order from subcategoriesMap + any 'Altele'
    const orderedCategories = Object.keys(subcategoriesMap);
    Object.keys(grouped).forEach(cat => {
        if (!orderedCategories.includes(cat)) orderedCategories.push(cat);
    });

    orderedCategories.forEach(cat => {
        if (!grouped[cat]) return; // no questions for this category

        htmlArr.push(`<div class="category-group">`);

        // Calc total in category
        let catTotal = 0;
        Object.values(grouped[cat]).forEach(arr => catTotal += arr.length);

        htmlArr.push(`<div class="category-header">
                    <span>${escapeHtml(cat)}</span>
                    <span style="font-size:12px; font-weight:600; color:var(--text-secondary)">${catTotal} întrebări</span>
                </div>`);

        const orderedSubcategories = subcategoriesMap[cat] ? [...subcategoriesMap[cat]] : [];
        Object.keys(grouped[cat]).forEach(sub => {
            if (!orderedSubcategories.includes(sub)) orderedSubcategories.push(sub);
        });

        orderedSubcategories.forEach(sub => {
            if (!grouped[cat][sub]) return;
            const qs = grouped[cat][sub];

            subIdCounter++;
            // If filters are active, auto-expand
            const autoOpen = (fSub !== '' || fSearch !== '') ? 'open' : '';

            htmlArr.push(`<div class="subcategory-group">
                        <div class="subcategory-header" onclick="toggleSubcategory(${subIdCounter})">
                            <span>${escapeHtml(sub)}</span>
                            <span>${qs.length} <span style="font-size:10px">▼</span></span>
                        </div>
                        <div class="questions-list ${autoOpen}" id="sub-list-${subIdCounter}">`);

            qs.forEach(q => {
                const diffMap = { easy: { l: 'Ușor', c: 'badge-easy' }, medium: { l: 'Mediu', c: 'badge-medium' }, hard: { l: 'Greu', c: 'badge-hard' } };
                const df = diffMap[q.difficulty] || { l: q.difficulty, c: 'badge-easy' };
                const typeLabel = q.type === 'code' ? 'Cod' : 'Grilă';

                htmlArr.push(`
                            <div class="question-item">
                                <div style="flex:1">
                                    <div class="q-meta">
                                        <span style="font-family:var(--font-code); color:var(--text-muted); font-size:12px;">#${q.id}</span>
                                        <span class="badge ${df.c}">${df.l}</span>
                                        <span class="badge" style="background:rgba(102,126,234,0.15); color:var(--accent-blue)">${typeLabel}</span>
                                    </div>
                                    <div class="q-text">${escapeHtml(q.text.replace(/\\n/g, '\n'))}</div>
                                </div>
                                <div class="actions">
                                    <button class="btn btn-edit" onclick="editQuestion(${q.id})">Editează</button>
                                    <button class="btn btn-danger" onclick="deleteQuestion(${q.id})">Șterge</button>
                                </div>
                            </div>
                        `);
            });

            htmlArr.push(`</div></div>`);
        });
        htmlArr.push(`</div>`);
    });

    wrapper.innerHTML = htmlArr.join('');
}

async function deleteQuestion(id) {
    if (!confirm("Sigur ștergi întrebarea din baza de date?")) return;
    try {
        const res = await fetchWithToken(`${API_MANAGE_Q}?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Întrebare ștearsă!');
            questionsData = questionsData.filter(q => q.id !== id);
            renderQuestions();
        } else {
            let errMsg = 'Eroare la ștergere';
            try {
                const err = await res.json();
                if (err.error) errMsg = err.error;
            } catch (e) { }
            showToast(errMsg, true);
        }
    } catch (e) { showToast('Eroare de rețea', true); }
}

/* ==================== CMS MODAL LOGIC ==================== */
function updateSubcategories(selectedSub = '') {
    const cat = document.getElementById('q-category').value;
    const subSel = document.getElementById('q-subcategory');
    if (!subSel) return;
    subSel.innerHTML = '<option value="">-- Alege Subcategorie --</option>';
    if (cat && subcategoriesMap[cat]) {
        subcategoriesMap[cat].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            subSel.appendChild(opt);
        });
    }
    if (selectedSub) {
        const normSelected = String(selectedSub).trim().toLowerCase();
        const match = Array.from(subSel.options).find(o => o.value.trim().toLowerCase() === normSelected);
        if (match) {
            subSel.value = match.value;
        } else {
            const customOpt = document.createElement('option');
            customOpt.value = String(selectedSub).trim();
            customOpt.textContent = String(selectedSub).trim();
            subSel.appendChild(customOpt);
            subSel.value = customOpt.value;
        }
    }
}

let cmEditor = null;

function initCodeMirror() {
    if (!cmEditor) {
        cmEditor = CodeMirror.fromTextArea(document.getElementById('q-code'), {
            mode: "text/x-c++src",
            theme: "dracula",
            lineNumbers: true,
            viewportMargin: Infinity
        });
    }
}

function updateCorrectDropdown(forceSelectIdx = null) {
    const correctSelect = document.getElementById('q-correct');
    if (!correctSelect) return;

    const optInputs = [
        document.getElementById('q-opt-0') ? document.getElementById('q-opt-0').value.trim() : '',
        document.getElementById('q-opt-1') ? document.getElementById('q-opt-1').value.trim() : '',
        document.getElementById('q-opt-2') ? document.getElementById('q-opt-2').value.trim() : '',
        document.getElementById('q-opt-3') ? document.getElementById('q-opt-3').value.trim() : '',
        document.getElementById('q-opt-4') ? document.getElementById('q-opt-4').value.trim() : '',
        document.getElementById('q-opt-5') ? document.getElementById('q-opt-5').value.trim() : ''
    ];

    let lastFilledIdx = -1;
    for (let i = 0; i < optInputs.length; i++) {
        if (optInputs[i] !== '') lastFilledIdx = i;
    }

    const availableCount = Math.max(2, lastFilledIdx + 1);
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    const currentVal = forceSelectIdx !== null ? forceSelectIdx : parseInt(correctSelect.value || '0');

    let html = '';
    for (let i = 0; i < availableCount; i++) {
        html += `<option value="${i}">Opțiunea ${letters[i]}</option>`;
    }
    correctSelect.innerHTML = html;

    if (currentVal >= 0 && currentVal < availableCount) {
        correctSelect.value = String(currentVal);
    } else {
        correctSelect.value = '0';
    }
}
window.updateCorrectDropdown = updateCorrectDropdown;

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
            } catch (e) { }
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
window.parseImageUrls = parseImageUrls;

let currentQuestionImages = []; // Array of { type: 'url'|'file', url: string, file?: File, previewUrl?: string }

function addDroppedOrPastedFiles(files, sourceDesc = 'Fișier') {
    if (!files || files.length === 0) return;
    let addedCount = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/') && !file.name.match(/\.(png|jpe?g|webp|gif|bmp|svg)$/i)) {
            continue;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast(`Fișierul ${file.name || 'atașat'} depășește limita de 5MB!`, true);
            continue;
        }

        let previewUrl = '';
        try {
            previewUrl = URL.createObjectURL(file);
        } catch (e) {
            console.warn('URL.createObjectURL failed:', e);
        }

        const imgObj = { type: 'file', file, previewUrl };
        currentQuestionImages.push(imgObj);
        addedCount++;

        // Convert immediately to DataURL (base64) so thumbnail displays 100% reliably in all browsers and under any CSP
        if (window.FileReader) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imgObj.previewUrl = e.target.result;
                renderQuestionImagesManager();
            };
            reader.readAsDataURL(file);
        }
    }
    if (addedCount > 0) {
        renderQuestionImagesManager();
        if (sourceDesc === 'Clipboard') {
            showToast('📋 Imagine adăugată din Clipboard / Snipping Tool!');
        } else if (sourceDesc === 'Drag & Drop') {
            showToast(`📥 ${addedCount} ${addedCount === 1 ? 'imagine adăugată' : 'imagini adăugate'} prin Drag & Drop!`);
        }
    }
}
window.addDroppedOrPastedFiles = addDroppedOrPastedFiles;

function openAdminLightbox(url) {
    if (!url) return;
    const modal = document.getElementById('admin-lightbox-modal');
    const img = document.getElementById('admin-lightbox-img');
    if (modal && img) {
        img.src = url;
        modal.style.display = 'flex';
    }
}
window.openAdminLightbox = openAdminLightbox;

function closeAdminLightbox() {
    const modal = document.getElementById('admin-lightbox-modal');
    if (modal) {
        modal.style.display = 'none';
        const img = document.getElementById('admin-lightbox-img');
        if (img) img.src = '';
    }
}
window.closeAdminLightbox = closeAdminLightbox;

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAdminLightbox();
    }
});

function renderQuestionImagesManager() {
    const list = document.getElementById('q-images-preview-list');
    const badge = document.getElementById('q-images-count-badge');
    if (!list) return;

    if (badge) {
        badge.textContent = `${currentQuestionImages.length} ${currentQuestionImages.length === 1 ? 'imagine' : 'imagini'}`;
    }

    if (currentQuestionImages.length === 0) {
        list.innerHTML = `
            <div class="q-img-drop-empty" onclick="document.getElementById('q-image-files').click()">
                <div class="q-img-drop-icon">📥 ✂️ 📋</div>
                <div class="q-img-drop-title">Trage & plasează imagini aici sau apasă <kbd>Ctrl + V</kbd></div>
                <div class="q-img-drop-sub">Suportă capturi din Snipping Tool / Clipboard, fișiere PNG, JPG, WebP (max 5MB)</div>
            </div>
        `;
        return;
    }

    let cardsHtml = currentQuestionImages.map((img, idx) => {
        const displaySrc = img.type === 'file' ? img.previewUrl : img.url;
        const label = img.type === 'file' ? (img.file ? img.file.name : 'Fișier nou') : 'Link Web';
        return `
            <div class="q-img-card">
                <img src="${displaySrc}" alt="Imagine ${idx + 1}" onclick="openAdminLightbox('${displaySrc}')" style="cursor:zoom-in;" title="Click pentru mărire imagine (ESC pentru a închide)">
                <div class="q-img-info" title="${escapeHtml(label)}">#${idx + 1} ${escapeHtml(label)}</div>
                <button type="button" class="q-img-del-btn" onclick="removeQuestionImage(${idx})">🗑️ Șterge</button>
            </div>
        `;
    }).join('');

    cardsHtml += `
        <div class="q-img-card q-img-card-add" onclick="document.getElementById('q-image-files').click()" title="Apasă pentru a alege fișier, trage imagini sau apasă Ctrl+V">
            <div style="font-size: 24px; margin-bottom: 2px;">➕</div>
            <div style="font-size: 11px; font-weight: 700; color: var(--accent-purple);">Adaugă / Paste</div>
            <div style="font-size: 9px; color: var(--text-muted); text-align: center;">Trage fișiere sau <kbd style="background:rgba(255,255,255,0.1); padding:1px 3px; border-radius:3px;">Ctrl+V</kbd></div>
        </div>
    `;

    list.innerHTML = cardsHtml;
}
window.renderQuestionImagesManager = renderQuestionImagesManager;

function removeQuestionImage(idx) {
    if (idx >= 0 && idx < currentQuestionImages.length) {
        currentQuestionImages.splice(idx, 1);
        renderQuestionImagesManager();
    }
}
window.removeQuestionImage = removeQuestionImage;

function addImageUrlFromInput() {
    const input = document.getElementById('q-image-url-input');
    if (!input) return;
    const url = input.value.trim();
    if (!url) {
        showToast('Introdu un URL valid pentru imagine', true);
        return;
    }
    currentQuestionImages.push({ type: 'url', url });
    input.value = '';
    renderQuestionImagesManager();
}
window.addImageUrlFromInput = addImageUrlFromInput;

function handleImageFilesSelect(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    addDroppedOrPastedFiles(files, 'Fișiere');
    e.target.value = '';
}
window.handleImageFilesSelect = handleImageFilesSelect;

function initImageDropAndPasteHandlers() {
    const dropzone = document.getElementById('q-images-preview-list');
    const modalQ = document.getElementById('modal-question');

    if (dropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('drag-over');
            });
        });

        ['dragleave', 'dragend', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('drag-over');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('drag-over');
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                addDroppedOrPastedFiles(e.dataTransfer.files, 'Drag & Drop');
            }
        });
    }

    // Global Paste Listener (Snipping tool / clipboard screenshots)
    window.addEventListener('paste', (e) => {
        // Only trigger when modal-question is active/open
        if (!modalQ || modalQ.style.display === 'none') return;

        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        const items = clipboardData.items;
        const imageFiles = [];

        if (items) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (blob) {
                        const timeStamp = new Date().toISOString().replace(/[:.]/g, '-').slice(11, 19);
                        const file = new File([blob], `snippet-${timeStamp}.png`, { type: blob.type || 'image/png' });
                        imageFiles.push(file);
                    }
                }
            }
        } else if (clipboardData.files) {
            for (let i = 0; i < clipboardData.files.length; i++) {
                const file = clipboardData.files[i];
                if (file.type.startsWith('image/')) {
                    imageFiles.push(file);
                }
            }
        }

        if (imageFiles.length > 0) {
            e.preventDefault(); // Prevent pasting binary / weird text if input is focused
            addDroppedOrPastedFiles(imageFiles, 'Clipboard');
        }
    });
}
window.initImageDropAndPasteHandlers = initImageDropAndPasteHandlers;

function normalizeDifficulty(diff) {
    if (!diff) return 'medium';
    const d = String(diff).trim().toLowerCase();
    if (d === 'easy' || d === 'usor' || d === 'usoara' || d === 'ușor' || d === 'ușoară') return 'easy';
    if (d === 'medium' || d === 'mediu' || d === 'medie') return 'medium';
    if (d === 'hard' || d === 'greu' || d === 'grea') return 'hard';
    return 'medium';
}
window.normalizeDifficulty = normalizeDifficulty;

function openQuestionModal(q = null) {
    const m = document.getElementById('modal-question');
    m.style.display = 'flex';
    document.getElementById('modal-title').textContent = q ? 'Editează Întrebare' : 'Adaugă Întrebare Nouă';

    if (q) {
        document.getElementById('q-id').value = q.id || '';
        const examTypes = (q.exam_type || 'Diverse').split(',').map(s => s.trim().toLowerCase());
        document.querySelectorAll('.q-exam-cb').forEach(cb => {
            cb.checked = examTypes.includes(cb.value.toLowerCase());
        });

        document.getElementById('q-category').value = q.category ? q.category.trim() : '';
        updateSubcategories(q.subcategory ? q.subcategory.trim() : '');

        const normDiff = normalizeDifficulty(q.difficulty);
        const diffSelect = document.getElementById('q-difficulty');
        if (diffSelect) {
            diffSelect.value = normDiff;
            // Fallback if not matched: force first or medium
            if (!diffSelect.value) diffSelect.value = 'medium';
        }
        
        // Default to 'choice' (Grilă Standard) if q.type is missing, null, or empty
        const qTypeVal = (q.type && String(q.type).trim().toLowerCase() === 'code') ? 'code' : 'choice';
        document.getElementById('q-type').value = qTypeVal;
        
        document.getElementById('q-text').value = q.text || '';

        currentQuestionImages = parseImageUrls(q.image_url).map(url => ({ type: 'url', url }));
        renderQuestionImagesManager();

        let opts = q.options_json || q.options || [];
        if (typeof opts === 'string') {
            try { opts = JSON.parse(opts); } catch (e) { opts = []; }
        }
        if (!Array.isArray(opts)) opts = [];

        for (let i = 0; i < 6; i++) {
            const el = document.getElementById(`q-opt-${i}`);
            if (el) el.value = (opts[i] !== undefined && opts[i] !== null) ? opts[i] : '';
        }

        const correctIdx = (q.correct_index !== undefined && q.correct_index !== null) ? parseInt(q.correct_index) : 0;
        updateCorrectDropdown(isNaN(correctIdx) ? 0 : correctIdx);

        document.getElementById('q-hint').value = q.hint || q.explanation || '';

        setTimeout(() => {
            initCodeMirror();
            cmEditor.setValue(q.code || '');
            cmEditor.refresh();
        }, 50);
    } else {
        document.getElementById('question-form').reset();
        document.getElementById('q-id').value = '';
        document.getElementById('q-hint').value = '';
        currentQuestionImages = [];
        renderQuestionImagesManager();
        document.getElementById('q-opt-0').value = '';
        document.getElementById('q-opt-1').value = '';
        document.getElementById('q-opt-2').value = '';
        document.getElementById('q-opt-3').value = '';
        document.getElementById('q-opt-4').value = '';
        document.getElementById('q-opt-5').value = '';

        const examTypes = currentExamTab === 'Toate' ? ['Diverse'] : [currentExamTab];
        document.querySelectorAll('.q-exam-cb').forEach(cb => {
            cb.checked = examTypes.includes(cb.value);
        });
        updateSubcategories();
        updateCorrectDropdown(0);

        // Default to Grilă Standard for new questions
        document.getElementById('q-type').value = 'choice';

        setTimeout(() => {
            initCodeMirror();
            cmEditor.setValue('');
            cmEditor.refresh();
        }, 50);
    }
}

function closeQuestionModal() {
    document.getElementById('modal-question').style.display = 'none';
    currentWaitingEditId = null; // cleared on close
}

function editQuestion(id) {
    const q = questionsData.find(x => x.id === id);
    if (q) openQuestionModal(q);
}

document.getElementById('question-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('q-id').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_MANAGE_Q}?id=${id}` : API_MANAGE_Q;
    const codeVal = cmEditor ? cmEditor.getValue().trim() : '';

    const optInputs = [
        document.getElementById('q-opt-0').value.trim(),
        document.getElementById('q-opt-1').value.trim(),
        document.getElementById('q-opt-2').value.trim(),
        document.getElementById('q-opt-3').value.trim(),
        document.getElementById('q-opt-4').value.trim(),
        document.getElementById('q-opt-5').value.trim()
    ];

    let hasGap = false;
    let trailing = false;
    const options_json = [];
    for (let i = 0; i < optInputs.length; i++) {
        if (optInputs[i] !== '') {
            if (trailing) {
                hasGap = true;
                break;
            }
            options_json.push(optInputs[i]);
        } else {
            trailing = true;
        }
    }

    if (hasGap) {
        showToast('Variantele de răspuns trebuie completate în ordine (nu lăsa spații goale între opțiuni)!', true);
        return;
    }

    if (options_json.length < 2) {
        showToast('Trebuie să completezi cel puțin 2 variante de răspuns (A și B)!', true);
        return;
    }

    const correct_index = parseInt(document.getElementById('q-correct').value);
    if (isNaN(correct_index) || correct_index < 0 || correct_index >= options_json.length) {
        showToast('Răspunsul corect selectat este invalid pentru numărul de opțiuni completate!', true);
        return;
    }

    const btnSave = document.getElementById('btn-save-q');
    btnSave.disabled = true;
    btnSave.textContent = 'Se procesează...';

    try {
        // Upload any new image files in currentQuestionImages
        const finalUrls = [];
        for (let i = 0; i < currentQuestionImages.length; i++) {
            const imgObj = currentQuestionImages[i];
            if (imgObj.type === 'file' && imgObj.file) {
                btnSave.textContent = `Se încarcă imaginea ${i + 1}/${currentQuestionImages.length}...`;
                const base64data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(imgObj.file);
                });

                const uploadRes = await fetchWithToken('/.netlify/functions/upload-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: imgObj.file.name,
                        contentType: imgObj.file.type,
                        base64data
                    })
                });

                if (!uploadRes.ok) {
                    throw new Error(`Eroare la încărcarea imaginii ${imgObj.file.name}`);
                }
                const { publicUrl } = await uploadRes.json();
                finalUrls.push(publicUrl);
            } else if (imgObj.url) {
                finalUrls.push(imgObj.url);
            }
        }

        let imageFieldValue = null;
        if (finalUrls.length === 1) {
            imageFieldValue = finalUrls[0];
        } else if (finalUrls.length > 1) {
            imageFieldValue = JSON.stringify(finalUrls);
        }

        const payload = {
            exam_type: Array.from(document.querySelectorAll('.q-exam-cb')).filter(cb => cb.checked).map(cb => cb.value).join(', '),
            category: document.getElementById('q-category').value,
            subcategory: document.getElementById('q-subcategory').value,
            difficulty: document.getElementById('q-difficulty').value,
            type: document.getElementById('q-type').value,
            text: document.getElementById('q-text').value,
            image_url: imageFieldValue,
            hint: document.getElementById('q-hint').value.trim() || null,
            code: codeVal ? codeVal : null,
            options_json: options_json,
            correct_index: correct_index
        };

        btnSave.textContent = 'Se salvează...';
        const res = await fetchWithToken(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            let errMsg = 'Eroare la salvare!';
            try {
                const errData = await res.json();
                if (errData.error) errMsg = errData.error;
                if (errData.details) errMsg += `: ${errData.details}`;
            } catch (err) { }
            throw new Error(errMsg);
        }
        const isWaitingApproval = !!currentWaitingEditId;
        if (isWaitingApproval) {
            await deleteWaitingQuestionSilent(currentWaitingEditId);
            currentWaitingEditId = null;
            showToast('Întrebare aprobată și adăugată în baza de date!');
        } else {
            showToast(id ? 'Întrebare actualizată!' : 'Întrebare adăugată!');
        }
        closeQuestionModal();
        loadQuestions(); // refresh list
    } catch (e) {
        console.error('Error saving question:', e);
        showToast(e.message || 'Eroare la salvare!', true);
    } finally {
        document.getElementById('btn-save-q').disabled = false;
        document.getElementById('btn-save-q').textContent = 'Salvează Întrebarea';
    }
});

// Close modal on outside click
// Removed to prevent accidental close
// document.getElementById('modal-question').addEventListener('click', (e) => {
//     if (e.target.id === 'modal-question') closeQuestionModal();
// });
document.getElementById('modal-details').addEventListener('click', (e) => {
    if (e.target.id === 'modal-details') closeDetailsModal();
});



/* ==================== INTREBARI IN ASTEPTATE (STAGING) ==================== */
function initWFilters() {
    const catSelect = document.getElementById('w-filter-cat');
    if (!catSelect || catSelect.children.length > 1) return;
    catSelect.innerHTML = '<option value="">Toate categoriile</option>';
    Object.keys(subcategoriesMap).forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat; opt.textContent = cat;
        catSelect.appendChild(opt);
    });
}

function updateWFilterSub() {
    const cat = document.getElementById('w-filter-cat').value;
    const subSelect = document.getElementById('w-filter-sub');
    subSelect.innerHTML = '<option value="">Toate subcategoriile</option>';
    if (cat && subcategoriesMap[cat]) {
        subcategoriesMap[cat].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            subSelect.appendChild(opt);
        });
    }
}

async function loadWaitingQuestions() {
    try {
        initWFilters();
        const res = await fetchWithToken(API_FETCH_WAITING);
        if (!res.ok) throw new Error();
        waitingQuestionsData = await res.json();

        document.getElementById('loading-waiting').style.display = 'none';
        document.getElementById('badge-waiting-count').textContent = waitingQuestionsData.length;

        if (waitingQuestionsData.length === 0) {
            document.getElementById('empty-waiting').style.display = 'block';
            document.getElementById('wrapper-waiting').style.display = 'none';
        } else {
            document.getElementById('empty-waiting').style.display = 'none';
            document.getElementById('wrapper-waiting').style.display = 'flex';
            renderWaitingQuestions();
        }
    } catch (e) {
        console.error('Error loading waiting questions:', e);
        document.getElementById('loading-waiting').innerHTML = `<p style="color:var(--accent-red)">Eroare la încărcare întrebări în așteptare.</p>`;
    }
}

function renderWaitingQuestions() {
    const container = document.getElementById('wrapper-waiting');
    const fExamEl = document.getElementById('w-filter-exam');
    const fExam = fExamEl ? fExamEl.value : '';
    const fCat = document.getElementById('w-filter-cat').value;
    const fSub = document.getElementById('w-filter-sub').value;
    const fDiff = document.getElementById('w-filter-diff').value;
    const fSearch = normalizeSearchText(document.getElementById('w-filter-search').value);

    const filtered = waitingQuestionsData.filter(q => {
        if (fExam && !(q.exam_type || 'Initial').toLowerCase().includes(fExam.toLowerCase())) return false;
        if (fCat && q.category !== fCat) return false;
        if (fSub && q.subcategory !== fSub) return false;
        if (fDiff && q.difficulty !== fDiff) return false;
        if (fSearch && !normalizeSearchText(q.text || '').includes(fSearch)) return false;
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-secondary);">Nicio întrebare în așteptare nu corespunde filtrelor.</div>`;
        return;
    }

    const html = filtered.map((q, idx) => {
        const diffClass = q.difficulty === 'hard' ? 'badge-hard' : (q.difficulty === 'medium' ? 'badge-medium' : 'badge-easy');
        const diffLabel = q.difficulty === 'hard' ? 'Grea' : (q.difficulty === 'medium' ? 'Medie' : 'Ușoară');

        let opts = q.options_json;
        if (typeof opts === 'string') {
            try { opts = JSON.parse(opts); } catch (e) { opts = []; }
        }
        if (!Array.isArray(opts)) opts = [];

        const optsHtml = opts.map((optText, optIdx) => {
            const isCorrect = q.correct_index === optIdx;
            const optLetter = String.fromCharCode(65 + optIdx);
            return `
                        <div class="detail-opt ${isCorrect ? 'opt-correct' : ''}" style="margin-top:6px;">
                            <span><strong>${optLetter}.</strong> ${escapeHtml(optText)}</span>
                            ${isCorrect ? '<span class="detail-opt-tag tag-correct">Răspuns Corect</span>' : ''}
                        </div>
                    `;
        }).join('');

        const codeText = q.code ? q.code.replace(/\\n/g, '\n') : '';
        const codeHtml = codeText ? `<div class="detail-code">${escapeHtml(codeText)}</div>` : '';
        const qImgs = parseImageUrls(q.image_url);
        const imageHtml = qImgs.length > 0 ? `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; margin:12px auto; text-align:center; width:100%;">
                ${qImgs.map(u => `<img src="${u}" style="max-height:200px; max-width:100%; border-radius:8px; display:block; margin:0 auto; box-shadow:0 4px 10px rgba(0,0,0,0.3); cursor:zoom-in;" onclick="openAdminLightbox('${u}')" title="Click pentru mărire">`).join('')}
            </div>` : '';

        const rawExam = q.exam_type || 'Initial';
        let selectedExam = 'Initial';
        if (rawExam.includes('Poli')) selectedExam = 'Poli';
        else if (rawExam.includes('Academie')) selectedExam = 'Academie';
        else if (rawExam.includes('BAC')) selectedExam = 'BAC';
        else if (rawExam.includes('Diverse')) selectedExam = 'Diverse';
        else if (rawExam.includes('Initial')) selectedExam = 'Initial';

        const hasHint = q.hint && q.hint.trim() !== '';
        const hintHtml = hasHint ? `
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; align-items: flex-start;">
                <button type="button" class="btn-hint-inline" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 12px; font-weight: 700; border-radius: 6px; background: rgba(251, 191, 36, 0.12); border: 1px solid rgba(251, 191, 36, 0.35); color: #fbbf24; cursor: pointer; transition: all 0.2s;" onclick="toggleWaitingHint('waiting-hint-${q.id || idx}')">
                    <span>💡</span> Vezi Indiciu (Hint)
                </button>
                <div id="waiting-hint-${q.id || idx}" class="review-hint-box" style="display:none; width: 100%; box-sizing: border-box; margin-top: 8px; padding: 12px 14px; border-radius: 8px; background: rgba(251, 191, 36, 0.08); border-left: 3px solid #fbbf24; font-size: 13px; color: #e2e8f0; line-height: 1.5; animation: fadeIn 0.2s ease;">
                    <div style="font-weight: 700; color: #fbbf24; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                        <span>💡</span> Indiciu pentru Elev:
                    </div>
                    <div style="color: #cbd5e1; white-space: pre-wrap; font-size: 13px;">${escapeHtml(q.hint)}</div>
                </div>
            </div>` : `
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; align-items: flex-start;">
                <button type="button" class="btn-hint-inline" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; background: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(255, 255, 255, 0.18); color: var(--text-muted); cursor: pointer; transition: all 0.2s;" onclick="toggleWaitingHint('waiting-hint-${q.id || idx}')">
                    <span>💡</span> Indiciu (Nesetat)
                </button>
                <div id="waiting-hint-${q.id || idx}" class="review-hint-box" style="display:none; width: 100%; box-sizing: border-box; margin-top: 8px; padding: 10px 14px; border-radius: 8px; background: rgba(255, 255, 255, 0.02); border-left: 3px solid rgba(255,255,255,0.2); font-size: 13px; color: var(--text-secondary); animation: fadeIn 0.2s ease;">
                    <em>Această întrebare nu are încă un indiciu setat. Poți adăuga unul din „✏️ Editează & Aprobă”.</em>
                </div>
            </div>`;

        return `
                    <div class="detail-card" style="border-left: 4px solid var(--accent-amber); background: rgba(15, 15, 40, 0.75);">
                        <div class="detail-header" style="flex-wrap: wrap; gap: 8px;">
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <span style="font-weight:700; color:var(--accent-amber); font-size:13px;">#${q.id || (idx + 1)}</span>
                                <span class="badge ${diffClass}">${diffLabel}</span>
                                <span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-secondary);">${escapeHtml(q.category || 'General')} • ${escapeHtml(q.subcategory || '')}</span>
                                <select class="form-control" style="width: 130px; min-width: 130px; padding: 4px 28px 4px 10px; font-size: 12px; font-weight: 600; height: 28px; border-color: var(--accent-purple); background-position: right 8px center; background-size: 12px; border-radius: 6px;" onchange="updateWaitingExamType(${q.id}, this.value)">
                                    <option value="Initial" ${selectedExam === 'Initial' ? 'selected' : ''}>Test Inițial</option>
                                    <option value="Poli" ${selectedExam === 'Poli' ? 'selected' : ''}>Poli</option>
                                    <option value="Academie" ${selectedExam === 'Academie' ? 'selected' : ''}>Academie</option>
                                    <option value="BAC" ${selectedExam === 'BAC' ? 'selected' : ''}>BAC</option>
                                    <option value="Diverse" ${selectedExam === 'Diverse' ? 'selected' : ''}>Diverse</option>
                                </select>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button class="btn btn-primary" style="padding:6px 14px; font-size:12px; background:linear-gradient(135deg, #34d399, #10b981);" onclick="approveWaitingQuestion(${q.id})">✔️ Aprobă</button>
                                <button class="btn btn-edit" style="padding:6px 12px; font-size:12px;" onclick="editAndApproveWaitingQuestion(${q.id})">✏️ Editează & Aprobă</button>
                                <button class="btn btn-danger" style="padding:6px 12px; font-size:12px;" onclick="rejectWaitingQuestion(${q.id})">🗑️ Respinge</button>
                            </div>
                        </div>
                        <div style="font-size:15px; font-weight:600; color:var(--text-primary); margin: 10px 0 6px; white-space:pre-wrap;">${escapeHtml(q.text || '')}</div>
                        ${codeHtml}
                        ${imageHtml}
                        <div style="margin-top:10px;">${optsHtml}</div>
                        ${hintHtml}
                    </div>
                `;
    }).join('');

    container.innerHTML = html;
}

function toggleWaitingHint(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
}
window.toggleWaitingHint = toggleWaitingHint;

function updateWaitingExamType(id, val) {
    const q = waitingQuestionsData.find(x => x.id === id);
    if (q) q.exam_type = val;
}

async function approveWaitingQuestion(id) {
    const q = waitingQuestionsData.find(x => x.id === id);
    if (!q) return;

    try {
        const res = await fetchWithToken(`${API_MANAGE_WAITING}?id=${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve', question: q })
        });

        if (res.ok) {
            showToast('Întrebare aprobată și adăugată în Supabase & seed.sql!');
            waitingQuestionsData = waitingQuestionsData.filter(x => x.id !== id);
            document.getElementById('badge-waiting-count').textContent = waitingQuestionsData.length;
            renderWaitingQuestions();
            questionsData = []; // force reload on questions tab
        } else {
            const err = await res.json();
            showToast(err.error || 'Eroare la aprobare', true);
        }
    } catch (e) {
        showToast('Eroare de rețea la aprobare', true);
    }
}

async function approveAllWaitingQuestions() {
    if (waitingQuestionsData.length === 0) {
        showToast('Nu există întrebări în așteptare!', true);
        return;
    }
    if (!confirm(`Sigur doriți să aprobați TOATE cele ${waitingQuestionsData.length} întrebări? Ele vor fi adăugate în Supabase și seed.sql.`)) return;

    try {
        const res = await fetchWithToken(API_MANAGE_WAITING, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve_all' })
        });

        if (res.ok) {
            showToast('Toate întrebările au fost aprobate cu succes!');
            waitingQuestionsData = [];
            document.getElementById('badge-waiting-count').textContent = 0;
            document.getElementById('wrapper-waiting').style.display = 'none';
            document.getElementById('empty-waiting').style.display = 'block';
            questionsData = [];
        } else {
            showToast('Eroare la aprobarea în masă', true);
        }
    } catch (e) {
        showToast('Eroare de rețea la aprobarea în masă', true);
    }
}

async function deleteWaitingQuestionSilent(id) {
    try {
        const res = await fetchWithToken(`${API_MANAGE_WAITING}?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            waitingQuestionsData = waitingQuestionsData.filter(x => x.id !== id);
            const badge = document.getElementById('badge-waiting-count');
            if (badge) badge.textContent = waitingQuestionsData.length;
            renderWaitingQuestions();
        }
    } catch (e) {
        console.error('Error removing approved question from waiting list:', e);
    }
}

async function rejectWaitingQuestion(id) {
    if (!confirm('Sigur dorești să respingi (ștergi) această întrebare din lista de așteptare?')) return;
    try {
        const res = await fetchWithToken(`${API_MANAGE_WAITING}?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Întrebare respinsă!');
            waitingQuestionsData = waitingQuestionsData.filter(x => x.id !== id);
            const badge = document.getElementById('badge-waiting-count');
            if (badge) badge.textContent = waitingQuestionsData.length;
            renderWaitingQuestions();
        } else {
            showToast('Eroare la respingere', true);
        }
    } catch (e) {
        showToast('Eroare de rețea', true);
    }
}


function editAndApproveWaitingQuestion(id) {
    const q = waitingQuestionsData.find(x => x.id === id);
    if (!q) return;

    let opts = q.options_json;
    if (typeof opts === 'string') {
        try { opts = JSON.parse(opts); } catch (e) { opts = []; }
    }
    if (!Array.isArray(opts)) opts = [];

    currentWaitingEditId = id;
    openQuestionModal({
        id: null,
        exam_type: q.exam_type,
        category: q.category ? q.category.trim() : '',
        subcategory: q.subcategory ? q.subcategory.trim() : '',
        difficulty: q.difficulty,
        type: q.type,
        text: q.text || '',
        code: q.code || '',
        image_url: q.image_url || '',
        options: opts,
        correct_index: q.correct_index,
        hint: q.hint || q.explanation || ''
    });
}


// Init
loadSituatie();
loadWaitingQuestions();

/* ==================== ELEVI ==================== */
async function loadStudents() {
    try {
        const res = await fetchWithToken(`${API_MANAGE_STUDENTS}?action=list`);
        if (!res.ok) throw new Error();
        studentsData = await res.json();

        const loadingEl = document.getElementById('loading-students');
        if (loadingEl) loadingEl.style.display = 'none';

        if (studentsData.length === 0) {
            const emptyEl = document.getElementById('empty-students');
            if (emptyEl) emptyEl.style.display = 'block';
            const wrapEl = document.getElementById('wrapper-students');
            if (wrapEl) wrapEl.style.display = 'none';
        } else {
            const emptyEl = document.getElementById('empty-students');
            if (emptyEl) emptyEl.style.display = 'none';
            const wrapEl = document.getElementById('wrapper-students');
            if (wrapEl) wrapEl.style.display = 'block';
            renderStudents();
        }
    } catch (e) {
        const loadingEl = document.getElementById('loading-students');
        if (loadingEl) loadingEl.innerHTML = `<p style="color:var(--accent-red)">Eroare la încărcarea elevilor.</p>`;
    }
}

function getSubscriptionBadge(expiresAt) {
    if (!expiresAt) {
        return `<span style="background:rgba(124,106,255,0.15); color:var(--accent-purple); border:1px solid rgba(124,106,255,0.4); padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">🟣 Nelimitat</span>`;
    }
    let exp;
    if (expiresAt.includes('/')) {
        const parts = expiresAt.split('/');
        if (parts.length === 3) {
            exp = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
        } else {
            exp = new Date(expiresAt);
        }
    } else {
        exp = new Date(expiresAt);
    }

    if (isNaN(exp.getTime())) {
        return `<span style="color:var(--text-muted); font-size:11px;">-</span>`;
    }
    const diffMs = exp.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        return `<span style="background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.5); padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">🔴 Expirat (${exp.toLocaleDateString('ro-RO')})</span>`;
    } else if (diffDays <= 5) {
        return `<span style="background:rgba(245,158,11,0.2); color:#fbbf24; border:1px solid rgba(245,158,11,0.5); padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">⚠️ ${diffDays} zile rămase</span>`;
    } else {
        return `<span style="background:rgba(52,211,153,0.15); color:#34d399; border:1px solid rgba(52,211,153,0.4); padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">🟢 Activ (${diffDays} zile)</span>`;
    }
}
window.getSubscriptionBadge = getSubscriptionBadge;

function renderStudents() {
    const tbody = document.getElementById('students-body');
    if (!tbody) return;

    const searchInput = document.getElementById('search-students-list');
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredStudents = studentsData.filter(s => {
        if (!searchVal) return true;
        const u = s.username ? s.username.toLowerCase() : '';
        const p = s.phone_number ? s.phone_number.toLowerCase() : '';
        return u.includes(searchVal) || p.includes(searchVal);
    });

    if (filteredStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; opacity:0.6; padding: 20px;">Nu s-au găsit elevi.</td></tr>';
        return;
    }

    const htmlArr = filteredStudents.map(s => {
        const dateStr = formatDate(s.created_at);
        const phoneStr = s.phone_number ? escapeHtml(s.phone_number) : '<span style="color:var(--accent-red); font-size:12px;">Nesetat</span>';
        const pwDisplay = s.password ? escapeHtml(s.password) : 'Nesetat';
        const subBadge = getSubscriptionBadge(s.expires_at);

        return `
                    <tr>
                        <td>${s.id}</td>
                        <td style="font-weight:600;">${escapeHtml(s.username)}</td>
                        <td>
                            ${phoneStr}
                            <button class="btn btn-secondary" style="padding: 2px 6px; font-size: 10px; margin-left: 6px;" onclick="promptEditPhone(${s.id}, '${escapeHtml(s.username)}', '${s.phone_number || ''}')">✏️</button>
                        </td>
                        <td style="font-family: monospace; letter-spacing: 1px;">
                            <span id="pw-mask-${s.id}">••••••••</span>
                            <span id="pw-val-${s.id}" style="display:none; font-size:13px; font-weight:600; color:var(--accent-purple); letter-spacing:0;">${pwDisplay}</span>
                            <button class="btn btn-secondary" style="padding: 2px 6px; font-size: 10px; margin-left: 6px;" onclick="togglePassword(${s.id})">👁️</button>
                        </td>
                        <td>
                            ${subBadge}
                            <button class="btn btn-secondary" style="padding: 2px 6px; font-size: 10px; margin-left: 6px;" onclick="openSubscriptionModal(${s.id}, '${escapeHtml(s.username)}', '${s.expires_at || ''}')" title="Modifică Valabilitate">⏱️</button>
                        </td>
                        <td style="color:var(--text-secondary); font-size:12px;">${dateStr}</td>
                        <td style="white-space: nowrap;">
                            <div style="display: inline-flex; align-items: center; gap: 6px;">
                                <button class="btn btn-secondary" style="padding: 6px 10px; font-size:12px;" onclick="promptResetPassword(${s.id}, '${escapeHtml(s.username)}')">🔑 Reset</button>
                                <button class="btn btn-secondary" style="padding: 6px 10px; font-size:12px; border-color: rgba(248,113,113,0.3); color: var(--accent-red);" onclick="deleteStudent(${s.id}, '${escapeHtml(s.username)}')">Șterge</button>
                            </div>
                        </td>
                    </tr>
                `;
    });
    tbody.innerHTML = htmlArr.join('');
}

function togglePassword(id) {
    const mask = document.getElementById(`pw-mask-${id}`);
    const val = document.getElementById(`pw-val-${id}`);
    if (mask.style.display === 'none') {
        mask.style.display = 'inline';
        val.style.display = 'none';
    } else {
        mask.style.display = 'none';
        val.style.display = 'inline';
    }
}

function promptEditPhone(id, username, currentPhone) {
    document.getElementById('edit-phone-id').value = id;
    document.getElementById('edit-phone-username').value = username;
    document.getElementById('edit-phone-input').value = currentPhone;
    document.getElementById('modal-phone').style.display = 'flex';
}

function closePhoneModal() {
    document.getElementById('modal-phone').style.display = 'none';
}

async function handleEditPhoneSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-phone-id').value;
    const username = document.getElementById('edit-phone-username').value;
    const newPhone = document.getElementById('edit-phone-input').value;

    try {
        const res = await fetchWithToken('/.netlify/functions/update-phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: id, username: username, phone_number: newPhone.trim() })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Eroare la actualizarea numărului.');
        }

        // Close modal and refresh
        closePhoneModal();
        loadStudents();
    } catch (error) {
        showToast('Eroare: ' + error.message, true);
    }
}

/* ==================== SUBSCRIPTION MODAL (VALABILITATE) ==================== */
function formatSubDateEuropean(d) {
    if (!d || isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

function openSubscriptionModal(id, username, currentExpiresAt) {
    document.getElementById('sub-student-id').value = id;
    document.getElementById('sub-student-name').value = `@${username}`;
    const dateInput = document.getElementById('sub-exact-date');
    if (currentExpiresAt) {
        let d;
        if (currentExpiresAt.includes('/')) {
            const parts = currentExpiresAt.split('/');
            if (parts.length === 3) {
                d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
            } else {
                d = new Date(currentExpiresAt);
            }
        } else {
            d = new Date(currentExpiresAt);
        }
        dateInput.value = formatSubDateEuropean(d);
    } else {
        dateInput.value = '';
    }
    document.getElementById('modal-subscription').style.display = 'flex';
}
window.openSubscriptionModal = openSubscriptionModal;

function closeSubscriptionModal() {
    document.getElementById('modal-subscription').style.display = 'none';
}
window.closeSubscriptionModal = closeSubscriptionModal;

function setSubDuration(days) {
    const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    document.getElementById('sub-exact-date').value = formatSubDateEuropean(targetDate);
}
window.setSubDuration = setSubDuration;

function setSubUnlimited() {
    document.getElementById('sub-exact-date').value = '';
}
window.setSubUnlimited = setSubUnlimited;

async function handleEditSubscriptionSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('sub-student-id').value;
    const dateVal = document.getElementById('sub-exact-date').value;
    const btn = document.getElementById('btn-save-sub');

    btn.disabled = true;
    btn.textContent = 'Se salvează...';

    let expiresAtIso = null;
    if (dateVal && dateVal.trim()) {
        const trimmed = dateVal.trim();
        let day, month, year;

        if (trimmed.includes('/')) {
            const parts = trimmed.split('/');
            if (parts.length === 3) {
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                year = parseInt(parts[2], 10);
            }
        } else if (trimmed.includes('.')) {
            const parts = trimmed.split('.');
            if (parts.length === 3) {
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                year = parseInt(parts[2], 10);
            }
        } else if (trimmed.includes('-')) {
            const parts = trimmed.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    year = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    day = parseInt(parts[2], 10);
                } else {
                    day = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    year = parseInt(parts[2], 10);
                }
            }
        }

        if (day >= 1 && day <= 31 && !isNaN(month) && month >= 0 && month <= 11 && year >= 2020 && year <= 2100) {
            // Set expiration to 23:59:59 local/UTC
            const dateObj = new Date(year, month, day, 23, 59, 59);
            if (!isNaN(dateObj.getTime())) {
                expiresAtIso = dateObj.toISOString();
            } else {
                showToast('Data introdusă este invalidă!', true);
                btn.disabled = false;
                btn.textContent = 'Salvează Valabilitatea';
                return;
            }
        } else {
            showToast('Format dată invalid! Folosiți zz/ll/aaaa (ex: 25/09/2026)', true);
            btn.disabled = false;
            btn.textContent = 'Salvează Valabilitatea';
            return;
        }
    }

    try {
        const res = await fetchWithToken(API_MANAGE_STUDENTS, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_expiration',
                id: id,
                expires_at: expiresAtIso
            })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Eroare la actualizarea abonamentului');
        }

        showToast('Valabilitate actualizată cu succes!');
        closeSubscriptionModal();
        loadStudents();
    } catch (err) {
        showToast(err.message, true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvează Valabilitatea';
    }
}
window.handleEditSubscriptionSubmit = handleEditSubscriptionSubmit;

async function promptResetPassword(id, username) {
    const newPassword = prompt(`Introduceți o nouă parolă pentru ${username}:`);
    if (!newPassword || newPassword.trim() === '') return;

    try {
        const res = await fetchWithToken(API_MANAGE_STUDENTS, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset_password', id, new_password: newPassword.trim() })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Eroare la resetare');
        }
        showToast(`Parola pentru ${username} a fost resetată!`);
        loadStudents();
    } catch (err) {
        showToast(err.message, true);
    }
}

function openStudentModal() {
    document.getElementById('new-student-username').value = '';
    document.getElementById('new-student-password').value = Math.random().toString(36).slice(-8);
    const phoneEl = document.getElementById('new-student-phone');
    if (phoneEl) phoneEl.value = '';
    const durEl = document.getElementById('new-student-duration');
    if (durEl) durEl.value = '30';
    document.getElementById('modal-student').style.display = 'flex';
}

function closeStudentModal() {
    document.getElementById('modal-student').style.display = 'none';
}

async function handleCreateStudent(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-student');
    btn.disabled = true;
    btn.textContent = 'Se creează...';

    const username = document.getElementById('new-student-username').value.trim();
    const password = document.getElementById('new-student-password').value.trim();
    const phone = document.getElementById('new-student-phone') ? document.getElementById('new-student-phone').value.trim() : null;
    const duration = document.getElementById('new-student-duration') ? document.getElementById('new-student-duration').value : '30';

    let expiresAt = null;
    if (duration !== 'unlimited') {
        const days = parseInt(duration) || 30;
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }

    try {
        const res = await fetchWithToken(API_MANAGE_STUDENTS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'create',
                username,
                password,
                phone_number: phone || null,
                expires_at: expiresAt
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Eroare la creare');

        showToast('Cont creat cu succes!');
        closeStudentModal();
        loadStudents();
    } catch (err) {
        showToast(err.message, true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Creează Cont';
    }
}

async function deleteStudent(id, username) {
    if (!confirm(`Sigur dorești să ștergi contul elevului ${username}? Rezultatele acestuia vor fi păstrate în tabelul results, dar nu se va mai putea autentifica.`)) return;

    try {
        const res = await fetchWithToken(`${API_MANAGE_STUDENTS}?id=${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });

        if (!res.ok) throw new Error();
        showToast('Cont șters cu succes!');
        loadStudents();
    } catch (err) {
        showToast('Eroare la ștergerea contului', true);
    }
}



/* ==================== SITUATIE ELEVI & ASIGNARI ==================== */
let assignedTestsData = [];

async function loadSituatie() {
    const loadingEl = document.getElementById('loading-situatie-students');
    const gridEl = document.getElementById('situatie-students-grid');
    if (loadingEl) loadingEl.style.display = 'flex';
    if (gridEl) gridEl.style.display = 'none';
    try {
        await loadStudents();
        await loadResults();

        const asRes = await fetchWithToken(API_ASSIGNED_TESTS);
        if (asRes.ok) {
            assignedTestsData = await asRes.json();
        }

        renderSituatieGrid();
    } catch (err) {
        console.error(err);
        showToast('Eroare la încărcarea situației', true);
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
        if (gridEl) gridEl.style.display = 'grid';
    }
}

function renderSituatieGrid() {
    const grid = document.getElementById('situatie-students-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const searchInput = document.getElementById('search-situatie-student');
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredStudents = studentsData.filter(s => {
        if (!searchVal) return true;
        return s.username.toLowerCase().includes(searchVal);
    });

    if (filteredStudents.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; opacity: 0.6; padding: 20px;">Nu s-au găsit elevi conform căutării.</div>';
        return;
    }

    // Calculate Risk Score for each student
    const studentsWithRisk = filteredStudents.map(student => {
        const studentUserLower = (student.username || '').toLowerCase().trim();
        
        // Results
        const studentResults = resultsData.filter(r => {
            const u = (r.student_username || '').toLowerCase().trim();
            const n = (r.student_name || '').toLowerCase().trim();
            return (u === studentUserLower || n === studentUserLower) && r.test_type !== 'category_coverage' && r.test_type !== 'lead_diagnostic';
        }).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        
        // Pending Tests
        const pendingTests = assignedTestsData.filter(t => (t.student_username || '').toLowerCase().trim() === studentUserLower && t.status === 'pending');
        const overdueTests = pendingTests.filter(t => new Date(t.deadline) < new Date());

        let riskScore = 0;
        let riskReasons = [];

        // 1. Inactivity (7 / 14 days)
        if (studentResults.length > 0) {
            const lastActive = new Date(studentResults[studentResults.length - 1].created_at);
            const daysInactive = Math.floor((new Date() - lastActive) / (1000 * 60 * 60 * 24));
            if (daysInactive >= 14) {
                riskScore += 30;
                riskReasons.push(`Inactiv > 14 zile`);
            } else if (daysInactive >= 7) {
                riskScore += 15;
                riskReasons.push(`Inactiv > 7 zile`);
            }
        } else {
            riskScore += 15; // never active
            riskReasons.push(`Niciun test susținut`);
        }

        // 2. Pending / Overdue Homework
        if (overdueTests.length > 0) {
            riskScore += 25;
            riskReasons.push(`${overdueTests.length} teme depășite`);
        } else if (pendingTests.length > 0) {
            riskScore += 10;
            riskReasons.push(`${pendingTests.length} teme restante`);
        }

        // 3. Weak Category & Wrong answers
        const catStats = {};
        let lastTestAcc = null;

        studentResults.forEach((r, idx) => {
            const isLast = (idx === studentResults.length - 1);
            let t = 0, c = 0;
            let details = r.details_json;
            if (typeof details === 'string') try { details = JSON.parse(details); } catch(e){ details = []; }
            (details || []).forEach(d => {
                if (d && d.category) {
                    if (!catStats[d.category]) catStats[d.category] = { seen: 0, correct: 0 };
                    catStats[d.category].seen++;
                    t++;
                    if (d.isCorrect) {
                        catStats[d.category].correct++;
                        c++;
                    }
                }
            });
            if (isLast && t > 0) lastTestAcc = c / t;
        });

        let weakCats = [];
        for (const cat in catStats) {
            if (catStats[cat].seen >= 5) {
                const acc = catStats[cat].correct / catStats[cat].seen;
                if (acc <= 0.3) weakCats.push(cat);
            }
        }
        
        if (weakCats.length > 0) {
            riskScore += 25;
            riskReasons.push(`Categorie slabă (<30%): ${weakCats.slice(0, 2).join(', ')}`);
        }

        if (lastTestAcc !== null && lastTestAcc <= 0.4) {
            riskScore += 20;
            riskReasons.push(`Scor foarte mic la ultimul test`);
        }

        return {
            ...student,
            doneTestsCount: studentResults.length,
            pendingTestsCount: pendingTests.length,
            riskScore: Math.min(riskScore, 100),
            riskReasons
        };
    });

    studentsWithRisk.sort((a, b) => b.riskScore - a.riskScore);

    const highRiskStudents = studentsWithRisk.filter(s => s.riskScore >= 40);

    if (highRiskStudents.length > 0 && !searchVal) {
        const triageHeader = document.createElement('div');
        triageHeader.style.gridColumn = '1 / -1';
        triageHeader.style.marginBottom = '10px';
        triageHeader.innerHTML = `<h3 style="color: var(--accent-red); margin: 0;">🚨 ${highRiskStudents.length} elevi necesită atenție azi</h3>`;
        grid.appendChild(triageHeader);
    }

    studentsWithRisk.forEach(student => {
        const card = document.createElement('div');
        card.className = 'option-card';
        card.style.display = 'block';
        card.style.padding = '20px';
        card.style.cursor = 'pointer';
        
        let borderStyle = '';
        if (student.riskScore >= 70) borderStyle = 'border: 1px solid var(--accent-red);';
        else if (student.riskScore >= 40) borderStyle = 'border: 1px solid var(--accent-amber);';
        
        card.style = `display: block; padding: 20px; cursor: pointer; ${borderStyle}`;
        card.onclick = () => openSituatieDetail(student.username);

        let riskBadge = '';
        if (student.riskScore >= 70) riskBadge = `<span class="badge" style="background:rgba(248,113,113,0.15); color:var(--accent-red)">Risc Critic (${student.riskScore} pct)</span>`;
        else if (student.riskScore >= 40) riskBadge = `<span class="badge" style="background:rgba(251,191,36,0.15); color:var(--accent-amber)">Risc Moderat (${student.riskScore} pct)</span>`;
        else riskBadge = `<span class="badge" style="background:rgba(52,211,153,0.15); color:var(--accent-green)">Risc Scăzut</span>`;

        let reasonsHtml = '';
        if (student.riskReasons.length > 0) {
            reasonsHtml = `<div style="margin-top: 10px; font-size: 12px; color: var(--text-secondary); display:flex; flex-direction:column; gap:4px;">
                ${student.riskReasons.map(r => `<div>• ${r}</div>`).join('')}
            </div>`;
        }

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:flex; align-items:center; gap:16px; margin-bottom: 12px;">
                    <div style="background:linear-gradient(135deg, var(--accent-purple), #4a3e9c); width:48px; height:48px; border-radius:50%; display:flex; justify-content:center; align-items:center; font-weight:800; font-size:20px; color:#fff; box-shadow: 0 4px 10px rgba(124, 106, 255, 0.3);">
                        ${student.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${escapeHtml(student.username)}</div>
                    </div>
                </div>
                ${riskBadge}
            </div>
            <div style="display: flex; gap: 8px;">
                <span class="badge" style="background:rgba(52,211,153,0.15); color:var(--accent-green)">${student.doneTestsCount} Teste Susținute</span>
                ${student.pendingTestsCount > 0 ? `<span class="badge" style="background:rgba(251,191,36,0.15); color:var(--accent-amber)">${student.pendingTestsCount} Temă</span>` : ''}
            </div>
            ${student.riskScore >= 40 ? reasonsHtml : ''}
        `;
        grid.appendChild(card);
    });
}

function closeSituatieDetail() {
    document.getElementById('situatie-detail-view').style.display = 'none';
    document.getElementById('situatie-list-view').style.display = 'block';
}

async function openSituatieDetail(username) {
    document.getElementById('situatie-list-view').style.display = 'none';
    document.getElementById('situatie-detail-view').style.display = 'block';
    document.getElementById('situatie-detail-name').textContent = username;

    try {
        const res = await fetchWithToken(API_RESULTS);
        if (res.ok) resultsData = await res.json();
    } catch (e) { }

    const target = (username || '').toLowerCase().trim();
    const studentResults = resultsData.filter(r => {
        const u = (r.student_username || '').toLowerCase().trim();
        const n = (r.student_name || '').toLowerCase().trim();
        return (u === target || n === target) && r.test_type !== 'category_coverage' && r.test_type !== 'lead_diagnostic';
    });
    const studentPending = assignedTestsData.filter(t => (t.student_username || '').toLowerCase().trim() === target && t.status === 'pending');

    // Render stats
    let total = studentResults.length;
    let avg = 0;
    let timeSum = 0;
    if (total > 0) {
        const sumPct = studentResults.reduce((acc, r) => acc + (r.score / r.total_points) * 100, 0);
        avg = Math.round(sumPct / total);
        timeSum = studentResults.reduce((acc, r) => acc + r.time_taken_ms, 0);
    }
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-avg').textContent = avg;
    document.getElementById('stat-time').textContent = total > 0 ? formatTime(Math.round(timeSum / total)) : '0m';

    // Render Student Category Coverage
    loadAdminStudentCoverage(username);

    // Render Assigned
    const assignedList = document.getElementById('situatie-assigned-list');
    if (studentPending.length === 0) {
        assignedList.innerHTML = '<p style="font-size:13px; opacity:0.6;">Niciun test asignat în așteptare.</p>';
    } else {
        assignedList.innerHTML = studentPending.map(pt => {
            const answered = pt.answered_count || 0;
            const total = pt.target_length || (pt.questions_ids ? pt.questions_ids.length : 0);
            const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
            const isOverdue = new Date(pt.deadline) < new Date();
            const statusText = answered > 0 ? (answered === total ? 'Completat' : 'În lucru') : 'Neînceput';
            const statusColor = answered > 0 ? 'var(--accent-purple)' : 'var(--text-muted)';

            return `
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:10px; padding:14px 16px; margin-bottom:12px; display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
                        <div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-weight:700; font-size:15px; color:var(--text-primary);">Test ${escapeHtml(pt.exam_type)}</span>
                                <span class="badge" style="background:rgba(124,106,255,0.15); color:var(--accent-purple); font-size:11px;">${total} întrebări</span>
                                ${isOverdue ? '<span class="badge" style="background:rgba(248,113,113,0.15); color:var(--accent-red); font-size:11px;">Depășit</span>' : ''}
                            </div>
                            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">Deadline: <strong style="color:var(--accent-purple);">${formatEuropeanDateTime(pt.deadline)}</strong></div>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <button class="btn btn-secondary" onclick="openEditDeadlineModal('${pt.id}', '${pt.deadline}', '${escapeHtml(pt.student_username)}')" style="padding:6px 12px; font-size:12px; border-color:var(--accent-purple); color:var(--accent-purple); white-space:nowrap;">🕒 Modifică Termen</button>
                            <button class="btn ${answered > 0 ? 'btn-primary' : 'btn-secondary'}" onclick="previewAssignedTest('${pt.id}')" style="padding:6px 12px; font-size:12px; display:inline-flex; align-items:center; gap:5px; white-space:nowrap;">
                                <span>${answered > 0 ? '👁️' : '📋'}</span>
                                <span>${answered > 0 ? `Vezi Răspunsuri (${answered}/${total})` : 'Vizualizare Întrebări'}</span>
                            </button>
                            <button class="btn btn-secondary" onclick="reassignTest('${pt.id}')" style="padding:6px 12px; font-size:12px; border-color:rgba(251,191,36,0.45); color:#fbbf24; background:rgba(251,191,36,0.06); white-space:nowrap;" title="Șterge răspunsurile și prelungește termenul cu cel puțin 24h">🔄 Șterge & Reasignează</button>
                            <button class="btn btn-secondary" onclick="deleteAssignedTest('${pt.id}')" style="padding:6px 12px; font-size:12px; border-color:rgba(248,113,113,0.35); color:var(--accent-red); background:rgba(248,113,113,0.05); white-space:nowrap;" title="Șterge definitiv testul și toate răspunsurile din baza de date">🗑️ Șterge</button>
                        </div>
                    </div>
                    <div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                            <span style="color:var(--text-secondary);">Progres elev: <strong style="color:${statusColor}">${statusText}</strong></span>
                            <span style="font-weight:600; color:var(--text-primary); font-family:var(--font-code);">${answered}/${total} (${pct}%)</span>
                        </div>
                        <div style="background:rgba(255,255,255,0.08); border-radius:999px; height:8px; width:100%; overflow:hidden;">
                            <div style="background:linear-gradient(90deg, var(--accent-purple), #a78bfa); height:100%; width:${pct}%; border-radius:999px; transition:width 0.4s ease;"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render History
    const tbody = document.getElementById('results-body');
    tbody.innerHTML = '';
    if (studentResults.length === 0) {
        document.getElementById('empty-results').style.display = 'block';
        document.getElementById('wrapper-results').style.display = 'none';
    } else {
        document.getElementById('empty-results').style.display = 'none';
        document.getElementById('wrapper-results').style.display = 'block';

        studentResults.forEach(r => {
            const tr = document.createElement('tr');
            const dateStr = formatDate(r.created_at);
            const timeStr = formatTime(r.time_taken_ms);
            const pct = Math.round((r.score / r.total_points) * 100) || 0;
            const rawType = (r.test_type || 'initial').toLowerCase().trim();
            const isAssigned = r.assigned_test_id || rawType === 'tema' || rawType.startsWith('tema');
            const isInitial = !isAssigned && (rawType === 'initial' || rawType.startsWith('initial') || !r.test_type);
            const testInfo = getAdminTestInfo(r);
            let typeBadge = testInfo.badge;

            const blurDisplay = isAssigned ? '-' : (r.blur_count ?? 0);
            const timeDisplay = isAssigned ? '-' : timeStr;

            tr.innerHTML = `
                        <td style="text-align: center; vertical-align: middle;">${typeBadge}</td>
                        <td style="text-align: center; vertical-align: middle; font-weight:700;">${r.score}/${r.total_points} <span style="color:var(--accent-purple); font-size:12px; margin-left:4px;">${pct}%</span></td>
                        <td style="text-align: center; vertical-align: middle;">${blurDisplay}</td>
                        <td style="text-align: center; vertical-align: middle;">${timeDisplay}</td>
                        <td style="text-align: center; vertical-align: middle; color:var(--text-secondary); font-size:12px;">${dateStr}</td>
                        <td style="text-align: center; vertical-align: middle;">
                            <div style="display: inline-flex; gap: 8px; justify-content: center; align-items: center;">
                                <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 13px;" onclick="viewResultDetails(${r.id})">Detalii</button>
                                <button class="btn btn-danger" style="padding: 6px 12px; font-size: 13px;" onclick="deleteResultHistory(${r.id}, '${r.student_username}')">Șterge</button>
                            </div>
                        </td>
                    `;
            tbody.appendChild(tr);
        });
    }

    // Bind current student to Assign Button
    document.getElementById('assign-username').value = username;
    document.getElementById('assign-student-name').value = username;
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
    (categories || []).forEach(c => { catMap[c.category] = c.percent !== undefined ? c.percent : (c.percentage || 0); });

    const svgWidth = 840;
    const svgHeight = 440;
    const cx = 420, cy = 220, R = 115, n = 5;

    const getLogRadius = (pct) => {
        if (!pct || pct <= 0) return 0.08 * R;
        const norm = Math.min(Math.max(pct, 0), 100) / 100;
        const logRatio = Math.log10(1 + 9 * norm);
        return Math.max(logRatio, 0.08) * R;
    };

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
        gridSvg += `<polygon class="radar-grid ${mIdx === milestoneLevels.length - 1 ? 'outer' : ''}" points="${pts.join(' ')}" style="fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 1;" />`;
        const labelY = cy - m.ratio * R + 3;
        gridSvg += `<text x="${cx + 4}" y="${labelY.toFixed(1)}" fill="rgba(255,255,255,0.35)" font-size="9" font-family="monospace">${m.pct}%</text>`;
    });

    let axesSvg = '', dataPts = [], vertexSvg = '', labelsSvg = '';

    for (let i = 0; i < n; i++) {
        const catInfo = defaultCats[i];
        const pct = catMap[catInfo.name] !== undefined ? catMap[catInfo.name] : 0;
        const angle = (-Math.PI / 2) + (i * 2 * Math.PI / n);

        const axX = cx + R * Math.cos(angle), axY = cy + R * Math.sin(angle);
        axesSvg += `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${axX.toFixed(1)}" y2="${axY.toFixed(1)}" style="stroke: rgba(255,255,255,0.1); stroke-width: 1;" />`;

        const valR = getLogRadius(pct);
        const px = cx + valR * Math.cos(angle), py = cy + valR * Math.sin(angle);
        dataPts.push(`${px.toFixed(1)},${py.toFixed(1)}`);

        vertexSvg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="#38bdf8"></circle>`;

        const labelR = R + 26;
        const lx = cx + labelR * Math.cos(angle), ly = cy + labelR * Math.sin(angle);
        
        let textAnchor = 'middle';
        if (Math.cos(angle) > 0.2) textAnchor = 'start';
        else if (Math.cos(angle) < -0.2) textAnchor = 'end';

        const pctColor = pct >= 80 ? '#34d399' : (pct >= 50 ? '#fbbf24' : (pct > 0 ? '#f87171' : '#94a3b8'));

        labelsSvg += `
            <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${textAnchor}" fill="#fff" font-size="12px" font-weight="600" dominant-baseline="central" style="font-family: var(--font-primary);">
                ${catInfo.icon} ${catInfo.name}
                <tspan dx="5" fill="${pctColor}">(${pct}%)</tspan>
            </text>
        `;
    }

    return `
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto; max-width: ${svgWidth}px; display: block; margin: 0 auto; overflow: visible;" xmlns="http://www.w3.org/2000/svg">
            ${gridSvg}
            ${axesSvg}
            <polygon points="${dataPts.join(' ')}" style="fill: rgba(124, 106, 255, 0.3); stroke: #7c6aff; stroke-width: 2;" />
            ${vertexSvg}
            ${labelsSvg}
        </svg>
    `;
}

async function loadAdminStudentCoverage(username) {
    const listEl = document.getElementById('situatie-admin-categories-list');
    const percentEl = document.getElementById('situatie-admin-coverage-percent');
    const fillEl = document.getElementById('situatie-admin-master-fill');
    if (!listEl) return;

    listEl.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--text-secondary); font-size:12px; padding:10px;">Se încarcă progresul...</div>';

    try {
        const res = await fetchWithToken(`/.netlify/functions/fetch-mastery?username=${encodeURIComponent(username)}`);
        if (!res.ok) {
            listEl.innerHTML = '<div style="grid-column: 1 / -1; color:var(--text-muted); font-size:12px;">Nu s-au putut încărca datele de acoperire.</div>';
            return;
        }
        const data = await res.json();
        
        const catArray = Object.keys(data.mastery).map(catName => ({
            category: catName,
            percent: data.mastery[catName].percentage,
            mastered: data.mastery[catName].correct,
            total: data.mastery[catName].seen,
        }));
        
        let totalMastered = 0, totalSeen = 0;
        catArray.forEach(c => { totalMastered += c.mastered; totalSeen += c.total; });
        const overall_percent = totalSeen > 0 ? Math.round((totalMastered/totalSeen)*100) : 0;

        if (percentEl) percentEl.textContent = `${overall_percent}% Acuratețe (${totalMastered}/${totalSeen} corecte)`;
        if (fillEl) fillEl.style.width = `${overall_percent}%`;

        const radarHtml = generateRadarChartSVG(catArray);

        const catIcons = {
            'Fundamente': '📘',
            'Organizarea Datelor': '📗',
            'Subprograme': '📙',
            'Backtracking': '📕',
            'Grafuri si Arbori': '📓'
        };

        let html = `
            <div style="grid-column: 1 / -1; margin-bottom: 20px;">
                ${radarHtml}
            </div>
        `;

        if (catArray.length > 0) {
            html += catArray.map(cat => {
                const icon = catIcons[cat.category] || '📂';
                let statusColor = cat.percent >= 80 ? 'var(--accent-green)' : (cat.percent >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)');
                let statusText = cat.percent >= 80 ? 'Stăpânit' : (cat.percent >= 50 ? 'Aproape' : (cat.total > 0 ? 'Risc ridicat. Trebuie lucrat' : 'Neatins'));
                return `
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 12px; margin-bottom: 10px;">
                        <div style="display:flex; justify-content:space-between; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px;">
                            <span>${icon} ${escapeHtml(cat.category)}</span>
                            <span style="color: ${statusColor};">${cat.percent}% — ${statusText}</span>
                        </div>
                        <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 10px; overflow: hidden; margin-bottom: 4px;">
                            <div style="height: 100%; background: linear-gradient(90deg, var(--accent-purple), #38bdf8); width: ${cat.percent}%; border-radius: 10px;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-secondary);">
                            <span>${cat.mastered}/${cat.total} întrebări răspuns corect</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
        listEl.innerHTML = html;
        // set layout to stack items
        listEl.style.display = 'block';

    } catch (e) {
        console.error('Error loading admin student coverage:', e);
        listEl.innerHTML = '<div style="grid-column: 1 / -1; color:var(--text-muted); font-size:12px;">Eroare la încărcare.</div>';
    }
}
window.loadAdminStudentCoverage = loadAdminStudentCoverage;

async function openStudentPracticeDetails(username, category = 'all') {
    const modal = document.getElementById('modal-details');
    const titleEl = document.getElementById('details-student-name');
    const metaEl = document.getElementById('details-student-meta');
    const listEl = document.getElementById('details-list');

    modal.style.display = 'flex';
    titleEl.textContent = `📚 Lucru Individual: ${username}`;
    metaEl.textContent = `Se încarcă întrebările (${category === 'all' ? 'Toate Categoriile' : category})...`;
    listEl.innerHTML = '<div style="text-align:center; padding: 40px;"><div class="spinner" style="margin: 0 auto 12px auto;"></div><p style="color:var(--text-secondary);">Se preiau răspunsurile elevului...</p></div>';

    try {
        const res = await fetchWithToken(`/.netlify/functions/manage-practice?action=get_student_practice_details&student_username=${encodeURIComponent(username)}&category=${encodeURIComponent(category)}`);
        if (!res.ok) throw new Error('Nu s-au putut prelua detaliile de lucru individual.');
        const data = await res.json();

        const totalQs = (data.details || []).length;
        const correctQs = (data.details || []).filter(d => d && d.isCorrect === true).length;
        const wrongQs = totalQs - correctQs;

        currentSelectedResult = {
            student_name: username,
            student_username: username,
            score: correctQs,
            total_points: totalQs,
            time_taken_ms: 0,
            blur_count: 0,
            details_json: data.details || []
        };

        const countAllEl = document.getElementById('count-all');
        const countWrongEl = document.getElementById('count-wrong');
        const countCorrectEl = document.getElementById('count-correct');
        if (countAllEl) countAllEl.textContent = totalQs;
        if (countWrongEl) countWrongEl.textContent = wrongQs;
        if (countCorrectEl) countCorrectEl.textContent = correctQs;

        metaEl.textContent = `Total: ${totalQs} întrebări întâlnite (${correctQs} corecte, ${wrongQs} greșite) • ${category === 'all' ? 'Toate Categoriile' : category}`;

        // Reset filter buttons UI
        document.querySelectorAll('.details-filter-btn').forEach(btn => btn.classList.remove('active'));
        const defaultFilterBtn = document.getElementById('filter-btn-all');
        if (defaultFilterBtn) defaultFilterBtn.classList.add('active');

        renderDetailsList(data.details || [], 'all');
    } catch (e) {
        console.error('Error opening student practice details:', e);
        listEl.innerHTML = `<p style="color:var(--accent-red); padding:20px; text-align:center;">Eroare: ${escapeHtml(e.message)}</p>`;
    }
}
window.openStudentPracticeDetails = openStudentPracticeDetails;

let manuallySelectedQuestions = new Set();

async function openManualSelectModal() {
    document.getElementById('modal-manual-select').style.display = 'flex';
    const list = document.getElementById('manual-select-list');

    // Sync category filter with assign-category
    const assignCat = document.getElementById('assign-category') ? document.getElementById('assign-category').value : 'Diverse';
    const modalCat = document.getElementById('manual-filter-cat');
    if (modalCat) modalCat.value = assignCat;

    if (!questionsData || questionsData.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding: 40px;"><div class="spinner" style="margin: 0 auto 12px auto;"></div><p style="color:var(--text-secondary);">Se încarcă întrebările din baza de date...</p></div>';
        await loadQuestions();
    }

    renderManualSelectionList();
}

function closeManualSelectModal() {
    document.getElementById('modal-manual-select').style.display = 'none';
}

function getStudentQuestionStatus(username) {
    const statusMap = {};
    if (!resultsData || !username) return statusMap;
    const lowerUser = username.toLowerCase().trim();
    const studentResults = resultsData.filter(r => 
        (r.student_name && r.student_name.toLowerCase().trim() === lowerUser) || 
        (r.student_username && r.student_username.toLowerCase().trim() === lowerUser)
    );

    studentResults.forEach(r => {
        let details = r.details_json;
        if (typeof details === 'string') {
            try { details = JSON.parse(details); } catch(e) { details = []; }
        }
        if (Array.isArray(details)) {
            details.forEach(item => {
                if (item && item.id) {
                    if (item.isCorrect) {
                        statusMap[item.id] = 'CORECT'; // Prioritize correct
                    } else if (statusMap[item.id] !== 'CORECT') {
                        statusMap[item.id] = 'GRESIT';
                    }
                }
            });
        }
    });
    return statusMap;
}

window.updateManualSubcats = function() {
    const cat = document.getElementById('manual-filter-subject').value;
    const subcatSelect = document.getElementById('manual-filter-subcat');
    if (!subcatSelect) return;
    if (cat === 'Toate') {
        subcatSelect.style.display = 'none';
        subcatSelect.innerHTML = '<option value="Toate">Toate Subcategoriile</option>';
        return;
    }
    subcatSelect.style.display = 'block';
    subcatSelect.innerHTML = '<option value="Toate">Toate Subcategoriile</option>';
    if (subcategoriesMap[cat]) {
        subcategoriesMap[cat].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            subcatSelect.appendChild(opt);
        });
    }
};

function renderManualSelectionList() {
    const list = document.getElementById('manual-select-list');
    const searchTerm = (document.getElementById('manual-search').value || '').toLowerCase().trim();
    const modalCat = document.getElementById('manual-filter-cat');
    const examType = modalCat ? modalCat.value : (document.getElementById('assign-category').value || 'Diverse');
    
    const modalSubject = document.getElementById('manual-filter-subject');
    const subject = modalSubject ? modalSubject.value : 'Toate';
    
    const modalSubcat = document.getElementById('manual-filter-subcat');
    const subcat = modalSubcat ? modalSubcat.value : 'Toate';
    
    const targetUsername = document.getElementById('assign-username').value;
    const statusMap = getStudentQuestionStatus(targetUsername);

    let filtered = questionsData;
    if (examType !== 'Diverse' && examType !== 'Toate') {
        filtered = filtered.filter(q => (q.exam_type || 'Diverse').includes(examType));
    }
    if (subject !== 'Toate') {
        filtered = filtered.filter(q => (q.category || '') === subject);
    }
    if (subcat !== 'Toate') {
        filtered = filtered.filter(q => (q.subcategory || '') === subcat);
    }

    if (searchTerm) {
        filtered = filtered.filter(q =>
            (q.text || '').toLowerCase().includes(searchTerm) ||
            (q.code || '').toLowerCase().includes(searchTerm) ||
            (q.category || '').toLowerCase().includes(searchTerm) ||
            (q.subcategory || '').toLowerCase().includes(searchTerm) ||
            String(q.id).includes(searchTerm)
        );
    }

    list.innerHTML = '';

    if (filtered.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 30px;">Nu există întrebări disponibile conform filtrelor selectate.</p>';
        return;
    }

    filtered.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'detail-card';
        card.style.display = 'flex';
        card.style.gap = '14px';
        card.style.alignItems = 'flex-start';
        card.style.padding = '16px';
        card.style.border = '1px solid var(--border-color, rgba(255,255,255,0.08))';
        card.style.borderRadius = '8px';
        card.style.background = 'var(--bg-card, rgba(255,255,255,0.02))';
        card.style.overflow = 'hidden';
        card.style.flexShrink = '0';
        card.style.width = '100%';
        card.style.boxSizing = 'border-box';

        const isChecked = manuallySelectedQuestions.has(q.id) ? 'checked' : '';
        const formattedCode = formatCodeText(q.code);
        const formattedText = formatQuestionText(q.text);

        let optsHtml = '';
        try {
            const opts = typeof q.options_json === 'string' ? JSON.parse(q.options_json) : q.options_json;
            if (opts && Array.isArray(opts)) {
                optsHtml = opts.map((opt, i) => {
                    const isCorrect = i === q.correct_index;
                    return `<div style="font-size:13px; color:var(--text-secondary); margin-bottom:4px; ${isCorrect ? 'color:var(--accent-green, #4ade80); font-weight:bold;' : ''}">${String.fromCharCode(65 + i)}. ${escapeHtml(opt)}${isCorrect ? ' (Corect)' : ''}</div>`;
                }).join('');
                optsHtml = `<div style="margin-top:8px;">${optsHtml}</div>`;
            }
        } catch (e) { }

        let statusHtml = `<div style="padding: 6px 12px; font-size: 13px; font-weight: bold; border-radius: 6px; background:var(--bg-lighter); color:var(--text-secondary); box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: inline-flex; align-items: center; gap: 6px;"><span style="font-size: 14px;">🆕</span> NOU</div>`;
        if (statusMap[q.id] === 'CORECT') {
            statusHtml = `<div style="padding: 6px 12px; font-size: 13px; font-weight: bold; border-radius: 6px; background:rgba(74, 222, 128, 0.15); color:var(--accent-green); box-shadow: 0 2px 8px rgba(74, 222, 128, 0.1); display: inline-flex; align-items: center; gap: 6px;"><span style="font-size: 14px;">✅</span> CORECT</div>`;
        } else if (statusMap[q.id] === 'GRESIT') {
            statusHtml = `<div style="padding: 6px 12px; font-size: 13px; font-weight: bold; border-radius: 6px; background:rgba(239, 68, 68, 0.15); color:var(--accent-red); box-shadow: 0 2px 8px rgba(239, 68, 68, 0.1); display: inline-flex; align-items: center; gap: 6px;"><span style="font-size: 14px;">❌</span> GREȘIT</div>`;
        }

        card.innerHTML = `
            <div style="margin-top: 4px; padding: 4px; flex-shrink: 0;">
                <input type="checkbox" id="chk-manual-q-${q.id}" style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--accent-purple, #7c6aff);" onchange="toggleManualSelection(${q.id}, this.checked)" ${isChecked}>
            </div>
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <span class="badge badge-${q.difficulty || 'medium'}">${q.difficulty || 'Normal'}</span>
                    <span class="badge" style="background:rgba(255,255,255,0.1);">${q.exam_type || 'Diverse'}</span>
                    <span class="badge" style="background:rgba(124,106,255,0.15); color:var(--accent-purple);">${q.category || ''}</span>
                    ${q.subcategory ? `<span class="badge" style="background:rgba(255,255,255,0.05); font-size:11px;">${q.subcategory}</span>` : ''}
                    <span style="font-size: 11px; color: var(--text-secondary); margin-left: auto;">ID: #${q.id}</span>
                </div>
                <label for="chk-manual-q-${q.id}" class="q-text" style="margin-top:8px; display:block; cursor:pointer; font-weight:500; white-space:pre-wrap; word-break:break-word;">${escapeHtml(formattedText)}</label>
                ${formattedCode ? `<div class="detail-code" style="background:#0c0d1e; padding:10px; border-radius:4px; font-size:12px; color:#a6accd; margin:8px 0; max-width:100%; overflow-x:auto;"><pre style="margin:0; font-family: monospace; white-space: pre-wrap; word-break: break-word;">${escapeHtml(formattedCode)}</pre></div>` : ''}
                ${(() => {
                const qImgs = parseImageUrls(q.image_url);
                return qImgs.length > 0 ? `
                        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; margin:10px auto; text-align:center; width:100%;">
                            ${qImgs.map(u => `<img src="${u}" style="max-height:180px; border-radius:8px; max-width:100%; display:block; margin:0 auto; box-shadow:0 4px 10px rgba(0,0,0,0.3);">`).join('')}
                        </div>` : '';
            })()}
                ${optsHtml}
                <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px;">
                    <span style="font-size: 12px; color: var(--text-muted); margin-right: 12px;">Status Elev Curent:</span>
                    ${statusHtml}
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

function toggleManualSelection(qId, isSelected) {
    if (isSelected) {
        manuallySelectedQuestions.add(qId);
    } else {
        manuallySelectedQuestions.delete(qId);
    }
    const countEl = document.getElementById('manual-selected-count');
    if (countEl) countEl.innerText = `${manuallySelectedQuestions.size} selectate`;
}

function confirmManualSelection() {
    closeManualSelectModal();
    const status = document.getElementById('manual-selection-status');
    const inputCount = document.getElementById('assign-count');

    if (manuallySelectedQuestions.size > 0) {
        status.innerText = `Ai selectat manual ${manuallySelectedQuestions.size} întrebări.`;
        if (parseInt(inputCount.value) < manuallySelectedQuestions.size) {
            inputCount.value = manuallySelectedQuestions.size;
        }
    } else {
        status.innerText = `Nicio întrebare selectată.`;
    }
}

function openAssignTestModal(username) {
    if (username) {
        document.getElementById('assign-username').value = username;
        document.getElementById('assign-student-name').value = username;
    }

    manuallySelectedQuestions.clear();
    const statusEl = document.getElementById('manual-selection-status');
    if (statusEl) statusEl.innerText = 'Nicio întrebare selectată.';

    // set default deadline tomorrow at 20:00 (24h)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(20, 0, 0, 0);

    setDateTimeSelects('assign', tomorrow);
    updateAssignDeadlinePreview();

    document.getElementById('modal-assign').style.display = 'flex';
}

function closeAssignModal() {
    document.getElementById('modal-assign').style.display = 'none';
}

function openEditDeadlineModal(testId, currentDeadlineIso, username) {
    document.getElementById('edit-deadline-test-id').value = testId;
    document.getElementById('edit-deadline-student-username').value = username || '';

    const test = assignedTestsData.find(t => String(t.id) === String(testId));
    const infoEl = document.getElementById('edit-deadline-info');
    if (infoEl) {
        const cat = test ? test.exam_type : 'Temă';
        const qCount = test ? (test.target_length || (test.questions_ids ? test.questions_ids.length : 0)) : 0;
        infoEl.innerHTML = `<span>👤 Elev: <strong>${escapeHtml(username)}</strong> • Test: <strong>${escapeHtml(cat)}</strong> (${qCount} întrebări)</span>`;
    }

    const curDate = currentDeadlineIso ? new Date(currentDeadlineIso) : new Date();
    setDateTimeSelects('edit-deadline', curDate);
    updateEditDeadlinePreview();

    document.getElementById('modal-edit-deadline').style.display = 'flex';
}
window.openEditDeadlineModal = openEditDeadlineModal;

function closeEditDeadlineModal() {
    document.getElementById('modal-edit-deadline').style.display = 'none';
}
window.closeEditDeadlineModal = closeEditDeadlineModal;

async function handleEditDeadlineSubmit(e) {
    e.preventDefault();
    const testId = document.getElementById('edit-deadline-test-id').value;
    const username = document.getElementById('edit-deadline-student-username').value;
    const deadlineIso = getDateTimeFromSelects('edit-deadline');

    if (!deadlineIso) {
        showToast('Te rugăm să selectezi o dată și o oră valide!', true);
        return;
    }

    const btn = document.getElementById('btn-save-edit-deadline');
    btn.disabled = true;
    btn.textContent = 'Se actualizează...';

    try {
        const res = await fetchWithToken(API_ASSIGNED_TESTS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_deadline',
                id: testId,
                deadline: deadlineIso
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Eroare la actualizarea termenului');
        }

        showToast('Termenul temei a fost actualizat cu succes!');
        closeEditDeadlineModal();

        // Refresh assigned tests data
        const asRes = await fetchWithToken(API_ASSIGNED_TESTS);
        if (asRes.ok) {
            assignedTestsData = await asRes.json();
        }
        if (username) {
            openSituatieDetail(username);
        }
    } catch (err) {
        showToast(err.message || 'Eroare la salvare', true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvează Termenul Nou';
    }
}
window.handleEditDeadlineSubmit = handleEditDeadlineSubmit;

function viewResultDetails(id) {
    const r = resultsData.find(res => res.id === id);
    if (!r) return;

    const nameEl = document.getElementById('details-student-name');
    if (nameEl) nameEl.innerText = `Detalii Test Student: ${r.student_username}`;

    let detailsJson = r.details_json;
    if (typeof detailsJson === 'string') {
        try { detailsJson = JSON.parse(detailsJson); } catch (e) { detailsJson = []; }
    }

    renderDetailsList(detailsJson, 'all');
    document.getElementById('modal-details').style.display = 'flex';
}

let currentDraftTest = null;

document.getElementById('assign-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('assign-username').value;
    const category = document.getElementById('assign-category').value;
    const count = parseInt(document.getElementById('assign-count').value);
    const deadline = getDateTimeFromSelects('assign');

    if (!deadline) {
        showToast('Te rugăm să selectezi data și ora termenului limită!', true);
        return;
    }

    const btn = document.getElementById('btn-assign-save');
    btn.disabled = true;
    btn.innerText = "Se generează...";

    try {
        const res = await fetchWithToken(API_ASSIGNED_TESTS, {
            method: 'POST',
            body: JSON.stringify({
                student_username: username,
                exam_type: category,
                target_length: count,
                deadline: deadline,
                preselected_ids: Array.from(manuallySelectedQuestions),
                draft: true // DO NOT INSERT YET
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Eroare necunoscută');
        }

        currentDraftTest = await res.json();
        closeAssignModal();
        previewAssignedTest(null, currentDraftTest);

    } catch (err) {
        showToast('Eroare: ' + err.message, true);
    } finally {
        btn.disabled = false;
        btn.innerText = "Generează Test";
    }
});

async function saveDraftTest() {
    if (!currentDraftTest) return;
    const btn = document.getElementById('btn-send-draft');
    if (btn) { btn.disabled = true; btn.innerText = "Se trimite..."; }

    try {
        const res = await fetchWithToken(API_ASSIGNED_TESTS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                save_draft: true,
                ...currentDraftTest
            })
        });

        if (!res.ok) throw new Error('Eroare la salvare');
        showToast('Testul a fost trimis elevului cu succes!');
        closePreviewModal();
        await loadSituatie();
        if (document.getElementById('situatie-detail-view').style.display === 'block') {
            const username = document.getElementById('assign-username').value;
            if (username) openSituatieDetail(username);
        }
    } catch (e) {
        showToast(e.message, true);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "Trimite Testul Elevului"; }
    }
}

let currentlyPreviewedTestId = null;
let isPreviewingDraft = false;
let currentAssignedFilter = 'all';
let currentlyPreviewedTestObj = null;
let currentlyPreviewedTestQuestions = [];

function setAssignedPreviewFilter(filter) {
    currentAssignedFilter = filter;
    renderPreviewTest(currentlyPreviewedTestQuestions, currentlyPreviewedTestObj);
}
window.setAssignedPreviewFilter = setAssignedPreviewFilter;

async function previewAssignedTest(id, draftTest = null) {
    let test;
    if (draftTest) {
        test = draftTest;
        currentlyPreviewedTestId = 'draft';
        isPreviewingDraft = true;
    } else {
        test = assignedTestsData.find(t => t.id === id);
        currentlyPreviewedTestId = id;
        isPreviewingDraft = false;
    }
    if (!test) return;

    const list = document.getElementById('preview-test-list');
    list.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';
    document.getElementById('modal-preview-test').style.display = 'flex';

    // Update Modal Header Title
    const titleEl = document.querySelector('#modal-preview-test h2');
    if (titleEl) {
        if (isPreviewingDraft) {
            titleEl.textContent = 'Vizualizare Întrebări (Draft)';
        } else if (test.student_username) {
            titleEl.textContent = `Status & Răspunsuri Temă: ${test.student_username}`;
        } else {
            titleEl.textContent = 'Vizualizare Întrebări Test Asignat';
        }
    }

    // Insert Save Button if Draft
    let actionDiv = document.getElementById('preview-actions');
    if (!actionDiv) {
        actionDiv = document.createElement('div');
        actionDiv.id = 'preview-actions';
        actionDiv.style.marginTop = '20px';
        actionDiv.style.textAlign = 'right';
        document.getElementById('modal-preview-test').querySelector('.modal-content').appendChild(actionDiv);
    }
    if (isPreviewingDraft) {
        actionDiv.innerHTML = `<button id="btn-send-draft" class="btn btn-primary" style="font-size:16px; padding:10px 20px;" onclick="saveDraftTest()">Trimite Testul Elevului</button>`;
        actionDiv.style.display = 'block';
    } else {
        actionDiv.style.display = 'none';
    }

    // Extract questions
    if (questionsData.length === 0 || (Array.isArray(test.questions_ids) && test.questions_ids.some(qid => !questionsData.some(q => String(q.id) === String(qid))))) {
        await loadQuestions();
    }

    const testQs = (test.questions_ids || []).map(qid => questionsData.find(q => String(q.id) === String(qid))).filter(Boolean);

    currentlyPreviewedTestObj = test;
    currentlyPreviewedTestQuestions = testQs;
    currentAssignedFilter = 'all';

    renderPreviewTest(testQs, test);
}

function renderPreviewTest(testQs, test = null) {
    const list = document.getElementById('preview-test-list');
    list.innerHTML = '';

    if (testQs.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary); padding:20px; text-align:center;">Testul nu conține nicio întrebare validă.</p>';
        return;
    }

    const hasAnswers = test && test.current_answers && Array.isArray(test.current_answers);

    // Summary Header Banner & Filter Tabs for Assigned Tests
    if (test && !isPreviewingDraft) {
        let answeredCount = 0;
        let correctCount = 0;

        testQs.forEach((q, idx) => {
            const a = hasAnswers ? test.current_answers[idx] : null;
            if (a !== null && a !== undefined) {
                answeredCount++;
                if (a === q.correct_index) correctCount++;
            }
        });

        const wrongCount = answeredCount - correctCount;
        const totalCount = testQs.length;
        const unansweredCount = totalCount - answeredCount;
        const pct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

        const banner = document.createElement('div');
        banner.style.cssText = 'background: rgba(124, 106, 255, 0.12); border: 1px solid var(--accent-purple); border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; width: 100%; box-sizing: border-box;';
        banner.innerHTML = `
            <div>
                <div style="font-size: 16px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
                    <span>📝</span> Progres Temă Elev: <strong style="color: var(--accent-purple);">${escapeHtml(test.student_username || '')}</strong>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                    Test ${escapeHtml(test.exam_type || '')} • Termen: <strong>${formatEuropeanDateTime(test.deadline)}</strong>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 18px; font-weight: 800; color: #fff; font-family: var(--font-code);">
                    ${answeredCount} / ${totalCount} <span style="font-size: 13px; font-weight: 500; color: var(--text-secondary);">răspunsuri salvate (${pct}%)</span>
                </div>
                <div style="font-size: 12px; margin-top: 2px;">
                    ${answeredCount > 0 
                        ? `<span style="color: var(--accent-green); font-weight: 700;">✓ ${correctCount} Corecte</span> &nbsp;•&nbsp; <span style="color: var(--accent-red); font-weight: 700;">✗ ${wrongCount} Greșite</span>`
                        : '<span style="color: var(--text-muted);">Elevul nu a început încă rezolvarea</span>'}
                </div>
            </div>
        `;
        list.appendChild(banner);

        // Filter tabs bar (identical styling to results modal)
        const tabsBar = document.createElement('div');
        tabsBar.style.cssText = 'display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap;';
        tabsBar.innerHTML = `
            <button class="btn btn-secondary details-filter-btn ${currentAssignedFilter === 'all' ? 'active' : ''}" onclick="setAssignedPreviewFilter('all')">Toate ( ${totalCount} )</button>
            <button class="btn btn-secondary details-filter-btn ${currentAssignedFilter === 'wrong' ? 'active' : ''}" style="border-color: rgba(248, 113, 113, 0.4);" onclick="setAssignedPreviewFilter('wrong')">❌ Greșite ( ${wrongCount} )</button>
            <button class="btn btn-secondary details-filter-btn ${currentAssignedFilter === 'correct' ? 'active' : ''}" style="border-color: rgba(52, 211, 153, 0.4);" onclick="setAssignedPreviewFilter('correct')">✔️ Corecte ( ${correctCount} )</button>
            <button class="btn btn-secondary details-filter-btn ${currentAssignedFilter === 'unanswered' ? 'active' : ''}" style="border-color: rgba(255, 255, 255, 0.2);" onclick="setAssignedPreviewFilter('unanswered')">⏳ Necompletate ( ${unansweredCount} )</button>
        `;
        list.appendChild(tabsBar);
    }

    let renderedCardsCount = 0;

    testQs.forEach((q, idx) => {
        const studentAns = (hasAnswers && test.current_answers[idx] !== undefined) ? test.current_answers[idx] : null;
        const isAnswered = (studentAns !== null && studentAns !== undefined);
        const isStudentCorrect = isAnswered && (studentAns === q.correct_index);

        // Apply tab filter if viewing an assigned test in progress
        if (test && !isPreviewingDraft) {
            if (currentAssignedFilter === 'wrong' && (!isAnswered || isStudentCorrect)) return;
            if (currentAssignedFilter === 'correct' && (!isAnswered || !isStudentCorrect)) return;
            if (currentAssignedFilter === 'unanswered' && isAnswered) return;
        }

        renderedCardsCount++;

        const card = document.createElement('div');
        // Card styling: exact match with viewResultDetails
        let cardClass = 'detail-card';
        if (test && !isPreviewingDraft && isAnswered) {
            cardClass += isStudentCorrect ? ' correct' : ' wrong';
        }
        card.className = cardClass;
        card.style.overflow = 'hidden';
        card.style.flexShrink = '0';
        card.style.width = '100%';
        card.style.boxSizing = 'border-box';
        card.style.marginBottom = '14px';

        const formattedCode = formatCodeText(q.code);
        const formattedText = formatQuestionText(q.text);
        const codeHtml = formattedCode ? `<div class="detail-code">${escapeHtml(formattedCode)}</div>` : '';
        const qImgs = parseImageUrls(q.image_url);
        const imageHtml = qImgs.length > 0 ? `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; margin:10px auto; text-align:center; width:100%;">
                ${qImgs.map(u => `<img src="${u}" style="max-height:180px; border-radius:8px; max-width:100%; display:block; margin:0 auto; box-shadow:0 4px 10px rgba(0,0,0,0.3); cursor:zoom-in;" onclick="openAdminLightbox('${u}')" title="Click pentru mărire">`).join('')}
            </div>` : '';

        const diffMap = { easy: 'Ușoară', medium: 'Medie', hard: 'Grea' };
        const diffLabel = diffMap[q.difficulty] || q.difficulty || 'Normal';

        // Right side badge in header
        let statusBadge = '';
        if (test && !isPreviewingDraft) {
            if (isAnswered) {
                statusBadge = isStudentCorrect
                    ? `<span class="score-badge score-excellent" style="padding: 4px 12px; font-size: 12px;">✔️ Corect</span>`
                    : `<span class="score-badge score-low" style="padding: 4px 12px; font-size: 12px;">❌ Greșit</span>`;
            } else {
                statusBadge = `<span class="score-badge" style="background:rgba(255,255,255,0.08); color:var(--text-muted); padding: 4px 12px; font-size: 12px;">⏳ Necompletat</span>`;
            }
        }

        let opts = [];
        if (Array.isArray(q.options)) {
            opts = q.options;
        } else if (typeof q.options === 'string') {
            try { opts = JSON.parse(q.options); } catch (e) { opts = []; }
        } else if (Array.isArray(q.options_json)) {
            opts = q.options_json;
        } else if (typeof q.options_json === 'string') {
            try { opts = JSON.parse(q.options_json); } catch (e) { opts = []; }
        }
        if (!Array.isArray(opts)) opts = [];

        let optsHtml = '';
        let hintHtml = '';

        if (test && !isPreviewingDraft) {
            if (isAnswered) {
                // Întrebări la care elevul a răspuns deja (similar ca în interfața rezultat test)
                optsHtml = opts.map((optText, optIdx) => {
                    const isStudentChoice = studentAns === optIdx;
                    const isCorrectChoice = q.correct_index === optIdx;

                    let optClass = '';
                    let tagHtml = '';

                    if (isCorrectChoice) {
                        optClass = 'opt-correct';
                        tagHtml = `<span class="detail-opt-tag tag-correct">${isStudentChoice ? 'Ales de student (Corect)' : 'Răspuns Corect'}</span>`;
                    } else if (isStudentChoice && !isStudentCorrect) {
                        optClass = 'opt-wrong';
                        tagHtml = `<span class="detail-opt-tag tag-wrong">Ales de student (Incorect)</span>`;
                    }

                    const optLetter = String.fromCharCode(65 + optIdx);
                    return `
                        <div class="detail-opt ${optClass}">
                            <span><strong>${optLetter}.</strong> ${escapeHtml(optText)}</span>
                            ${tagHtml}
                        </div>
                    `;
                }).join('');
            } else {
                // Întrebări la care elevul NU a răspuns încă: profesorul vede toate variantele, cu răspunsul corect evidențiat
                optsHtml = opts.map((optText, optIdx) => {
                    const isCorrectChoice = q.correct_index === optIdx;
                    let optClass = '';
                    let tagHtml = '';

                    if (isCorrectChoice) {
                        optClass = 'opt-correct';
                        tagHtml = `<span class="detail-opt-tag tag-correct">Răspuns Corect</span>`;
                    }

                    const optLetter = String.fromCharCode(65 + optIdx);
                    return `
                        <div class="detail-opt ${optClass}">
                            <span><strong>${optLetter}.</strong> ${escapeHtml(optText)}</span>
                            ${tagHtml}
                        </div>
                    `;
                }).join('');
            }

            if (q.hint || q.explanation) {
                hintHtml = `<div style="margin-top:14px; font-size:13px; color:var(--text-secondary); background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:6px; border-left:3px solid var(--accent-purple); line-height: 1.5;">💡 <em>${escapeHtml(q.hint || q.explanation)}</em></div>`;
            }
        } else {
            // Mod Draft (înainte de trimitere test către elev)
            optsHtml = opts.map((optText, optIdx) => {
                const isCorrectOpt = optIdx === q.correct_index;
                return `
                    <div class="detail-opt ${isCorrectOpt ? 'opt-correct' : ''}">
                        <span><strong>${String.fromCharCode(65 + optIdx)}.</strong> ${escapeHtml(optText)}</span>
                        ${isCorrectOpt ? '<span class="detail-opt-tag tag-correct">Răspuns Corect</span>' : ''}
                    </div>
                `;
            }).join('');
            if (q.hint || q.explanation) {
                hintHtml = `<div style="margin-top:12px; font-size:12px; color:var(--text-secondary); background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:6px; border-left:3px solid var(--accent-purple);">💡 <em>${escapeHtml(q.hint || q.explanation)}</em></div>`;
            }
        }

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; width: 100%;">
                <div style="flex: 1; min-width: 0;">
                    <div class="detail-header">
                        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                            <span style="font-weight:700; color:var(--accent-purple); font-size:14px;">#${idx + 1}</span>
                            <span class="badge" style="background:rgba(255,255,255,0.06); color:var(--text-secondary);">DIFICULTATE: ${diffLabel.toUpperCase()}</span>
                            <span class="badge" style="background:rgba(255,255,255,0.08);">${q.exam_type || 'Diverse'}</span>
                            <span class="badge" style="background:rgba(124,106,255,0.15); color:var(--accent-purple);">${q.category || ''}</span>
                            ${q.subcategory ? `<span class="badge" style="background:rgba(255,255,255,0.05); font-size:11px;">${q.subcategory}</span>` : ''}
                            <span style="font-size: 11px; color: var(--text-secondary); margin-left: 6px;">ID: #${q.id}</span>
                        </div>
                        <div>${statusBadge}</div>
                    </div>
                    <div class="q-text" style="margin-top:10px; font-size:15px; font-weight:600; color:var(--text-primary); white-space:pre-wrap; word-break:break-word;">${escapeHtml(formattedText)}</div>
                    ${codeHtml}
                    ${imageHtml}
                    <div style="margin-top:14px;">${optsHtml}</div>
                    ${hintHtml}
                </div>
                ${isPreviewingDraft ? `
                    <div style="display:flex; flex-direction:column; gap:8px; flex-shrink: 0;">
                        <button class="btn btn-secondary" title="Schimbă aleator" style="font-size: 18px; padding: 6px 10px; border-color:var(--accent-purple); line-height: 1;" onclick="regenerateQuestion('${currentlyPreviewedTestId}', ${q.id})">♻️</button>
                        <button class="btn btn-secondary" title="Înlocuiește manual" style="font-size: 14px; padding: 6px 10px; border-color:var(--accent-purple);" onclick="openManualReplaceModal('${currentlyPreviewedTestId}', ${q.id})">✏️</button>
                    </div>
                ` : ''}
            </div>
        `;
        list.appendChild(card);
    });

    if (renderedCardsCount === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'text-align:center; padding:30px; color:var(--text-secondary);';
        emptyDiv.textContent = 'Nicio întrebare găsită pentru filtrul selectat.';
        list.appendChild(emptyDiv);
    }
}

let replacingQuestionId = null;
let replacingDraftId = null;

window.openManualReplaceModal = async function (draftId, oldQuestionId) {
    replacingDraftId = draftId;
    replacingQuestionId = oldQuestionId;
    document.getElementById('modal-manual-replace').style.display = 'flex';
    const list = document.getElementById('manual-replace-list');

    // Sync category filter in modal with assign-category
    const assignCat = document.getElementById('assign-category') ? document.getElementById('assign-category').value : 'Diverse';
    const modalCat = document.getElementById('manual-replace-filter-cat');
    if (modalCat) modalCat.value = assignCat;

    if (!questionsData || questionsData.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding: 40px;"><div class="spinner" style="margin: 0 auto 12px auto;"></div><p style="color:var(--text-secondary);">Se încarcă întrebările...</p></div>';
        await loadQuestions();
    }

    renderManualReplaceList();
};

window.closeManualReplaceModal = function () {
    document.getElementById('modal-manual-replace').style.display = 'none';
};

window.updateManualReplaceSubcats = function() {
    const cat = document.getElementById('manual-replace-filter-subject').value;
    const subcatSelect = document.getElementById('manual-replace-filter-subcat');
    if (!subcatSelect) return;
    if (cat === 'Toate') {
        subcatSelect.style.display = 'none';
        subcatSelect.innerHTML = '<option value="Toate">Toate Subcategoriile</option>';
        return;
    }
    subcatSelect.style.display = 'block';
    subcatSelect.innerHTML = '<option value="Toate">Toate Subcategoriile</option>';
    if (subcategoriesMap[cat]) {
        subcategoriesMap[cat].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            subcatSelect.appendChild(opt);
        });
    }
};

window.renderManualReplaceList = function () {
    const list = document.getElementById('manual-replace-list');
    const searchTerm = (document.getElementById('manual-replace-search').value || '').toLowerCase().trim();
    const modalCat = document.getElementById('manual-replace-filter-cat');
    const examType = modalCat ? modalCat.value : (document.getElementById('assign-category').value || 'Diverse');
    
    const modalSubject = document.getElementById('manual-replace-filter-subject');
    const subject = modalSubject ? modalSubject.value : 'Toate';
    
    const modalSubcat = document.getElementById('manual-replace-filter-subcat');
    const subcat = modalSubcat ? modalSubcat.value : 'Toate';

    const currentIds = new Set(currentDraftTest ? currentDraftTest.questions_ids : []);

    let filtered = questionsData.filter(q => !currentIds.has(q.id));

    if (examType !== 'Diverse' && examType !== 'Toate') {
        filtered = filtered.filter(q => (q.exam_type || 'Diverse').includes(examType));
    }
    if (subject !== 'Toate') {
        filtered = filtered.filter(q => (q.category || '') === subject);
    }
    if (subcat !== 'Toate') {
        filtered = filtered.filter(q => (q.subcategory || '') === subcat);
    }

    if (searchTerm) {
        filtered = filtered.filter(q =>
            (q.text || '').toLowerCase().includes(searchTerm) ||
            (q.code || '').toLowerCase().includes(searchTerm) ||
            (q.category || '').toLowerCase().includes(searchTerm) ||
            (q.subcategory || '').toLowerCase().includes(searchTerm) ||
            String(q.id).includes(searchTerm)
        );
    }

    list.innerHTML = '';

    if (filtered.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 30px;">Nu există alte întrebări disponibile pentru înlocuire conform filtrelor.</p>';
        return;
    }

    filtered.forEach(q => {
        const card = document.createElement('div');
        card.className = 'detail-card';
        card.style.display = 'flex';
        card.style.gap = '14px';
        card.style.alignItems = 'flex-start';
        card.style.padding = '16px';
        card.style.border = '1px solid var(--border-color, rgba(255,255,255,0.08))';
        card.style.borderRadius = '8px';
        card.style.background = 'var(--bg-card, rgba(255,255,255,0.02))';
        card.style.overflow = 'hidden';
        card.style.flexShrink = '0';
        card.style.width = '100%';
        card.style.boxSizing = 'border-box';

        const formattedCode = formatCodeText(q.code);
        const formattedText = formatQuestionText(q.text);

        let optsHtml = '';
        try {
            const opts = typeof q.options_json === 'string' ? JSON.parse(q.options_json) : q.options_json;
            if (opts && Array.isArray(opts)) {
                optsHtml = opts.map((opt, i) => {
                    const isCorrect = i === q.correct_index;
                    return `<div style="font-size:13px; color:var(--text-secondary); margin-bottom:4px; ${isCorrect ? 'color:var(--accent-green, #4ade80); font-weight:bold;' : ''}">${String.fromCharCode(65 + i)}. ${escapeHtml(opt)}${isCorrect ? ' (Corect)' : ''}</div>`;
                }).join('');
                optsHtml = `<div style="margin-top:8px;">${optsHtml}</div>`;
            }
        } catch (e) { }

        card.innerHTML = `
            <div style="flex: 1; min-width: 0;">
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <span class="badge badge-${q.difficulty || 'medium'}">${q.difficulty || 'Normal'}</span>
                    <span class="badge" style="background:rgba(255,255,255,0.1);">${q.exam_type || 'Diverse'}</span>
                    <span class="badge" style="background:rgba(124,106,255,0.15); color:var(--accent-purple);">${q.category || ''}</span>
                    ${q.subcategory ? `<span class="badge" style="background:rgba(255,255,255,0.05); font-size:11px;">${q.subcategory}</span>` : ''}
                    <span style="font-size: 11px; color: var(--text-secondary); margin-left: auto;">ID: #${q.id}</span>
                </div>
                <div class="q-text" style="margin-top:8px; font-weight:500; white-space:pre-wrap; word-break:break-word;">${escapeHtml(formattedText)}</div>
                ${formattedCode ? `<div class="detail-code" style="background:#0c0d1e; padding:10px; border-radius:4px; font-size:12px; color:#a6accd; margin:8px 0; max-width:100%; overflow-x:auto;"><pre style="margin:0; font-family: monospace; white-space: pre-wrap; word-break: break-word;">${escapeHtml(formattedCode)}</pre></div>` : ''}
                ${(() => {
                const qImgs = parseImageUrls(q.image_url);
                return qImgs.length > 0 ? `
                        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; margin:10px auto; text-align:center; width:100%;">
                            ${qImgs.map(u => `<img src="${u}" style="max-height:180px; border-radius:8px; max-width:100%; display:block; margin:0 auto; box-shadow:0 4px 10px rgba(0,0,0,0.3); cursor:zoom-in;" onclick="openAdminLightbox('${u}')" title="Click pentru mărire">`).join('')}
                        </div>` : '';
            })()}
                ${optsHtml}
            </div>
            <div style="flex-shrink: 0;">
                <button class="btn btn-primary" style="padding: 8px 16px; white-space:nowrap;" onclick="confirmManualReplace(${q.id})">Alege Întrebarea</button>
            </div>
        `;
        list.appendChild(card);
    });
};

window.confirmManualReplace = function (newQuestionId) {
    if (currentDraftTest && currentDraftTest.questions_ids) {
        const idx = currentDraftTest.questions_ids.findIndex(id => String(id) === String(replacingQuestionId));
        if (idx !== -1) {
            currentDraftTest.questions_ids[idx] = newQuestionId;
        }
    }
    closeManualReplaceModal();
    previewAssignedTest(replacingDraftId, currentDraftTest);
};

window.reassignTest = async function (id) {
    const testToReassign = assignedTestsData.find(t => t.id === id);
    const studentName = testToReassign ? testToReassign.student_username : 'elevului';
    if (!confirm(`Sigur dorești să ștergi răspunsurile și să reasignezi acest test pentru ${studentName}?\n\nToate răspunsurile salvate vor fi șterse (progresul revine la 0%), iar termenul va fi prelungit cu cel puțin 24 de ore (până la următoarea oră fixă).`)) return;

    try {
        const res = await fetchWithToken(API_ASSIGNED_TESTS + '?id=' + id + '&action=reassign', { method: 'DELETE' });
        if (res.ok) {
            showToast('Testul a fost resetat și reasignat cu succes!');
            const asRes = await fetchWithToken(API_ASSIGNED_TESTS);
            if (asRes.ok) assignedTestsData = await asRes.json();
            await loadResults();
            if (testToReassign) {
                openSituatieDetail(testToReassign.student_username);
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.error || 'Eroare la reasignarea testului.', true);
        }
    } catch (e) {
        showToast('Eroare de rețea.', true);
    }
};

window.deleteAssignedTest = async function (id) {
    const testToDelete = assignedTestsData.find(t => t.id === id);
    const studentName = testToDelete ? testToDelete.student_username : 'elevului';
    if (!confirm(`Sigur ștergi DEFINITIV acest test asignat pentru ${studentName}?\n\nAceastă acțiune va șterge ireversibil tema și toate răspunsurile asociate din baza de date.`)) return;

    try {
        const res = await fetchWithToken(API_ASSIGNED_TESTS + '?id=' + id + '&action=delete', { method: 'DELETE' });
        if (res.ok) {
            showToast('Test șters definitiv din baza de date!');
            assignedTestsData = assignedTestsData.filter(t => t.id !== id);
            await loadResults();
            if (testToDelete) {
                openSituatieDetail(testToDelete.student_username);
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.error || 'Eroare la ștergerea testului.', true);
        }
    } catch (e) {
        showToast('Eroare de rețea.', true);
    }
};

window.deleteResultHistory = async function (id, username) {
    if (!confirm("Sigur ștergi acest rezultat din istoric? Această acțiune este ireversibilă.")) return;
    try {
        const res = await fetchWithToken(API_DEL_RESULT + '?id=' + id, { method: 'DELETE' });
        if (res.ok) {
            showToast('Rezultat șters cu succes!');
            // Reload data
            await loadResults();
            openSituatieDetail(username);
        } else {
            showToast('Eroare la ștergerea rezultatului', true);
        }
    } catch (e) {
        showToast('Eroare de rețea', true);
    }
};

async function regenerateQuestion(testId, oldQuestionId) {
    try {
        showToast('Se caută o altă întrebare...', false);

        let res;
        if (testId === 'draft') {
            res = await fetchWithToken(API_ASSIGNED_TESTS, {
                method: 'PUT',
                body: JSON.stringify({
                    action: 'regenerate_draft',
                    student_username: currentDraftTest.student_username,
                    exam_type: currentDraftTest.exam_type,
                    current_questions_ids: currentDraftTest.questions_ids,
                    old_question_id: oldQuestionId
                })
            });
        } else {
            res = await fetchWithToken(API_ASSIGNED_TESTS, {
                method: 'PUT',
                body: JSON.stringify({
                    action: 'regenerate',
                    id: testId,
                    old_question_id: oldQuestionId
                })
            });
        }

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Eroare necunoscută');
        }

        const data = await res.json();

        if (testId === 'draft') {
            const newQId = data.new_question_id;
            currentDraftTest.questions_ids = currentDraftTest.questions_ids.map(qid => String(qid) === String(oldQuestionId) ? newQId : qid);
            const testQs = currentDraftTest.questions_ids.map(qid => questionsData.find(q => String(q.id) === String(qid))).filter(Boolean);
            renderPreviewTest(testQs);
            showToast('Întrebarea a fost înlocuită!');
        } else {
            const updatedTest = data;
            const idx = assignedTestsData.findIndex(t => String(t.id) === String(testId));
            if (idx !== -1) assignedTestsData[idx] = updatedTest;

            const testQs = (updatedTest.questions_ids || []).map(qid => questionsData.find(q => String(q.id) === String(qid))).filter(Boolean);
            renderPreviewTest(testQs);

            showToast('Întrebarea a fost înlocuită!');
            loadSituatie();
        }
    } catch (err) {
        showToast('Eroare: ' + err.message, true);
    }
}

function closePreviewModal() {
    document.getElementById('modal-preview-test').style.display = 'none';
    currentlyPreviewedTestId = null;
}

/* ==================== LEADS & TESTE GRATUITE (MODUL 2) ==================== */
const API_MANAGE_LEADS = '/.netlify/functions/manage-leads';
let allLeads = [];

async function loadLeads() {
    const loading = document.getElementById('loading-leads');
    const empty = document.getElementById('empty-leads');
    const wrapper = document.getElementById('wrapper-leads');
    const badge = document.getElementById('badge-leads-count');

    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    if (wrapper) wrapper.style.display = 'none';

    try {
        const res = await fetchWithToken(API_MANAGE_LEADS + '?action=list_leads');
        if (!res.ok) throw new Error(await res.text());
        allLeads = await res.json();

        if (badge) badge.textContent = allLeads.length;

        if (loading) loading.style.display = 'none';

        if (allLeads.length === 0) {
            if (empty) empty.style.display = 'block';
        } else {
            if (wrapper) wrapper.style.display = 'block';
            renderLeads();
        }
    } catch (e) {
        console.error('loadLeads error:', e);
        if (loading) loading.style.display = 'none';
        showToast('Eroare la încărcarea lead-urilor: ' + e.message, true);
    }
}
window.loadLeads = loadLeads;

function renderLeads() {
    const tbody = document.getElementById('leads-table-body');
    if (!tbody) return;

    tbody.innerHTML = allLeads.map(lead => {
        const total = lead.total_points || 30;
        const score = lead.score || 0;
        const pct = Math.round((score / total) * 100);
        let badgeClass = 'badge-beginner';
        if (pct >= 80) badgeClass = 'badge-expert';
        else if (pct >= 60) badgeClass = 'badge-advanced';
        else if (pct >= 35) badgeClass = 'badge-intermediate';

        const phoneClean = (lead.student_username || '').replace(/[^0-9+]/g, '');
        const waNumber = phoneClean.startsWith('+') ? phoneClean.substring(1) : (phoneClean.startsWith('0') ? '40' + phoneClean.substring(1) : phoneClean);
        const cleanStudentName = (lead.student_name || 'Elev').replace(/\s*\(Test\s+Introductiv\)/gi, '').trim();
        const waMsg = encodeURIComponent(`Salut, ${cleanStudentName}! Am analizat raportul tău la testul de informatică.💻\nCa să ajungi la excelență, vom rezolva împreună aceste lipsuri, pas cu pas.💯\nPentru moment, aș dori să programăm sesiunea gratuită de diagnosticare!🕑`);
        const waUrl = `https://wa.me/${waNumber}?text=${waMsg}`;

        const timeStr = formatTime(lead.time_taken_ms || 0);
        const blurCount = lead.blur_count || 0;
        const dateStr = formatEuropeanDateTime(lead.created_at);

        return `
            <tr>
                <td style="padding-left: 20px;">
                    <div style="font-weight: 700; color: #fff; font-size: 14px;">${escapeHtml(lead.student_name || 'Fără nume')}</div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Lead ID: #${lead.id}</div>
                </td>
                <td style="text-align: center;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                        <span style="font-family: monospace; font-weight: 600; color: #e2e8f0; font-size: 13px;">${escapeHtml(lead.student_username || '-')}</span>
                        <a href="${waUrl}" target="_blank" class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px; color: #22c55e; border-color: rgba(34, 197, 94, 0.4); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; border-radius: 6px;" title="Deschide WhatsApp">
                            <span>💬 WhatsApp</span>
                        </a>
                    </div>
                </td>
                <td style="text-align: center;">
                    <span class="badge ${badgeClass}" style="font-weight: 800; font-size: 13px; padding: 4px 12px; display: inline-block;">${score} / ${total} (${pct}%)</span>
                </td>
                <td style="text-align: center;">
                    <div style="font-size: 13px; font-weight: 600;">⏱️ ${timeStr}</div>
                    ${blurCount > 0 ? `<div style="font-size: 11px; color: var(--accent-amber); margin-top: 2px;">⚠️ ${blurCount} abateri focus</div>` : '<div style="font-size: 11px; color: var(--accent-green); margin-top: 2px;">🔒 Focus 100%</div>'}
                </td>
                <td style="text-align: center; font-size: 12px; color: var(--text-secondary);">${dateStr}</td>
                <td style="text-align: center; padding-right: 20px;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                        <button class="btn btn-secondary" onclick="openLeadDetails(${lead.id})" style="padding: 6px 12px; font-size: 12px;" title="Vezi detalii întrebări">
                            👁️ Detalii
                        </button>
                        <button class="btn btn-primary" onclick="openConvertLeadModal(${lead.id})" style="padding: 6px 14px; font-size: 12px; background: linear-gradient(135deg, #7c6aff, #38bdf8); font-weight: 600;" title="Creează Cont Elev">
                            🎓 Creează Cont
                        </button>
                        <button class="btn btn-secondary" onclick="deleteLead(${lead.id})" style="padding: 6px 10px; font-size: 12px; color: var(--accent-red); border-color: rgba(239, 68, 68, 0.3);" title="Șterge Lead">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openLeadDetails(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) return;

    currentSelectedResult = lead;
    currentDetailsFilter = 'all';

    const modal = document.getElementById('modal-details');
    const modalTitle = document.getElementById('details-student-name') || document.getElementById('details-modal-title');
    const subtitle = document.getElementById('details-student-meta') || document.getElementById('details-modal-subtitle');

    if (modalTitle) modalTitle.textContent = `Raport Lead: ${lead.student_name || 'Fără nume'}`;
    if (subtitle) subtitle.textContent = `Telefon: ${lead.student_username || '-'} • Scor: ${lead.score || 0}/${lead.total_points || 30} • Timp: ${formatTime(lead.time_taken_ms || 0)} • ${lead.blur_count || 0} pierderi focus`;

    let details = lead.details_json;
    if (typeof details === 'string') {
        try { details = JSON.parse(details); } catch (e) { details = []; }
    }
    if (!Array.isArray(details)) details = [];

    const totalQs = details.length;
    const correctQs = details.filter(d => d && (d.isCorrect === true || d.is_correct === true || d.correct === true || (d.studentAnswer !== null && d.studentAnswer !== undefined && d.studentAnswer === d.correctAnswer))).length;
    const wrongQs = totalQs - correctQs;

    const countAllEl = document.getElementById('count-all');
    const countWrongEl = document.getElementById('count-wrong');
    const countCorrectEl = document.getElementById('count-correct');
    if (countAllEl) countAllEl.textContent = totalQs;
    if (countWrongEl) countWrongEl.textContent = wrongQs;
    if (countCorrectEl) countCorrectEl.textContent = correctQs;

    // Reset filter buttons UI
    document.querySelectorAll('.details-filter-btn').forEach(btn => btn.classList.remove('active'));
    const defaultFilterBtn = document.getElementById('filter-btn-all');
    if (defaultFilterBtn) defaultFilterBtn.classList.add('active');

    renderDetailsList(details, 'all');
    if (modal) modal.style.display = 'flex';
}
window.openLeadDetails = openLeadDetails;

function openConvertLeadModal(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) return;

    document.getElementById('convert-lead-id').value = lead.id;
    document.getElementById('convert-lead-fullname').value = lead.student_name || '';

    // Generate suggested username (e.g., prenume.nume or phone)
    const nameParts = (lead.student_name || '').trim().toLowerCase().split(/\s+/);
    let suggestedUsername = nameParts.length >= 2 ? `${nameParts[0]}.${nameParts[1]}` : (nameParts[0] || 'elev');
    suggestedUsername = normalizeSearchText(suggestedUsername).replace(/[^a-z0-9.]/g, '');

    document.getElementById('convert-lead-username').value = suggestedUsername;
    document.getElementById('convert-lead-password').value = 'Elev' + Math.floor(1000 + Math.random() * 9000);

    const modal = document.getElementById('modal-convert-lead');
    if (modal) modal.style.display = 'flex';
}
window.openConvertLeadModal = openConvertLeadModal;

function closeConvertLeadModal() {
    const modal = document.getElementById('modal-convert-lead');
    if (modal) modal.style.display = 'none';
}
window.closeConvertLeadModal = closeConvertLeadModal;

async function handleConvertLeadSubmit(event) {
    event.preventDefault();
    const leadId = document.getElementById('convert-lead-id').value;
    const fullName = document.getElementById('convert-lead-fullname').value.trim();
    const username = document.getElementById('convert-lead-username').value.trim();
    const password = document.getElementById('convert-lead-password').value.trim();
    const duration = document.getElementById('convert-lead-duration') ? document.getElementById('convert-lead-duration').value : '30';
    const btn = document.getElementById('btn-submit-convert-lead');

    if (!leadId || !username || !password) {
        showToast('Completează toate câmpurile.', true);
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Se creează contul...';

    try {
        const res = await fetchWithToken(API_MANAGE_LEADS, {
            method: 'POST',
            body: JSON.stringify({
                action: 'convert_lead',
                lead_id: leadId,
                username: username,
                password: password,
                full_name: fullName,
                duration: duration
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Eroare la crearea contului.');

        showToast(data.message || 'Contul a fost creat și testul asociat cu succes!');
        closeConvertLeadModal();

        // Refresh leads, reload students, results & situatie
        loadLeads();
        loadStudents();
        loadResults();
        loadSituatie();

    } catch (e) {
        console.error('handleConvertLeadSubmit error:', e);
        showToast(e.message, true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Creează & Asociază Test';
    }
}
window.handleConvertLeadSubmit = handleConvertLeadSubmit;

async function deleteLead(leadId) {
    if (!confirm('Sigur dorești să ștergi acest lead?')) return;

    try {
        const res = await fetchWithToken(API_MANAGE_LEADS, {
            method: 'POST',
            body: JSON.stringify({
                action: 'delete_lead',
                lead_id: leadId
            })
        });

        if (!res.ok) throw new Error(await res.text());

        showToast('Lead șters cu succes!');
        loadLeads();
    } catch (e) {
        showToast('Eroare la ștergerea lead-ului: ' + e.message, true);
    }
}
window.deleteLead = deleteLead;

/* ==================== WINDOW EXPORTS ==================== */
window.closeQuestionModal = closeQuestionModal;
window.closePhoneModal = closePhoneModal;
window.closeStudentModal = closeStudentModal;
window.closeReportModal = closeReportModal;
window.closeDetailsModal = closeDetailsModal;
window.closeAssignModal = closeAssignModal;
window.closePreviewModal = closePreviewModal;
window.closeManualSelectModal = closeManualSelectModal;
window.openQuestionModal = openQuestionModal;
window.openAssignTestModal = openAssignTestModal;
window.openStudentModal = openStudentModal;
window.openManualSelectModal = openManualSelectModal;
window.deleteStudent = deleteStudent;
window.deleteQuestion = deleteQuestion;
window.setDetailsFilter = setDetailsFilter;
window.setAssignQuickDate = setAssignQuickDate;
window.setEditDeadlineQuickDate = setEditDeadlineQuickDate;
window.updateAssignDeadlinePreview = updateAssignDeadlinePreview;
window.updateEditDeadlinePreview = updateEditDeadlinePreview;
window.updateFilterSub = updateFilterSub;
window.updateWFilterSub = updateWFilterSub;
window.updateSubcategories = updateSubcategories;
window.updateCorrectDropdown = updateCorrectDropdown;
window.addImageUrlFromInput = addImageUrlFromInput;
window.handleImageFilesSelect = handleImageFilesSelect;
window.removeQuestionImage = removeQuestionImage;
window.approveWaitingQuestion = approveWaitingQuestion;
window.approveAllWaitingQuestions = approveAllWaitingQuestions;
window.rejectWaitingQuestion = rejectWaitingQuestion;
window.editAndApproveWaitingQuestion = editAndApproveWaitingQuestion;
window.renderSituatieGrid = renderSituatieGrid;
window.closeSituatieDetail = closeSituatieDetail;
window.openSituatieDetail = openSituatieDetail;
window.togglePassword = togglePassword;
window.promptEditPhone = promptEditPhone;
window.promptResetPassword = promptResetPassword;
window.toggleManualSelection = toggleManualSelection;
window.confirmManualSelection = confirmManualSelection;
window.loadLeads = loadLeads;
window.renderQuestions = renderQuestions;
window.renderWaitingQuestions = renderWaitingQuestions;
window.renderStudents = renderStudents;
window.openSubscriptionModal = openSubscriptionModal;
window.closeSubscriptionModal = closeSubscriptionModal;
window.setSubDuration = setSubDuration;
window.setSubUnlimited = setSubUnlimited;
window.handleEditSubscriptionSubmit = handleEditSubscriptionSubmit;

/* ==================== INITIALIZATION ==================== */
document.addEventListener('DOMContentLoaded', () => {
    loadSituatie();
    loadLeads();

    // Auto-mask for zz/ll/aaaa date input
    const subDateInput = document.getElementById('sub-exact-date');
    if (subDateInput) {
        subDateInput.addEventListener('input', function() {
            let v = this.value.replace(/\D/g, '');
            if (v.length > 8) v = v.substring(0, 8);
            if (v.length >= 5) {
                this.value = `${v.substring(0, 2)}/${v.substring(2, 4)}/${v.substring(4)}`;
            } else if (v.length >= 3) {
                this.value = `${v.substring(0, 2)}/${v.substring(2)}`;
            } else {
                this.value = v;
            }
        });
    }

    // Initialize Drag & Drop and Paste Handlers for Question Modal Images
    initImageDropAndPasteHandlers();
});