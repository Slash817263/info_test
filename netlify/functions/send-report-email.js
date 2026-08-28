const fs = require('fs');
const path = require('path');

function getLiveEnv(key, fallback = '') {
    try {
        const envCandidates = [
            path.resolve(__dirname, '../../.env'),
            path.resolve(__dirname, '../.env'),
            path.resolve(process.cwd(), '.env')
        ];
        for (const p of envCandidates) {
            if (fs.existsSync(p)) {
                const content = fs.readFileSync(p, 'utf8');
                for (const line of content.split('\n')) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                        const idx = trimmed.indexOf('=');
                        const k = trimmed.slice(0, idx).trim();
                        const v = trimmed.slice(idx + 1).trim();
                        if (k === key) return v;
                    }
                }
            }
        }
    } catch (e) {}
    return process.env[key] || fallback;
}

exports.handler = async function (event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token, X-Admin-Token',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const internalSecret = getLiveEnv('INTERNAL_API_SECRET', process.env.INTERNAL_API_SECRET);
    const providedSecret = event.headers['x-internal-secret'] || event.headers['X-Internal-Secret'];
    if (!internalSecret || providedSecret !== internalSecret) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    const resendApiKey = getLiveEnv('RESEND_API_KEY', process.env.RESEND_API_KEY);
    const tutorEmail = getLiveEnv('TUTOR_EMAIL', process.env.TUTOR_EMAIL || 'acadeinformatica10@gmail.com');
    const fromEmail = getLiveEnv('RESEND_FROM', process.env.RESEND_FROM || 'AcaDe-QUIZ <onboarding@resend.dev>');

    try {
        const body = JSON.parse(event.body || '{}');
        const {
            student_name,
            phone,
            score,
            total_points,
            time_taken_ms,
            blur_count,
            details,
            stats
        } = body;

        const fullName = (student_name || 'Elev').trim();
        const cleanPhone = (phone || '').trim();
        const totalPoints = total_points || (details ? details.length : 30);
        const userScore = score || 0;
        const pct = Math.round((userScore / totalPoints) * 100);

        const timeMin = Math.floor((time_taken_ms || 0) / 60000);
        const timeSec = Math.floor(((time_taken_ms || 0) % 60000) / 1000);
        const timeStr = `${timeMin}m ${timeSec}s`;

        // Process Category Diagnostic Breakdown
        const categoryMap = {};
        (details || []).forEach(d => {
            const cat = d.category || 'Diverse';
            if (!categoryMap[cat]) {
                categoryMap[cat] = { name: cat, total: 0, correct: 0, wrong: 0, subcategories: {} };
            }
            categoryMap[cat].total++;
            if (d.isCorrect) categoryMap[cat].correct++;
            else categoryMap[cat].wrong++;

            const sub = d.subcategory;
            if (sub) {
                if (!categoryMap[cat].subcategories[sub]) categoryMap[cat].subcategories[sub] = { total: 0, correct: 0, wrong: 0 };
                categoryMap[cat].subcategories[sub].total++;
                if (d.isCorrect) categoryMap[cat].subcategories[sub].correct++;
                else categoryMap[cat].subcategories[sub].wrong++;
            }
        });

        const categories = Object.values(categoryMap);
        // Sort ascending by score percentage so critical gaps appear first
        categories.sort((a, b) => (a.correct / a.total) - (b.correct / b.total));

        const criticalCategories = categories.filter(c => Math.round((c.correct / c.total) * 100) < 50);

        const catIcons = {
            'Fundamente': '📘',
            'Organizarea Datelor': '📗',
            'Subprograme': '📙',
            'Backtracking': '📕',
            'Grafuri si Arbori': '📓'
        };

        // Build HTML Category Cards (Clean Mobile-Responsive Layout - No Squished Tables)
        const categoryCardsHtml = categories.map(cat => {
            const catPct = Math.round((cat.correct / cat.total) * 100);
            const icon = catIcons[cat.name] || '📂';
            let statusBadge = '';
            let barColor = '#34d399';

            if (catPct < 50) {
                barColor = '#f87171';
                statusBadge = `<span style="background-color: rgba(239, 68, 68, 0.25); color: #fca5a5; border: 1px solid #ef4444; padding: 2px 8px; border-radius: 10px; font-weight: 700; font-size: 11px;">🚨 ${catPct === 0 ? '0% - Lipsuri Majore' : 'CRITIC (' + catPct + '%)'}</span>`;
            } else if (catPct < 75) {
                barColor = '#fbbf24';
                statusBadge = `<span style="background-color: rgba(245, 158, 11, 0.25); color: #fde68a; border: 1px solid #f59e0b; padding: 2px 8px; border-radius: 10px; font-weight: 700; font-size: 11px;">⚠️ Mediu (${catPct}%)</span>`;
            } else {
                barColor = '#34d399';
                statusBadge = `<span style="background-color: rgba(52, 211, 153, 0.25); color: #a7f3d0; border: 1px solid #10b981; padding: 2px 8px; border-radius: 10px; font-weight: 700; font-size: 11px;">✔️ Consolidat</span>`;
            }

            const weakSubs = Object.entries(cat.subcategories)
                .filter(([_, data]) => data.wrong > 0)
                .map(([name, data]) => `<span style="display: inline-block; font-size: 11px; color: #cbd5e1; background-color: rgba(0, 0, 0, 0.4); padding: 3px 8px; border-radius: 4px; margin: 2px 4px 2px 0;">${name}: <strong>${data.correct}/${data.total}</strong></span>`)
                .join('');

            const weakSubsRow = weakSubs ? `
                <tr>
                    <td colspan="2" style="padding-top: 6px;">
                        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 2px;">Subcapitole cu erori:</div>
                        ${weakSubs}
                    </td>
                </tr>
            ` : '';

            return `
                <div style="background-color: #16163a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 14px 16px; margin-bottom: 12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                        <tr>
                            <td align="left" style="font-size: 15px; font-weight: 700; color: #ffffff; padding-bottom: 6px;">
                                ${icon} ${cat.name}
                            </td>
                            <td align="right" style="font-size: 13px; font-weight: 800; color: ${barColor}; padding-bottom: 6px; white-space: nowrap;">
                                ${cat.correct}/${cat.total} &bull; ${catPct}% &nbsp; ${statusBadge}
                            </td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding-bottom: 4px;">
                                <div style="background-color: rgba(255, 255, 255, 0.08); height: 8px; border-radius: 4px; overflow: hidden; width: 100%;">
                                    <div style="background-color: ${barColor}; height: 100%; width: ${catPct}%; border-radius: 4px;"></div>
                                </div>
                            </td>
                        </tr>
                        ${weakSubsRow}
                    </table>
                </div>
            `;
        }).join('');

        // Build Question Details for Attachment
        const questionsBreakdownHtml = (details || []).map((d, i) => {
            const isCor = !!d.isCorrect;
            const statusIcon = isCor ? '✔️ Corect' : '❌ Greșit';
            const statusColor = isCor ? '#34d399' : '#f87171';
            const studentChoice = (d.studentAnswer !== null && d.studentAnswer !== undefined && d.options) ? (d.options[d.studentAnswer] || 'Fără răspuns') : 'Fără răspuns';
            const correctChoice = (d.options && d.options[d.correctAnswer]) ? d.options[d.correctAnswer] : 'Opțiune corectă';

            return `
                <div style="background-color: #16163a; border: 1px solid ${isCor ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}; border-radius: 8px; padding: 14px; margin-bottom: 12px; text-align: left;">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                        <strong style="color:#ffffff; font-size:14px;">#${i + 1} (${d.category || 'General'})</strong>
                        <span style="color:${statusColor}; font-weight:bold; font-size:12px;">${statusIcon}</span>
                    </div>
                    <div style="color:#e2e8f0; font-size:13px; margin-bottom: 8px; line-height: 1.5; white-space:pre-wrap;">${(d.text || '').replace(/\\n/g, '\n')}</div>
                    ${d.code ? `<pre style="background:#090a1a; border: 1px solid rgba(255,255,255,0.06); padding:10px; border-radius:6px; font-size:12px; color:#a6accd; margin:8px 0; overflow-x:auto;"><code>${d.code}</code></pre>` : ''}
                    <div style="font-size:12px; margin-top: 8px; background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 6px;">
                        ${!isCor ? `<div style="color:#f87171; margin-bottom:4px;">Răspuns elev: <strong>${studentChoice}</strong></div>` : ''}
                        <div style="color:#34d399;">Răspuns corect: <strong>${correctChoice}</strong></div>
                    </div>
                </div>
            `;
        }).join('');

        function formatWhatsAppNumber(p) {
            if (!p) return '';
            let digits = String(p).replace(/[^0-9]/g, '');
            if (digits.startsWith('0040')) {
                digits = digits.substring(2);
            } else if (digits.startsWith('0') && digits.length === 10) {
                digits = '40' + digits.substring(1);
            } else if (!digits.startsWith('40') && digits.length === 9) {
                digits = '40' + digits;
            }
            return digits;
        }

        const waPhone = formatWhatsAppNumber(cleanPhone);
        const cleanFullName = (fullName || 'Elev').replace(/\s*\(Test\s+Introductiv\)/gi, '').trim();
        const waMessage = encodeURIComponent(`Salut, ${cleanFullName}! Am analizat raportul tău la testul de informatică.👨‍💻\nCa să ajungi la excelență, vom rezolva împreună aceste lipsuri, pas cu pas. 💯\nPentru moment, aș dori să programăm sesiunea gratuită de diagnosticare! 🕑`);

        // Full HTML Email Template (Dark Theme & Perfectly Centered)
        const emailHtml = `
<!DOCTYPE html>
<html lang="ro" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark only">
    <meta name="supported-color-schemes" content="dark">
    <title>Raport Diagnostic C++</title>
    <style>
        :root { color-scheme: dark only; supported-color-schemes: dark; }
        body, table, td, div, p, a { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif !important; }
        @media only screen and (max-width: 600px) {
            .email-main-table { width: 100% !important; border-radius: 0 !important; }
            .content-padding { padding: 16px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #07071a; color: #e0e0f0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">

    <!-- Outer Centering Wrapper -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#07071a" style="background-color: #07071a; width: 100%; margin: 0; padding: 24px 8px;">
        <tr>
            <td align="center" valign="top">
                
                <!-- Main Card (Max 580px) -->
                <table role="presentation" class="email-main-table" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0d0d26" style="max-width: 580px; background-color: #0d0d26; border: 1px solid rgba(124,106,255,0.4); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
                    
                    <!-- Header Banner -->
                    <tr>
                        <td align="center" style="background: linear-gradient(135deg, #7c6aff 0%, #38bdf8 100%); padding: 26px 20px;">
                            <h1 style="margin: 0; font-size: 26px; color: #ffffff; font-weight: 900; letter-spacing: -0.5px; text-shadow: 0 2px 8px rgba(0,0,0,0.3);">AcaDe-QUIZ</h1>
                            <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.95); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Raport de Diagnostic & Evaluare</p>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td class="content-padding" style="padding: 24px;">
                            
                            <!-- Lead Profile Card -->
                            <div style="background-color: #16163a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; margin-bottom: 20px; text-align: left;">
                                <div style="font-size: 19px; font-weight: 800; color: #ffffff; margin-bottom: 8px;">👤 ${fullName}</div>
                                <div style="font-size: 14px; color: #38bdf8; margin-bottom: 6px;">
                                    📱 WhatsApp: ${waPhone ? `<a href="https://wa.me/${waPhone}?text=${waMessage}" style="color: #38bdf8; font-weight: bold; text-decoration: none;">${cleanPhone}</a>` : `<span style="color: #94a3b8;">${cleanPhone || 'Nesetat'}</span>`}
                                </div>
                                <div style="font-size: 13px; color: #94a3b8;">
                                    ⏱️ Timp de lucru: <strong style="color: #ffffff;">${timeStr}</strong> &bull; ⚠️ Abateri focus: <strong style="color: #ffffff;">${blur_count || 0}</strong>
                                </div>
                            </div>

                            <!-- Score Card -->
                            <div style="background: linear-gradient(135deg, rgba(124,106,255,0.18), rgba(56,189,248,0.15)); border: 1px solid rgba(124,106,255,0.45); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                                <div style="font-size: 12px; text-transform: uppercase; color: #a78bfa; font-weight: 800; letter-spacing: 1.5px;">Scor Test Inițial</div>
                                <div style="font-size: 42px; font-weight: 900; color: #ffffff; margin: 4px 0; line-height: 1.1;">
                                    ${userScore} <span style="font-size: 20px; color: #94a3b8; font-weight: 600;">/ ${totalPoints}</span>
                                </div>
                                <div style="font-size: 15px; font-weight: 800; color: ${pct < 50 ? '#f87171' : pct < 75 ? '#fbbf24' : '#34d399'};">
                                    ${pct}% Punctaj Total
                                </div>
                            </div>

                            <!-- Critical Severity Alert -->
                            ${criticalCategories.length > 0 ? `
                            <div style="background-color: rgba(239,68,68,0.15); border: 1px solid #ef4444; border-radius: 10px; padding: 14px 16px; margin-bottom: 22px; text-align: left;">
                                <div style="font-weight: 800; color: #f87171; font-size: 14px; margin-bottom: 4px;">🚨 Lipsuri Majore Identificate:</div>
                                <div style="font-size: 13px; color: #fecaca; line-height: 1.5;">
                                    Elevul a obținut sub 50% la: <strong>${criticalCategories.map(c => c.name).join(', ')}</strong>. Este necesară o recuperare structurată a acestor capitole.
                                </div>
                            </div>
                            ` : ''}

                            <!-- Category Cards Header -->
                            <div style="font-size: 16px; font-weight: 800; color: #ffffff; margin: 0 0 14px 0; text-align: left;">
                                📊 Analiză pe Categorii de Materie
                            </div>

                            <!-- Category Cards List -->
                            ${categoryCardsHtml}

                            <!-- WhatsApp CTA Button -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px; margin-bottom: 8px;">
                                <tr>
                                    <td align="center">
                                        <a href="https://wa.me/${waPhone}?text=${waMessage}" 
                                           style="display: block; width: 100%; box-sizing: border-box; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 15px 20px; border-radius: 10px; font-weight: 800; font-size: 15px; text-align: center; box-shadow: 0 4px 20px rgba(16,185,129,0.4);">
                                            💬 Contactează Elevul pe WhatsApp
                                        </a>
                                    </td>
                                </tr>
                            </table>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="background-color: #08081a; padding: 16px 20px; font-size: 11px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.06);">
                            Generat automat de platforma AcaDe-QUIZ &bull; Raport Confidențial
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>
</html>
        `;

        // Standalone HTML Printable Attachment (Full Dark Theme)
        const standaloneAttachmentHtml = `
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Raport Diagnostic C++ — ${fullName}</title>
    <style>
        body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; background: #07071a; color: #f0f0ff; padding: 24px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
        .header { text-align: center; padding: 24px; background: #0f0f28; border-radius: 16px; border: 1px solid rgba(124,106,255,0.4); margin-bottom: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
        .score-box { background: linear-gradient(135deg, rgba(124,106,255,0.15), rgba(56,189,248,0.15)); border: 1px solid rgba(124,106,255,0.4); border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 24px; }
        .cat-card { background: #151538; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }
        .bar-bg { background: rgba(255,255,255,0.08); height: 8px; border-radius: 4px; overflow: hidden; margin-top: 6px; }
        .bar-fill { height: 100%; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin:0 0 8px 0; color:#fff; font-size:26px;">AcaDe-QUIZ — Raport Diagnostic</h1>
        <p style="margin:0; color:#94a3b8; font-size:15px;">Elev: <strong style="color:#38bdf8;">${fullName}</strong> | WhatsApp: <strong>${cleanPhone}</strong></p>
        <p style="margin:4px 0 0 0; color:#64748b; font-size:13px;">Timp: ${timeStr} | Abateri: ${blur_count || 0}</p>
    </div>

    <div class="score-box">
        <div style="font-size:13px; text-transform:uppercase; color:#a78bfa; font-weight:800; letter-spacing:1px;">Punctaj Test Inițial</div>
        <div style="font-size:44px; font-weight:900; color:#fff; margin:6px 0;">${userScore} / ${totalPoints}</div>
        <div style="font-size:16px; font-weight:bold; color:${pct < 50 ? '#f87171' : pct < 75 ? '#fbbf24' : '#34d399'};">${pct}% din punctajul maxim</div>
    </div>

    <h2 style="font-size:18px; color:#fff; margin:24px 0 12px 0;">📊 Analiză pe Categorii</h2>
    ${categoryCardsHtml}

    <h2 style="font-size:18px; color:#fff; margin:32px 0 14px 0;">📝 Detalii Întrebări & Răspunsuri</h2>
    ${questionsBreakdownHtml}
</body>
</html>
        `;

        // If Resend API key is configured, send the email
        if (resendApiKey) {
            const attachmentBase64 = Buffer.from(standaloneAttachmentHtml).toString('base64');
            const resendPayload = {
                from: fromEmail,
                to: [tutorEmail],
                subject: `🚨 Raport Diagnostic C++: ${fullName} (${userScore}/${totalPoints} pct - ${cleanPhone})`,
                html: emailHtml,
                attachments: [
                    {
                        filename: `Raport_Diagnostic_${fullName.replace(/[^a-zA-Z0-9]/g, '_')}.html`,
                        content: attachmentBase64
                    }
                ]
            };

            const emailRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(resendPayload)
            });

            if (!emailRes.ok) {
                const errText = await emailRes.text();
                console.error('Resend API Error:', errText);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: false, warning: 'Email sending failed', details: errText })
                };
            }

            if (!emailRes.ok) {
                const text = await emailRes.text().catch(()=>'');
                throw new Error(`HTTP ${emailRes.status} pe emailRes: ${text}`);
            }
            const resData = await emailRes.json();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'Email sent successfully via Resend!', data: resData })
            };
        } else {
            console.log('RESEND_API_KEY not configured. Simulated email delivery.');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'Simulated email delivery (RESEND_API_KEY not set).' })
            };
        }

    } catch (err) {
        console.error('send-report-email error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to send email' })
        };
    }
};
