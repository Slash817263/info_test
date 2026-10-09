const utils = require('./_utils');

exports.handler = async function(event, context) {
    const headers = utils.getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL', process.env.SUPABASE_URL);
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY', process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

    if (!supabaseUrl || !supabaseKey) {
        return utils.createErrorResponse(500, 'Supabase env missing.', headers);
    }

    const isAdmin = utils.verifyAdminToken(event);
    if (!isAdmin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Doar administratorul are acces.' }) };
    }

    const method = event.httpMethod;

    try {
        if (method === 'GET') {
            // 1. Fetch all preset tests
            const presetsRes = await fetch(`${supabaseUrl}/rest/v1/preset_tests?order=created_at.desc`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            if (!presetsRes.ok) {
                const errText = await presetsRes.text();
                if (errText.includes('Could not find the table') || presetsRes.status === 404) {
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            presets: [],
                            table_missing: true,
                            message: 'Tabela preset_tests nu există încă în Supabase. Rulează scriptul supabase_preset_tests_migration.sql din SQL Editor.'
                        })
                    };
                }
                throw new Error(errText);
            }

            const presets = await presetsRes.json();

            // 2. Fetch assigned tests statistics
            let statsMap = {};
            try {
                const asRes = await fetch(`${supabaseUrl}/rest/v1/assigned_tests?select=id,preset_id,status`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (asRes.ok) {
                    const assignedList = await asRes.json();
                    (assignedList || []).forEach(at => {
                        if (at.preset_id) {
                            if (!statsMap[at.preset_id]) {
                                statsMap[at.preset_id] = { total: 0, completed: 0, pending: 0 };
                            }
                            statsMap[at.preset_id].total++;
                            if (at.status === 'completed') statsMap[at.preset_id].completed++;
                            else statsMap[at.preset_id].pending++;
                        }
                    });
                }
            } catch (e) {
                console.warn('Could not compute assigned stats:', e);
            }

            const enriched = (presets || []).map(p => {
                const s = statsMap[p.id] || { total: 0, completed: 0, pending: 0 };
                return {
                    ...p,
                    time_limit_minutes: p.time_limit_min || 0,
                    active_assigned: s.pending,
                    completed_assigned: s.completed,
                    total_assigned: s.total,
                    stats: s
                };
            });

            return { statusCode: 200, headers, body: JSON.stringify({ presets: enriched }) };

        } else if (method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { title, description, exam_type, questions_ids } = body;
            const timeLimit = parseInt(body.time_limit_min || body.time_limit_minutes || 0, 10) || 0;

            if (!title || !title.trim()) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Titlul testului este obligatoriu.' }) };
            }

            if (!Array.isArray(questions_ids) || questions_ids.length === 0) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Trebuie să selectezi cel puțin o întrebare pentru acest test.' }) };
            }

            const payload = {
                title: title.trim(),
                description: (description || '').trim(),
                exam_type: exam_type || 'Diverse',
                questions_ids: questions_ids.map(n => Number(n)),
                time_limit_min: timeLimit,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const insertRes = await fetch(`${supabaseUrl}/rest/v1/preset_tests`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(payload)
            });

            if (!insertRes.ok) {
                const errText = await insertRes.text();
                if (errText.includes('Could not find the table') || insertRes.status === 404) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Tabela preset_tests nu este creată în Supabase. Rulează scriptul supabase_preset_tests_migration.sql din SQL Editor!' })
                    };
                }
                throw new Error(errText);
            }

            const inserted = await insertRes.json();
            return { statusCode: 201, headers, body: JSON.stringify({ success: true, preset: inserted[0] }) };

        } else if (method === 'PUT') {
            const body = JSON.parse(event.body || '{}');
            const { id, title, description, exam_type, questions_ids } = body;
            const timeLimit = parseInt(body.time_limit_min || body.time_limit_minutes || 0, 10) || 0;

            if (!id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID-ul testului este obligatoriu.' }) };
            }

            if (!title || !title.trim()) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Titlul testului este obligatoriu.' }) };
            }

            if (!Array.isArray(questions_ids) || questions_ids.length === 0) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Trebuie să existe cel puțin o întrebare în test.' }) };
            }

            const payload = {
                title: title.trim(),
                description: (description || '').trim(),
                exam_type: exam_type || 'Diverse',
                questions_ids: questions_ids.map(n => Number(n)),
                time_limit_min: timeLimit,
                updated_at: new Date().toISOString()
            };

            const updateRes = await fetch(`${supabaseUrl}/rest/v1/preset_tests?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(payload)
            });

            if (!updateRes.ok) throw new Error(await updateRes.text());
            const updated = await updateRes.json();
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, preset: updated[0] }) };

        } else if (method === 'DELETE') {
            const params = event.queryStringParameters || {};
            let bodyObj = {};
            if (event.body) {
                try { bodyObj = JSON.parse(event.body); } catch(e) {}
            }
            const id = params.id || bodyObj.id;

            if (!id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID-ul testului este obligatoriu pentru ștergere.' }) };
            }

            const delRes = await fetch(`${supabaseUrl}/rest/v1/preset_tests?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            if (!delRes.ok) throw new Error(await delRes.text());
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Testul predefinit a fost șters.' }) };

        } else {
            return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
        }
    } catch (e) {
        console.error('Error in manage-preset-tests:', e);
        return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || 'Eroare internă de server' }) };
    }
};
