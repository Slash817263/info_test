const API_RESULTS = '/.netlify/functions/fetch-results';
const API_QUESTIONS = '/.netlify/functions/fetch-questions';
const API_MANAGE_Q = '/.netlify/functions/manage-questions';
const API_DEL_RESULT = '/.netlify/functions/delete-result';
const API_FETCH_WAITING = '/.netlify/functions/fetch-waiting-questions';
const API_MANAGE_WAITING = '/.netlify/functions/manage-waiting-questions';
const API_MANAGE_STUDENTS = '/.netlify/functions/manage-students';
const API_ASSIGNED_TESTS = '/.netlify/functions/manage-assigned-tests';

const urlParams = new URLSearchParams(window.location.search);
let adminToken = urlParams.get('token') || sessionStorage.getItem('adminToken');
if (adminToken) {
    sessionStorage.setItem('adminToken', adminToken);
    if (urlParams.has('token')) {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
    }
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

function showAdminLoginModal() {
    const modal = document.getElementById('modal-admin-login');
    const input = document.getElementById('input-admin-pass');
    if (modal) {
        modal.style.display = 'flex';
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 100);
        }
    }
}

function hideAdminLoginModal() {
    const modal = document.getElementById('modal-admin-login');
    if (modal) modal.style.display = 'none';
}

const fetchWithToken = async (url, options = {}) => {
    if (!adminToken) {
        showAdminLoginModal();
        return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
    }
    const headers = { ...options.headers, 'x-admin-token': adminToken };
    try {
        const res = await fetch(url, { ...options, headers });
        if (res.status === 401) {
            sessionStorage.removeItem('adminToken');
            adminToken = null;
            showAdminLoginModal();
            showToast('Cheie admin invalidă sau neautorizată.', true);
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
    "Fundamente": ["Citire si afisare date", "Operatori si expresii", "Structuri de control", "Complexitati"],
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

        if (btn.dataset.target === 'tab-rezultate') loadSituatie();
        if (btn.dataset.target === 'tab-intrebari' && questionsData.length === 0) loadQuestions();
        if (btn.dataset.target === 'tab-waiting') loadWaitingQuestions();
        if (btn.dataset.target === 'tab-elevi' && studentsData.length === 0) loadStudents();
    });
});

/* ==================== REZULTATE ==================== */
async function loadResults() {
    try {
        const res = await fetchWithToken(API_RESULTS);
        if (!res.ok) throw new Error();
        resultsData = await res.json();

        const loadingEl = document.getElementById('loading-results');
        if (loadingEl) loadingEl.style.display = 'none';

        if (resultsData.length === 0) {
            const emptyEl = document.getElementById('empty-results');
            if (emptyEl) emptyEl.style.display = 'block';
        } else {
            const wrapEl = document.getElementById('wrapper-results');
            if (wrapEl) wrapEl.style.display = 'block';
            if (document.getElementById('results-body')) renderResults();
            if (document.getElementById('stat-total')) calcResultStats();
        }
    } catch (e) {
        const loadingEl = document.getElementById('loading-results');
        if (loadingEl) loadingEl.innerHTML = `<p style="color:var(--accent-red)">Eroare la încărcare rezultate.</p>`;
    }
}

function calcResultStats() {
    const len = resultsData.length;
    const sumPct = resultsData.reduce((acc, r) => acc + (r.score / r.total_points * 100), 0);
    const sumTime = resultsData.reduce((acc, r) => acc + r.time_taken_ms, 0);

    document.getElementById('stat-total').textContent = len;
    document.getElementById('stat-avg').textContent = (sumPct / len).toFixed(1) + '%';
    document.getElementById('stat-time').textContent = formatTime(sumTime / len);
    document.getElementById('stats-area').style.display = '';
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
    const cat = examCategory || 'Diverse';
    return {
        title: `Test Intermediar (${cat})`,
        label: `🎯 Intermediar (${cat})`,
        badge: `<span class="badge badge-medium">Intermediar (${cat})</span>`
    };
}

function renderResults() {
    const tbody = document.getElementById('results-body');
    const htmlArr = [];
    resultsData.forEach(r => {
        const pct = Math.round((r.score / r.total_points) * 100) || 0;
        let sc = 'score-low'; if (pct >= 85) sc = 'score-excellent'; else if (pct >= 60) sc = 'score-good'; else if (pct >= 35) sc = 'score-medium';
        const isAssigned = r.assigned_test_id || r.test_type === 'tema' || (r.test_type && r.test_type.startsWith('tema'));
        const isInitial = r.test_type === 'initial';
        const bl = r.blur_count || 0;
        
        const testInfo = getAdminTestInfo(r);
        const testTypeLabel = testInfo.label;

        const blurLabel = isAssigned ? '-' : `<span class="blur-badge ${bl === 0 ? 'safe' : ''}">${bl} pierderi focus</span>`;
        const timeLabel = isAssigned ? '-' : formatTime(r.time_taken_ms);

        htmlArr.push(`
                    <tr>
                        <td>
                            <div class="student-name">${escapeHtml(r.student_name)}</div>
                            <div style="font-size:11px; color:var(--text-muted)">@${escapeHtml(r.student_username || 'anonim')}</div>
                        </td>
                        <td>${testTypeLabel}</td>
                        <td><span class="score-badge ${sc}">${r.score}/${r.total_points} (${pct}%)</span></td>
                        <td>${blurLabel}</td>
                        <td style="font-family:var(--font-code); color:var(--text-secondary)">${timeLabel}</td>
                        <td style="color:var(--text-secondary)">${formatDate(r.created_at)}</td>
                        <td>
                            <button class="btn btn-edit" style="margin-right:6px;" onclick="openDetailsModal(${r.id})">👁️ Detalii</button>
                            <button class="btn btn-edit" style="margin-right:6px; background: rgba(248, 113, 113, 0.1); color: var(--accent-red); border-color: rgba(248, 113, 113, 0.3);" onclick="openDetailsModal(${r.id}, 'wrong')">❌ Greșeli</button>
                            <button class="btn btn-primary" style="margin-right:6px;" onclick="openReportModal(${r.id})">📊 Raport</button>
                            <button class="btn btn-danger" onclick="deleteResult(${r.id})">Șterge</button>
                        </td>
                    </tr>
                `);
    });
    tbody.innerHTML = htmlArr.join('');
}

async function deleteResult(id) {
    if (!confirm("Sigur ștergi acest rezultat?")) return;
    try {
        const res = await fetchWithToken(`${API_DEL_RESULT}?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Rezultat șters!');
            resultsData = resultsData.filter(r => r.id !== id);
            renderResults();
            calcResultStats();
            if (resultsData.length === 0) {
                document.getElementById('wrapper-results').style.display = 'none';
                document.getElementById('empty-results').style.display = 'block';
            }
        } else showToast('Eroare la ștergere', true);
    } catch (e) { showToast('Eroare de rețea', true); }
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

    // Build HTML
    let html = '';
    for (const cat in stats) {
        html += `<div style="margin-bottom: 20px;">
                            <h3 style="color: var(--accent-purple); margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${cat}</h3>
                            <ul style="list-style: none; padding: 0; margin: 0;">`;

        for (const subcat in stats[cat]) {
            const { total, correct } = stats[cat][subcat];
            const p = correct / total;
            let icon = '✔️';
            let color = 'var(--accent-green)';

            if (p === 0) {
                icon = '❌';
                color = 'var(--accent-red)';
            } else if (p < 0.7) {
                icon = '⚠️';
                color = '#fbbf24'; // yellow
            }

            html += `<li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-card); border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color);">
                                <span>${subcat}</span>
                                <span style="font-weight: 600; color: ${color};">${correct}/${total} corecte ${icon}</span>
                             </li>`;
        }
        html += `</ul></div>`;
    }

    if (!html) {
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
                ${itemImgs.map(u => `<img src="${u}" style="max-height:220px; max-width:100%; border-radius:8px; border:1px solid rgba(255,255,255,0.1); margin:0 auto; display:block; box-shadow:0 4px 12px rgba(0,0,0,0.3);">`).join('')}
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
        if (el) el.textContent = `(${counts[tab]})`;
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
    subSel.innerHTML = '<option value="">-- Alege Subcategorie --</option>';
    if (cat && subcategoriesMap[cat]) {
        subcategoriesMap[cat].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            subSel.appendChild(opt);
        });
    }
    if (selectedSub) subSel.value = selectedSub;
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
window.parseImageUrls = parseImageUrls;

let currentQuestionImages = []; // Array of { type: 'url'|'file', url: string, file?: File, previewUrl?: string }

function renderQuestionImagesManager() {
    const list = document.getElementById('q-images-preview-list');
    const badge = document.getElementById('q-images-count-badge');
    if (!list) return;

    if (badge) {
        badge.textContent = `${currentQuestionImages.length} ${currentQuestionImages.length === 1 ? 'imagine' : 'imagini'}`;
    }

    if (currentQuestionImages.length === 0) {
        list.innerHTML = `<span style="font-size:12px; color:var(--text-secondary); padding:4px; text-align:center; width:100%;">Nicio imagine atașată.</span>`;
        return;
    }

    list.innerHTML = currentQuestionImages.map((img, idx) => {
        const displaySrc = img.type === 'file' ? img.previewUrl : img.url;
        const label = img.type === 'file' ? (img.file ? img.file.name : 'Fișier nou') : 'Link Web';
        return `
            <div class="q-img-card">
                <img src="${displaySrc}" alt="Imagine ${idx + 1}" onclick="window.open('${displaySrc}', '_blank')" style="cursor:zoom-in;">
                <div class="q-img-info" title="${escapeHtml(label)}">#${idx + 1} ${escapeHtml(label)}</div>
                <button type="button" class="q-img-del-btn" onclick="removeQuestionImage(${idx})">🗑️ Șterge</button>
            </div>
        `;
    }).join('');
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

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
            showToast(`Fișierul ${file.name} e prea mare (max 5MB)`, true);
            continue;
        }
        const previewUrl = URL.createObjectURL(file);
        currentQuestionImages.push({ type: 'file', file, previewUrl });
    }
    renderQuestionImagesManager();
    e.target.value = '';
}
window.handleImageFilesSelect = handleImageFilesSelect;

function openQuestionModal(q = null) {
    const m = document.getElementById('modal-question');
    m.style.display = 'flex';
    document.getElementById('modal-title').textContent = q ? 'Editează Întrebare' : 'Adaugă Întrebare Nouă';

    if (q) {
        document.getElementById('q-id').value = q.id;
        const examTypes = (q.exam_type || 'Diverse').split(',').map(s => s.trim());
        document.querySelectorAll('.q-exam-cb').forEach(cb => {
            cb.checked = examTypes.includes(cb.value);
        });

        document.getElementById('q-category').value = q.category || '';
        updateSubcategories(q.subcategory);
        document.getElementById('q-difficulty').value = q.difficulty;
        document.getElementById('q-type').value = q.type;
        document.getElementById('q-text').value = q.text;
        
        currentQuestionImages = parseImageUrls(q.image_url).map(url => ({ type: 'url', url }));
        renderQuestionImagesManager();
        
        let opts = q.options_json || q.options || [];
        if (typeof opts === 'string') {
            try { opts = JSON.parse(opts); } catch (e) { opts = []; }
        }
        if (!Array.isArray(opts)) opts = [];

        document.getElementById('q-opt-0').value = opts[0] || '';
        document.getElementById('q-opt-1').value = opts[1] || '';
        document.getElementById('q-opt-2').value = opts[2] || '';
        document.getElementById('q-opt-3').value = opts[3] || '';
        document.getElementById('q-opt-4').value = opts[4] || '';
        document.getElementById('q-opt-5').value = opts[5] || '';

        updateCorrectDropdown(q.correct_index);

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
                ${qImgs.map(u => `<img src="${u}" style="max-height:200px; max-width:100%; border-radius:8px; display:block; margin:0 auto; box-shadow:0 4px 10px rgba(0,0,0,0.3);">`).join('')}
            </div>` : '';

        const rawExam = q.exam_type || 'Initial';
        let selectedExam = 'Initial';
        if (rawExam.includes('Poli')) selectedExam = 'Poli';
        else if (rawExam.includes('Academie')) selectedExam = 'Academie';
        else if (rawExam.includes('BAC')) selectedExam = 'BAC';
        else if (rawExam.includes('Diverse')) selectedExam = 'Diverse';
        else if (rawExam.includes('Initial')) selectedExam = 'Initial';

        return `
                    <div class="detail-card" style="border-left: 4px solid var(--accent-amber); background: rgba(15, 15, 40, 0.75);">
                        <div class="detail-header" style="flex-wrap: wrap; gap: 8px;">
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <span style="font-weight:700; color:var(--accent-amber); font-size:13px;">#${q.id || (idx + 1)}</span>
                                <span class="badge ${diffClass}">${diffLabel}</span>
                                <span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-secondary);">${escapeHtml(q.category || 'General')} • ${escapeHtml(q.subcategory || '')}</span>
                                <select class="form-control" style="width: auto; padding: 3px 8px; font-size: 12px; height: 26px; border-color: var(--accent-purple);" onchange="updateWaitingExamType(${q.id}, this.value)">
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
                    </div>
                `;
    }).join('');

    container.innerHTML = html;
}

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


function decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; opacity:0.6; padding: 20px;">Nu s-au găsit elevi.</td></tr>';
        return;
    }

    const htmlArr = filteredStudents.map(s => {
        const dateStr = formatDate(s.created_at);
        const phoneStr = s.phone_number ? escapeHtml(s.phone_number) : '<span style="color:var(--accent-red); font-size:12px;">Nesetat</span>';
        const pwDisplay = s.password ? escapeHtml(s.password) : 'Nesetat';
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
                        <td style="color:var(--text-secondary); font-size:12px;">${dateStr}</td>
                        <td>
                            <button class="btn btn-secondary" style="padding: 6px; font-size:12px; margin-right: 4px;" onclick="promptResetPassword(${s.id}, '${escapeHtml(s.username)}')">🔑 Reset</button>
                            <button class="btn btn-secondary" style="padding: 6px; font-size:12px; border-color: rgba(248,113,113,0.3); color: var(--accent-red);" onclick="deleteStudent(${s.id}, '${escapeHtml(s.username)}')">Șterge</button>
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

    try {
        const res = await fetchWithToken(API_MANAGE_STUDENTS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', username, password })
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
    document.getElementById('loading-situatie-students').style.display = 'flex';
    document.getElementById('situatie-students-grid').style.display = 'none';
    try {
        if (studentsData.length === 0) await loadStudents();
        if (resultsData.length === 0) await loadResults();

        const asRes = await fetchWithToken(API_ASSIGNED_TESTS);
        if (asRes.ok) {
            assignedTestsData = await asRes.json();
        }

        renderSituatieGrid();
    } catch (err) {
        console.error(err);
        showToast('Eroare la încărcarea situației', true);
    } finally {
        document.getElementById('loading-situatie-students').style.display = 'none';
        document.getElementById('situatie-students-grid').style.display = 'grid';
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

    filteredStudents.forEach(student => {
        const doneTests = resultsData.filter(r => r.student_username === student.username).length;
        const pendingTests = assignedTestsData.filter(t => t.student_username === student.username && t.status === 'pending').length;

        const card = document.createElement('div');
        card.className = 'option-card';
        card.style.display = 'block';
        card.style.padding = '20px';
        card.style.cursor = 'pointer';
        card.onclick = () => openSituatieDetail(student.username);

        card.innerHTML = `
                    <div style="display:flex; align-items:center; gap:16px; margin-bottom: 16px;">
                        <div style="background:linear-gradient(135deg, var(--accent-purple), #4a3e9c); width:48px; height:48px; border-radius:50%; display:flex; justify-content:center; align-items:center; font-weight:800; font-size:20px; color:#fff; box-shadow: 0 4px 10px rgba(124, 106, 255, 0.3);">
                            ${student.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${escapeHtml(student.username)}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <span class="badge" style="background:rgba(52,211,153,0.15); color:var(--accent-green)">${doneTests} Teste Susținute</span>
                        ${pendingTests > 0 ? `<span class="badge" style="background:rgba(251,191,36,0.15); color:var(--accent-amber)">${pendingTests} În Așteptare</span>` : ''}
                    </div>
                `;
        grid.appendChild(card);
    });
}

function closeSituatieDetail() {
    document.getElementById('situatie-detail-view').style.display = 'none';
    document.getElementById('situatie-list-view').style.display = 'block';
}

function openSituatieDetail(username) {
    document.getElementById('situatie-list-view').style.display = 'none';
    document.getElementById('situatie-detail-view').style.display = 'block';
    document.getElementById('situatie-detail-name').textContent = username;

    const studentResults = resultsData.filter(r => r.student_username === username);
    const studentPending = assignedTestsData.filter(t => t.student_username === username && t.status === 'pending');

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
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <button class="btn btn-secondary" onclick="openEditDeadlineModal('${pt.id}', '${pt.deadline}', '${escapeHtml(pt.student_username)}')" style="padding:6px 12px; font-size:12px; border-color:var(--accent-purple); color:var(--accent-purple);">🕒 Modifică Termen</button>
                            <button class="btn btn-secondary" onclick="previewAssignedTest('${pt.id}')" style="padding:6px 12px; font-size:12px;">Vizualizare</button>
                            <button class="btn btn-secondary" onclick="deleteAssignedTest('${pt.id}')" style="padding:6px 12px; font-size:12px; border-color:rgba(248,113,113,0.3); color:var(--accent-red);">Șterge</button>
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
                        <td>${typeBadge}</td>
                        <td style="font-weight:700;">${r.score}/${r.total_points} <span style="color:var(--accent-purple); font-size:12px; margin-left:4px;">${pct}%</span></td>
                        <td>${blurDisplay}</td>
                        <td>${timeDisplay}</td>
                        <td style="color:var(--text-secondary); font-size:12px;">${dateStr}</td>
                        <td style="display: flex; gap: 8px;">
                            <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 13px;" onclick="viewResultDetails(${r.id})">Detalii</button>
                            <button class="btn btn-danger" style="padding: 6px 12px; font-size: 13px;" onclick="deleteResultHistory(${r.id}, '${r.student_username}')">Șterge</button>
                        </td>
                    `;
            tbody.appendChild(tr);
        });
    }

    // Bind current student to Assign Button
    document.getElementById('assign-username').value = username;
    document.getElementById('assign-student-name').value = username;
}

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

function renderManualSelectionList() {
    const list = document.getElementById('manual-select-list');
    const searchTerm = (document.getElementById('manual-search').value || '').toLowerCase().trim();
    const modalCat = document.getElementById('manual-filter-cat');
    const category = modalCat ? modalCat.value : (document.getElementById('assign-category').value || 'Diverse');
    
    let filtered = questionsData;
    if (category !== 'Diverse' && category !== 'Toate') {
        filtered = questionsData.filter(q => (q.exam_type || 'Diverse').includes(category));
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

        card.innerHTML = `
            <div style="margin-top: 4px; padding: 4px; flex-shrink: 0;">
                <input type="checkbox" id="chk-manual-q-${q.id}" style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--accent-purple, #7c6aff);" onchange="toggleManualSelection(${q.id}, this.checked)" ${isChecked}>
            </div>
            <div style="flex: 1; min-width: 0;">
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
    if (questionsData.length === 0) await loadQuestions();

    const testQs = (test.questions_ids || []).map(qid => questionsData.find(q => String(q.id) === String(qid))).filter(Boolean);

    renderPreviewTest(testQs);
}

function renderPreviewTest(testQs) {
    const list = document.getElementById('preview-test-list');
    list.innerHTML = '';

    if (testQs.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary); padding:20px; text-align:center;">Testul nu conține nicio întrebare validă.</p>';
        return;
    }

    testQs.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'detail-card';
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
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; width: 100%;">
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <span class="badge badge-${q.difficulty || 'medium'}">${q.difficulty || 'Normal'}</span>
                        <span class="badge" style="background:rgba(255,255,255,0.1);">${q.exam_type || 'Diverse'}</span>
                        <span class="badge" style="background:rgba(124,106,255,0.15); color:var(--accent-purple);">${q.category || ''}</span>
                        ${q.subcategory ? `<span class="badge" style="background:rgba(255,255,255,0.05); font-size:11px;">${q.subcategory}</span>` : ''}
                        <span style="font-size: 11px; color: var(--text-secondary); margin-left: auto;">ID: #${q.id}</span>
                    </div>
                    <div class="q-text" style="margin-top:8px; font-weight:500; white-space:pre-wrap; word-break:break-word;"><strong>${idx + 1}.</strong> ${escapeHtml(formattedText)}</div>
                    ${formattedCode ? `<div class="detail-code" style="background:#0c0d1e; padding:10px; border-radius:6px; font-size:13px; color:#a6accd; margin:8px 0; max-width:100%; overflow-x:auto;"><pre style="margin:0; font-family: monospace; white-space: pre-wrap; word-break: break-word;">${escapeHtml(formattedCode)}</pre></div>` : ''}
                    ${(() => {
                        const qImgs = parseImageUrls(q.image_url);
                        return qImgs.length > 0 ? `
                            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; margin:10px auto; text-align:center; width:100%;">
                                ${qImgs.map(u => `<img src="${u}" style="max-height:180px; border-radius:8px; max-width:100%; display:block; margin:0 auto; box-shadow:0 4px 10px rgba(0,0,0,0.3);">`).join('')}
                            </div>` : '';
                    })()}
                    ${optsHtml}
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
}

let replacingQuestionId = null;
let replacingDraftId = null;

window.openManualReplaceModal = async function(draftId, oldQuestionId) {
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

window.closeManualReplaceModal = function() {
    document.getElementById('modal-manual-replace').style.display = 'none';
};

window.renderManualReplaceList = function() {
    const list = document.getElementById('manual-replace-list');
    const searchTerm = (document.getElementById('manual-replace-search').value || '').toLowerCase().trim();
    const modalCat = document.getElementById('manual-replace-filter-cat');
    const category = modalCat ? modalCat.value : (document.getElementById('assign-category').value || 'Diverse');
    
    const currentIds = new Set(currentDraftTest ? currentDraftTest.questions_ids : []);
    
    let filtered = questionsData.filter(q => !currentIds.has(q.id));
    
    if (category !== 'Diverse' && category !== 'Toate') {
        filtered = filtered.filter(q => (q.exam_type || 'Diverse').includes(category));
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
                            ${qImgs.map(u => `<img src="${u}" style="max-height:180px; border-radius:8px; max-width:100%; display:block; margin:0 auto; box-shadow:0 4px 10px rgba(0,0,0,0.3);">`).join('')}
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

window.confirmManualReplace = function(newQuestionId) {
    if (currentDraftTest && currentDraftTest.questions_ids) {
        const idx = currentDraftTest.questions_ids.findIndex(id => String(id) === String(replacingQuestionId));
        if (idx !== -1) {
            currentDraftTest.questions_ids[idx] = newQuestionId;
        }
    }
    closeManualReplaceModal();
    previewAssignedTest(replacingDraftId, currentDraftTest);
};

window.deleteAssignedTest = async function (id) {
    if (!confirm("Sigur ștergi acest test asignat?")) return;
    try {
        const res = await fetchWithToken(API_ASSIGNED_TESTS + '?id=' + id, { method: 'DELETE' });
        if (res.ok) {
            showToast('Test șters cu succes!');
            const testToDelete = assignedTestsData.find(t => t.id === id);
            assignedTestsData = assignedTestsData.filter(t => t.id !== id);
            if (testToDelete) {
                openSituatieDetail(testToDelete.student_username);
            }
        } else {
            showToast('Eroare la ștergere', true);
        }
    } catch (e) {
        showToast('Eroare de rețea', true);
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

/* ==================== INITIALIZATION ==================== */
document.addEventListener('DOMContentLoaded', () => {
    const btnSubmit = document.getElementById('btn-submit-admin-login');
    const input = document.getElementById('input-admin-pass');

    const handleAdminLogin = () => {
        const pass = input ? input.value.trim() : '';
        if (!pass) {
            showToast('Introdu parola de administrare.', true);
            return;
        }
        adminToken = pass;
        sessionStorage.setItem('adminToken', adminToken);
        hideAdminLoginModal();
        loadSituatie();
    };

    if (btnSubmit) btnSubmit.addEventListener('click', handleAdminLogin);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAdminLogin();
        });
    }

    if (!adminToken) {
        showAdminLoginModal();
    } else {
        loadSituatie();
    }
});