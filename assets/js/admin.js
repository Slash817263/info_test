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
        if (!adminToken) {
            adminToken = prompt('Introduceți parola de administrare (ADMIN_SECRET):');
            if (!adminToken) {
                alert('Parolă obligatorie pentru acces!');
                window.location.href = 'index.html';
            }
        }
        sessionStorage.setItem('adminToken', adminToken);

        const fetchWithToken = (url, options = {}) => {
            const headers = { ...options.headers, 'x-admin-token': adminToken };
            return fetch(url, { ...options, headers });
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
        window.setExamTab = function(type) {
            currentExamTab = type;
            document.getElementById('tab-intrebari-title').textContent = 'Bază de Întrebări - ' + type;
            renderQuestions();
        };

        /* ==================== UTILS ==================== */
        const escapeHtml = (text) => { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; };
        const formatTime = (ms) => { const sec = Math.floor(ms / 1000); return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`; };
        const formatDate = (iso) => new Date(iso).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        
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
                
                if(btn.dataset.target === 'tab-rezultate') loadSituatie();
                if(btn.dataset.target === 'tab-intrebari' && questionsData.length === 0) loadQuestions();
                if(btn.dataset.target === 'tab-waiting') loadWaitingQuestions();
                if(btn.dataset.target === 'tab-elevi' && studentsData.length === 0) loadStudents();
            });
        });

        /* ==================== REZULTATE ==================== */
        async function loadResults() {
            try {
                const res = await fetchWithToken(API_RESULTS);
                if (res.status === 401) {
                    sessionStorage.removeItem('adminToken');
                    adminToken = prompt('Parola de administrare incorecta! Re-introduceti parola (ex: admin):');
                    if (adminToken) {
                        sessionStorage.setItem('adminToken', adminToken);
                        return loadResults();
                    }
                }
                if(!res.ok) throw new Error();
                resultsData = await res.json();
                
                const loadingEl = document.getElementById('loading-results');
                if (loadingEl) loadingEl.style.display = 'none';

                if(resultsData.length === 0) {
                    const emptyEl = document.getElementById('empty-results');
                    if (emptyEl) emptyEl.style.display = 'block';
                } else {
                    const wrapEl = document.getElementById('wrapper-results');
                    if (wrapEl) wrapEl.style.display = 'block';
                    const btnDl = document.getElementById('btn-download');
                    if (btnDl) btnDl.style.display = 'inline-flex';
                    if (document.getElementById('results-body')) renderResults();
                    if (document.getElementById('stat-total')) calcResultStats();
                }
            } catch(e) {
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

        function renderResults() {
            const tbody = document.getElementById('results-body');
            const htmlArr = [];
            resultsData.forEach(r => {
                const pct = Math.round((r.score / r.total_points) * 100);
                let sc = 'score-low'; if(pct >= 85) sc = 'score-excellent'; else if(pct >= 60) sc = 'score-good'; else if(pct >= 35) sc = 'score-medium';
                const bl = r.blur_count || 0;
                htmlArr.push(`
                    <tr>
                        <td>
                            <div class="student-name">${escapeHtml(r.student_name)}</div>
                            <div style="font-size:11px; color:var(--text-muted)">@${escapeHtml(r.student_username || 'anonim')}</div>
                        </td>
                        <td>${r.test_type === 'intermediar' ? '🎯 Intermediar' : '📋 Inițial'}</td>
                        <td><span class="score-badge ${sc}">${r.score}/${r.total_points} (${pct}%)</span></td>
                        <td><span class="blur-badge ${bl === 0 ? 'safe' : ''}">${bl} pierderi focus</span></td>
                        <td style="font-family:var(--font-code); color:var(--text-secondary)">${formatTime(r.time_taken_ms)}</td>
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
            if(!confirm("Sigur ștergi acest rezultat?")) return;
            try {
                const res = await fetchWithToken(`${API_DEL_RESULT}?id=${id}`, { method: 'DELETE' });
                if(res.ok) {
                    showToast('Rezultat șters!');
                    resultsData = resultsData.filter(r => r.id !== id);
                    renderResults();
                    calcResultStats();
                    if(resultsData.length === 0) {
                        document.getElementById('wrapper-results').style.display = 'none';
                        document.getElementById('empty-results').style.display = 'block';
                    }
                } else showToast('Eroare la ștergere', true);
            } catch(e) { showToast('Eroare de rețea', true); }
        }

        /* ==================== MODAL DETALII RĂSPUNSURI ==================== */
        let currentSelectedResult = null;
        let currentDetailsFilter = 'all';

        function openDetailsModal(resultId, defaultFilter = 'all') {
            const r = resultsData.find(x => x.id == resultId);
            if (!r) {
                showToast('Eroare: Rezultatul nu a fost găsit în datele încărcate.', true);
                return;
            }
            currentSelectedResult = r;
            currentDetailsFilter = defaultFilter;

            const pct = Math.round((r.score / r.total_points) * 100) || 0;
            document.getElementById('details-student-name').textContent = `Rezultat: ${r.student_name || 'Anonim'}`;
            document.getElementById('details-student-meta').textContent = `${r.test_type === 'intermediar' ? 'Test Intermediar' : 'Test Inițial'} • Scor: ${r.score || 0}/${r.total_points || 0} (${pct}%) • Timp: ${formatTime(r.time_taken_ms || 0)} • ${r.blur_count || 0} pierderi focus`;

            let details = r.details_json;
            if (typeof details === 'string') {
                try { details = JSON.parse(details); } catch(e) { details = []; }
            }
            if (!Array.isArray(details)) details = [];

            const totalQs = details.length;
            const correctQs = details.filter(d => d.isCorrect).length;
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
                } catch(e) {
                    console.error("Failed to load questions", e);
                }
            }

            const pct = Math.round((r.score / r.total_points) * 100) || 0;
            document.getElementById('report-student-name').textContent = `Raport: ${r.student_name || 'Anonim'}`;
            document.getElementById('report-student-meta').textContent = `Scor: ${r.score || 0}/${r.total_points || 0} (${pct}%)`;

            let details = r.details_json;
            if (typeof details === 'string') {
                try { details = JSON.parse(details); } catch(e) { details = []; }
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
                try { details = JSON.parse(details); } catch(e) {}
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
                if (filter === 'wrong') return !d.isCorrect;
                if (filter === 'correct') return !!d.isCorrect;
                return true;
            });

            if (filtered.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary);">Nicio întrebare găsită pentru filtrul selectat.</div>`;
                return;
            }

            const html = filtered.map((item, idx) => {
                if (!item) return '';
                const isOk = !!item.isCorrect;
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

                const codeHtml = item.code ? `<div class="detail-code">${escapeHtml(item.code)}</div>` : '';
                const imageHtml = item.image_url ? `<img src="${item.image_url}" style="margin: 10px 0; max-height: 200px; border-radius: 8px;">` : '';
                const explanationHtml = item.explanation ? `<div class="detail-explanation"><strong>💡 Explicație:</strong> ${escapeHtml(item.explanation)}</div>` : '';

                return `
                    <div class="detail-card ${isOk ? 'correct' : 'wrong'}">
                        <div class="detail-header">
                            <div>
                                <span style="font-weight:700; color:var(--accent-purple); font-size:13px;">#${item.number || (idx + 1)}</span>
                                <span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-secondary); margin-left:6px;">Dificultate: ${diffLabel}</span>
                            </div>
                            <div>${statusBadge}</div>
                        </div>
                        <div style="font-size:15px; font-weight:600; color:var(--text-primary); margin-bottom:8px; white-space:pre-wrap;">${escapeHtml(item.text || '')}</div>
                        ${codeHtml}
                        ${imageHtml}
                        <div style="margin-top:12px;">${optsHtml}</div>
                        ${explanationHtml}
                    </div>
                `;
            }).join('');

            container.innerHTML = html;
        }

        /* ==================== INTREBARI CMS ==================== */
        
        function updateFilterCounts() {
            const catSelect = document.getElementById('filter-cat');
            const currentCat = catSelect.value;
            catSelect.innerHTML = '<option value="">Toate categoriile (' + questionsData.length + ')</option>';
            Object.keys(subcategoriesMap).forEach(cat => {
                const count = questionsData.filter(q => q.category === cat).length;
                const opt = document.createElement('option');
                opt.value = cat; 
                opt.textContent = `${cat} (${count})`;
                if(cat === currentCat) opt.selected = true;
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
                const res = await fetch(API_QUESTIONS + '?admin=true');
                if(!res.ok) throw new Error();
                questionsData = await res.json();
                
                // ADDED DYNAMIC COUNTS
                if(typeof updateFilterCounts === 'function') updateFilterCounts();
                document.getElementById('loading-questions').style.display = 'none';

                if(questionsData.length === 0) {
                    document.getElementById('empty-questions').style.display = 'block';
                } else {
                    document.getElementById('wrapper-questions').style.display = 'block';
                    renderQuestions();
                }
            } catch(e) {
                document.getElementById('loading-questions').innerHTML = `<p style="color:var(--accent-red)">Eroare la încărcare întrebări.</p>`;
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
            const fSearch = document.getElementById('filter-search').value.toLowerCase();

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
                if (fSearch && !q.text.toLowerCase().includes(fSearch)) return false;
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
            if(!confirm("Sigur ștergi întrebarea din baza de date?")) return;
            try {
                const res = await fetchWithToken(`${API_MANAGE_Q}?id=${id}`, { method: 'DELETE' });
                if(res.ok) {
                    showToast('Întrebare ștearsă!');
                    questionsData = questionsData.filter(q => q.id !== id);
                    renderQuestions();
                } else {
                    let errMsg = 'Eroare la ștergere';
                    try {
                        const err = await res.json();
                        if (err.error) errMsg = err.error;
                    } catch(e) {}
                    if (res.status === 401) {
                        sessionStorage.removeItem('adminToken');
                        const newToken = prompt('Parolă admin invalidă. Re-introduceți parola (ex: admin):');
                        if (newToken) {
                            sessionStorage.setItem('adminToken', newToken);
                            adminToken = newToken;
                            return deleteQuestion(id);
                        }
                    }
                    showToast(errMsg, true);
                }
            } catch(e) { showToast('Eroare de rețea', true); }
        }

        /* ==================== CMS MODAL LOGIC ==================== */
        function updateSubcategories(selectedSub = '') {
            const cat = document.getElementById('q-category').value;
            const subSel = document.getElementById('q-subcategory');
            subSel.innerHTML = '<option value="">-- Alege Subcategorie --</option>';
            if(cat && subcategoriesMap[cat]) {
                subcategoriesMap[cat].forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s; opt.textContent = s;
                    subSel.appendChild(opt);
                });
            }
            if(selectedSub) subSel.value = selectedSub;
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

        function openQuestionModal(q = null) {
            const m = document.getElementById('modal-question');
            m.style.display = 'flex';
            document.getElementById('modal-title').textContent = q ? 'Editează Întrebare' : 'Adaugă Întrebare Nouă';
            
            if(q) {
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
                document.getElementById('q-image-url').value = q.image_url || '';
                document.getElementById('q-opt-0').value = q.options[0] || '';
                document.getElementById('q-opt-1').value = q.options[1] || '';
                document.getElementById('q-opt-2').value = q.options[2] || '';
                document.getElementById('q-opt-3').value = q.options[3] || '';
                document.getElementById('q-correct').value = q.correct_index;
                document.getElementById('q-explanation').value = q.explanation || '';
                
                setTimeout(() => {
                    initCodeMirror();
                    cmEditor.setValue(q.code || '');
                    cmEditor.refresh();
                }, 50);
            } else {
                document.getElementById('question-form').reset();
                document.getElementById('q-id').value = '';
                document.getElementById('q-image-url').value = '';
                document.getElementById('q-image-file').value = '';
                document.getElementById('q-image-preview-container').style.display = 'none';
                const examTypes = currentExamTab === 'Toate' ? ['Diverse'] : [currentExamTab];
                document.querySelectorAll('.q-exam-cb').forEach(cb => {
                    cb.checked = examTypes.includes(cb.value);
                });
                updateSubcategories();
                
                setTimeout(() => {
                    initCodeMirror();
                    cmEditor.setValue('');
                    cmEditor.refresh();
                }, 50);
            }
        }

        function previewImage() {
            const url = document.getElementById('q-image-url').value;
            const container = document.getElementById('q-image-preview-container');
            const img = document.getElementById('q-image-preview');
            
            if (url) {
                img.src = url;
                container.style.display = 'block';
            } else {
                showToast('Niciun URL de imagine disponibil pentru previzualizare', true);
            }
        }

        function closeQuestionModal() {
            document.getElementById('modal-question').style.display = 'none';
            currentWaitingEditId = null; // cleared on close
        }

        function editQuestion(id) {
            const q = questionsData.find(x => x.id === id);
            if(q) openQuestionModal(q);
        }

        document.getElementById('question-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('q-id').value;
            const codeVal = cmEditor ? cmEditor.getValue().trim() : '';
            
            const payload = {
                exam_type: Array.from(document.querySelectorAll('.q-exam-cb')).filter(cb => cb.checked).map(cb => cb.value).join(', '),
                category: document.getElementById('q-category').value,
                subcategory: document.getElementById('q-subcategory').value,
                difficulty: document.getElementById('q-difficulty').value,
                type: document.getElementById('q-type').value,
                text: document.getElementById('q-text').value,
                image_url: document.getElementById('q-image-url').value || null,
                code: codeVal ? codeVal : null,
                options_json: [
                    document.getElementById('q-opt-0').value,
                    document.getElementById('q-opt-1').value,
                    document.getElementById('q-opt-2').value,
                    document.getElementById('q-opt-3').value
                ],
                correct_index: parseInt(document.getElementById('q-correct').value),
                explanation: document.getElementById('q-explanation').value
            };

            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_MANAGE_Q}?id=${id}` : API_MANAGE_Q;
            const btnSave = document.getElementById('btn-save-q');
            btnSave.disabled = true;
            btnSave.textContent = 'Se procesează...';

            try {
                // Handle image upload if a file is selected
                const fileInput = document.getElementById('q-image-file');
                if (fileInput.files && fileInput.files[0]) {
                    const file = fileInput.files[0];
                    if (file.size > 5 * 1024 * 1024) { // 5MB limit
                        showToast('Imaginea e prea mare (max 5MB)', true);
                        btnSave.disabled = false;
                        btnSave.textContent = 'Salvează Întrebarea';
                        return;
                    }

                    btnSave.textContent = 'Se încarcă imaginea...';
                    const base64data = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result.split(',')[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });

                    const uploadRes = await fetchWithToken('/.netlify/functions/upload-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            filename: file.name,
                            contentType: file.type,
                            base64data
                        })
                    });

                    if (uploadRes.ok) {
                        const { publicUrl } = await uploadRes.json();
                        payload.image_url = publicUrl;
                        document.getElementById('q-image-url').value = publicUrl; // sync input
                    } else {
                        const err = await uploadRes.json();
                        showToast('Eroare upload imagine: ' + (err.error || ''), true);
                        btnSave.disabled = false;
                        btnSave.textContent = 'Salvează Întrebarea';
                        return;
                    }
                }

                btnSave.textContent = 'Se salvează...';
                const res = await fetchWithToken(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if(!res.ok) {
                    let errMsg = 'Eroare la salvare!';
                    try {
                        const errData = await res.json();
                        if (errData.error) errMsg = errData.error;
                        if (errData.details) errMsg += `: ${errData.details}`;
                    } catch(err) {}
                    if (res.status === 401) {
                        sessionStorage.removeItem('adminToken');
                        adminToken = prompt('Parola de administrare incorecta! Re-introduceti parola (ex: admin123):');
                        if (adminToken) sessionStorage.setItem('adminToken', adminToken);
                    }
                    throw new Error(errMsg);
                }
                showToast(id ? 'Întrebare actualizată!' : 'Întrebare adăugată!');
                if (currentWaitingEditId) {
                    rejectWaitingQuestion(currentWaitingEditId);
                    currentWaitingEditId = null;
                }
                closeQuestionModal();
                loadQuestions(); // refresh list
            } catch(e) {
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

        /* ==================== DOWNLOAD CSV ==================== */
        document.getElementById('btn-download').addEventListener('click', () => {
            if (resultsData.length === 0) return;
            const headers = ['Nume', 'Tip Test', 'Scor', 'Puncte Totale', 'Procentaj', 'Pierderi Focus', 'Timp', 'Data'];
            const rows = resultsData.map(r => {
                const pct = Math.round((r.score / r.total_points) * 100);
                return [
                    `"${r.student_name.replace(/"/g, '""')}"`,
                    r.test_type, r.score, r.total_points, `"${pct}%"`, r.blur_count || 0,
                    `"${formatTime(r.time_taken_ms)}"`, `"${new Date(r.created_at).toLocaleString('ro-RO')}"`
                ];
            });
            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `rezultate_test_${new Date().toISOString().slice(0,10)}.csv`;
            link.click();
            showToast('CSV descărcat!');
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
            const fCat = document.getElementById('w-filter-cat').value;
            const fSub = document.getElementById('w-filter-sub').value;
            const fDiff = document.getElementById('w-filter-diff').value;
            const fSearch = document.getElementById('w-filter-search').value.toLowerCase();

            const filtered = waitingQuestionsData.filter(q => {
                if (fCat && q.category !== fCat) return false;
                if (fSub && q.subcategory !== fSub) return false;
                if (fDiff && q.difficulty !== fDiff) return false;
                if (fSearch && !(q.text || '').toLowerCase().includes(fSearch) && !(q.explanation || '').toLowerCase().includes(fSearch)) return false;
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
                    try { opts = JSON.parse(opts); } catch(e) { opts = []; }
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
                const explanationHtml = q.explanation ? `<div class="detail-explanation"><strong>💡 Explicație:</strong> ${escapeHtml(q.explanation)}</div>` : '';

                const currentExam = q.exam_type || 'Initial';
                return `
                    <div class="detail-card" style="border-left: 4px solid var(--accent-amber); background: rgba(15, 15, 40, 0.75);">
                        <div class="detail-header" style="flex-wrap: wrap; gap: 8px;">
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <span style="font-weight:700; color:var(--accent-amber); font-size:13px;">#${q.id || (idx + 1)}</span>
                                <span class="badge ${diffClass}">${diffLabel}</span>
                                <span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-secondary);">${escapeHtml(q.category || 'General')} • ${escapeHtml(q.subcategory || '')}</span>
                                <select class="form-control" style="width: auto; padding: 3px 8px; font-size: 12px; height: 26px; border-color: var(--accent-purple);" onchange="updateWaitingExamType(${q.id}, this.value)">
                                    <option value="Initial" ${currentExam === 'Initial' ? 'selected' : ''}>Test Inițial</option>
                                    <option value="Academie" ${currentExam === 'Academie' ? 'selected' : ''}>Academie</option>
                                    <option value="BAC" ${currentExam === 'BAC' ? 'selected' : ''}>BAC</option>
                                    <option value="Diverse" ${currentExam === 'Diverse' ? 'selected' : ''}>Diverse</option>
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
                        <div style="margin-top:10px;">${optsHtml}</div>
                        ${explanationHtml}
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

        async function rejectWaitingQuestion(id) {
            if (!confirm('Sigur dorești să respingi (ștergi) această întrebare din lista de așteptare?')) return;
            try {
                const res = await fetchWithToken(`${API_MANAGE_WAITING}?id=${id}`, { method: 'DELETE' });
                if (res.ok) {
                    showToast('Întrebare respinsă!');
                    waitingQuestionsData = waitingQuestionsData.filter(x => x.id !== id);
                    document.getElementById('badge-waiting-count').textContent = waitingQuestionsData.length;
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
                try { opts = JSON.parse(opts); } catch(e) { opts = []; }
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
                options: opts,
                correct_index: q.correct_index,
                explanation: q.explanation || ''
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
            const htmlArr = studentsData.map(s => {
                const dateStr = formatDate(s.created_at);
                const phoneStr = s.phone_number ? escapeHtml(s.phone_number) : '<span style="color:var(--accent-red); font-size:12px;">Nesetat</span>';
                return `
                    <tr>
                        <td>${s.id}</td>
                        <td style="font-weight:600;">${escapeHtml(s.username)}</td>
                        <td>${phoneStr}</td>
                        <td style="font-family: monospace; letter-spacing: 1px;">
                            <span id="pw-mask-${s.id}">••••••••</span>
                            <span id="pw-val-${s.id}" style="display:none;">${escapeHtml(s.password)}</span>
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
                const res = await fetchWithToken(API_MANAGE_STUDENTS, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete', id })
                });

                if (!res.ok) throw new Error();
                showToast('Cont șters cu succes!');
                loadStudents();
            } catch (err) {
                showToast('Eroare la ștergerea contului', true);
            }
        }

        /* ==================== PDF EXPORT ==================== */
        function exportResultsPDF() {
            const modalContent = document.querySelector('#modal-details .modal-content');
            if (!modalContent) return;

            const studentName = document.getElementById('details-student-name').innerText.replace('Detalii Test Student', '').trim() || 'Student';
            
            // Temporary styles for PDF
            const originalMaxHeight = modalContent.style.maxHeight;
            const originalOverflow = document.getElementById('details-list').style.overflowY;
            
            modalContent.style.maxHeight = 'none';
            document.getElementById('details-list').style.overflowY = 'visible';

            const opt = {
                margin:       10,
                filename:     `Rezultate_AcaDe_QUIZ_${studentName.replace(/\\s+/g, '_')}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, logging: false },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // Exclude buttons from PDF
            const buttons = modalContent.querySelectorAll('button');
            buttons.forEach(b => b.style.display = 'none');

            html2pdf().set(opt).from(modalContent).save().then(() => {
                // Restore styles
                modalContent.style.maxHeight = originalMaxHeight;
                document.getElementById('details-list').style.overflowY = originalOverflow;
                buttons.forEach(b => b.style.display = '');
                showToast('PDF generat cu succes!');
            }).catch(e => {
                modalContent.style.maxHeight = originalMaxHeight;
                document.getElementById('details-list').style.overflowY = originalOverflow;
                buttons.forEach(b => b.style.display = '');
                showToast('Eroare la generare PDF.', true);
                console.error(e);
            });
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
            grid.innerHTML = '';
            
            studentsData.forEach(student => {
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
                assignedList.innerHTML = studentPending.map(pt => `
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:8px; padding:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:600; color:var(--text-primary); margin-bottom:4px;">Test ${pt.exam_type} (${pt.target_length} întrebări)</div>
                            <div style="font-size:12px; color:var(--text-secondary);">Deadline: ${new Date(pt.deadline).toLocaleString('ro-RO')}</div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button class="btn btn-secondary" onclick="previewAssignedTest('${pt.id}')" style="padding:6px 12px; font-size:12px;">Vizualizare</button>
                            <button class="btn btn-secondary" onclick="deleteAssignedTest('${pt.id}')" style="padding:6px 12px; font-size:12px; border-color:rgba(248,113,113,0.3); color:var(--accent-red);">Șterge</button>
                        </div>
                    </div>
                `).join('');
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
                    
                    tr.innerHTML = `
                        <td><span class="badge badge-medium">${r.test_type === 'initial' ? 'Inițial' : 'Intermediar'}</span></td>
                        <td style="font-weight:700;">${r.score}/${r.total_points} <span style="color:var(--accent-purple); font-size:12px; margin-left:4px;">${pct}%</span></td>
                        <td>${r.blur_count}</td>
                        <td>${timeStr}</td>
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

        function openAssignTestModal(username) {
            if (username) {
                document.getElementById('assign-username').value = username;
                document.getElementById('assign-student-name').value = username;
            }
            
            // set default deadline tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(20, 0, 0, 0);
            
            const offset = tomorrow.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(tomorrow.getTime() - offset)).toISOString().slice(0, 16);
            document.getElementById('assign-deadline').value = localISOTime;
            
            document.getElementById('modal-assign').style.display = 'flex';
        }

        function closeAssignModal() {
            document.getElementById('modal-assign').style.display = 'none';
        }

        function viewResultDetails(id) {
            const r = resultsData.find(res => res.id === id);
            if (!r) return;
            
            const nameEl = document.getElementById('details-student-name');
            if(nameEl) nameEl.innerText = `Detalii Test Student: ${r.student_username}`;
            
            let detailsJson = r.details_json;
            if (typeof detailsJson === 'string') {
                try { detailsJson = JSON.parse(detailsJson); } catch(e) { detailsJson = []; }
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
            const deadline = new Date(document.getElementById('assign-deadline').value).toISOString();

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
                alert(err.message);
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
                loadSituatie();
            } catch(e) {
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

            const testQs = test.questions_ids.map(qid => questionsData.find(q => q.id === qid)).filter(Boolean);

            renderPreviewTest(testQs);
        }

        function renderPreviewTest(testQs) {
            const list = document.getElementById('preview-test-list');
            list.innerHTML = '';
            
            if (testQs.length === 0) {
                list.innerHTML = '<p>Testul nu conține nicio întrebare validă.</p>';
                return;
            }

            testQs.forEach((q, idx) => {
                const card = document.createElement('div');
                card.className = 'detail-card';
                let optsHtml = '';
                try {
                    const opts = typeof q.options_json === 'string' ? JSON.parse(q.options_json) : q.options_json;
                    if (opts && Array.isArray(opts)) {
                        optsHtml = opts.map((opt, i) => {
                            const isCorrect = i === q.correct_index;
                            return `<div style="font-size:13px; color:var(--text-secondary); margin-bottom:4px; ${isCorrect ? 'color:var(--accent-green); font-weight:bold;' : ''}">${String.fromCharCode(65 + i)}. ${escapeHtml(opt)}${isCorrect ? ' (Corect)' : ''}</div>`;
                        }).join('');
                        optsHtml = `<div style="margin-top:8px;">${optsHtml}</div>`;
                    }
                } catch(e) {}

                card.innerHTML = `
                    <div class="detail-header">
                        <div>
                            <span class="badge badge-${q.difficulty}">${q.difficulty}</span>
                            <span class="badge" style="background:rgba(255,255,255,0.1); margin-left:8px;">${q.exam_type}</span>
                            <span class="badge" style="background:rgba(255,255,255,0.1); margin-left:8px;">${q.category}</span>
                            <div class="q-text" style="margin-top:8px;"><strong>${idx + 1}.</strong> ${escapeHtml(q.text)}</div>
                            ${q.code ? `<div class="detail-code" style="background:#0c0d1e; padding:10px; border-radius:4px; font-size:12px; color:#a6accd; margin:8px 0; overflow-x:auto;"><pre style="margin:0;">${escapeHtml(q.code)}</pre></div>` : ''}
                            ${q.image_url ? `<img src="${q.image_url}" style="margin: 10px 0; max-height: 150px; border-radius:8px;">` : ''}
                            ${optsHtml}
                        </div>
                        ${isPreviewingDraft ? `<button class="btn btn-secondary" style="font-size: 12px; padding: 4px 8px; border-color:var(--accent-purple);" onclick="regenerateQuestion('${currentlyPreviewedTestId}', ${q.id})">🔄 Regenerare (Schimbă)</button>` : ''}
                    </div>
                `;
                list.appendChild(card);
            });
        }

        window.deleteAssignedTest = async function(id) {
            if(!confirm("Sigur ștergi acest test asignat?")) return;
            try {
                const res = await fetchWithToken(API_ASSIGNED_TESTS + '?id=' + id, { method: 'DELETE' });
                if(res.ok) {
                    showToast('Test șters cu succes!');
                    const testToDelete = assignedTestsData.find(t => t.id === id);
                    assignedTestsData = assignedTestsData.filter(t => t.id !== id);
                    if (testToDelete) {
                        openSituatieDetail(testToDelete.student_username);
                    }
                } else {
                    showToast('Eroare la ștergere', true);
                }
            } catch(e) { 
                showToast('Eroare de rețea', true); 
            }
        };

        window.deleteResultHistory = async function(id, username) {
            if(!confirm("Sigur ștergi acest rezultat din istoric? Această acțiune este ireversibilă.")) return;
            try {
                const res = await fetchWithToken(API_DEL_RESULT + '?id=' + id, { method: 'DELETE' });
                if(res.ok) {
                    showToast('Rezultat șters cu succes!');
                    // Reload data
                    await loadResults();
                    openSituatieDetail(username);
                } else {
                    showToast('Eroare la ștergerea rezultatului', true);
                }
            } catch(e) {
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
                    currentDraftTest.questions_ids = currentDraftTest.questions_ids.map(qid => qid === oldQuestionId ? newQId : qid);
                    const testQs = currentDraftTest.questions_ids.map(qid => questionsData.find(q => q.id === qid)).filter(Boolean);
                    renderPreviewTest(testQs);
                    showToast('Întrebarea a fost înlocuită!');
                } else {
                    const updatedTest = data;
                    const idx = assignedTestsData.findIndex(t => t.id === testId);
                    if (idx !== -1) assignedTestsData[idx] = updatedTest;

                    const testQs = updatedTest.questions_ids.map(qid => questionsData.find(q => q.id === qid)).filter(Boolean);
                    renderPreviewTest(testQs);

                    showToast('Întrebarea a fost înlocuită!');
                    loadSituatie();
                }
            } catch (err) {
                alert(err.message);
                showToast('Eroare: ' + err.message, true);
            }
        }

        function closePreviewModal() {
            document.getElementById('modal-preview-test').style.display = 'none';
            currentlyPreviewedTestId = null;
        }