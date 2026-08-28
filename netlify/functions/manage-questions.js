const utils = require('./_utils');

function sanitizeText(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

exports.handler = async function(event, context) {
    const headers = utils.getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!utils.verifyAdminToken(event)) {
        return utils.createErrorResponse(401, 'Unauthorized: Invalid Admin Token', headers);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Supabase environment variables are missing.' })
        };
    }

    try {
        const method = event.httpMethod;
        const params = event.queryStringParameters || {};

        function normalizeExamType(et) {
            if (!et) return 'Diverse';
            let types = et.split(',').map(s => s.trim()).filter(Boolean);
            if (types.includes('Initial')) {
                if (types.includes('BAC')) return 'Initial,BAC';
                if (types.includes('Academie')) return 'Initial,Academie';
                if (types.includes('Poli')) return 'Initial,Poli';
                return 'Initial,Diverse';
            }
            return types.join(',');
        }

        if (method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { exam_type, difficulty, type, category, subcategory, text, image_url, code, options_json, correct_index, hint, explanation } = body;

            if (!exam_type || !difficulty || !type || !text || !options_json || correct_index === undefined) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing required fields.' })
                };
            }

            const validCategories = {
                "Fundamente": ["Citire si afisare date", "Operatori si expresii", "Structuri de control", "Complexitati"],
                "Organizarea Datelor": ["Vectori", "Matrice", "Siruri de caractere", "Structuri de date (struct)"],
                "Subprograme": ["Transmitere prin valoare", "Transmitere prin referinta", "Recursivitate"],
                "Backtracking": ["Teorie si aplicare practica"],
                "Grafuri si Arbori": ["Terminologie grafuri", "Grafuri orientate", "Grafuri neorientate", "Arbori"]
            };

            if (category && !validCategories[category]) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Categoria '${category}' este invalidă.` }) };
            }
            if (category && subcategory && (!validCategories[category].includes(subcategory))) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Subcategoria '${subcategory}' este invalidă pentru categoria '${category}'.` }) };
            }

            let parsedOptions = typeof options_json === 'string' ? JSON.parse(options_json) : options_json;
            if (!Array.isArray(parsedOptions) || parsedOptions.length < 2 || parsedOptions.length > 6) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Numărul de opțiuni de răspuns trebuie să fie între 2 și 6.' })
                };
            }

            const parsedCorrectIndex = parseInt(correct_index);
            if (isNaN(parsedCorrectIndex) || parsedCorrectIndex < 0 || parsedCorrectIndex >= parsedOptions.length) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Indexul răspunsului corect este în afara limitelor opțiunilor.' })
                };
            }

            const response = await fetch(`${supabaseUrl}/rest/v1/questions`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    exam_type: normalizeExamType(exam_type),
                    difficulty,
                    type,
                    category: category || null,
                    subcategory: subcategory || null,
                    text,
                    image_url: image_url || null,
                    code: code || null,
                    hint: hint || explanation || null,
                    options_json: parsedOptions,
                    correct_index: parsedCorrectIndex
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Insert failed: ${response.status} - ${errText}`);
            }

            const data = await response.json();
            return { statusCode: 201, headers, body: JSON.stringify({ success: true, data }) };

        } else if (method === 'PUT') {
            const id = params.id;
            if (!id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing question id.' }) };
            }

            const body = JSON.parse(event.body || '{}');

            // Whitelist allowed fields to prevent injection
            const allowedFields = ['exam_type', 'difficulty', 'type', 'category', 'subcategory', 'text', 'image_url', 'code', 'options_json', 'correct_index', 'hint'];
            const safeBody = {};
            for (const key of allowedFields) {
                if (body[key] !== undefined) {
                    safeBody[key] = body[key];
                }
            }
            if (safeBody.hint === undefined && body.explanation !== undefined) {
                safeBody.hint = body.explanation;
            }

            const validCategories = {
                "Fundamente": ["Citire si afisare date", "Operatori si expresii", "Structuri de control", "Complexitati"],
                "Organizarea Datelor": ["Vectori", "Matrice", "Siruri de caractere", "Structuri de date (struct)"],
                "Subprograme": ["Transmitere prin valoare", "Transmitere prin referinta", "Recursivitate"],
                "Backtracking": ["Teorie si aplicare practica"],
                "Grafuri si Arbori": ["Terminologie grafuri", "Grafuri orientate", "Grafuri neorientate", "Arbori"]
            };

            const checkCat = safeBody.category;
            const checkSubcat = safeBody.subcategory;
            if (checkCat !== undefined && checkCat !== null && checkCat !== "") {
                if (!validCategories[checkCat]) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Categoria '${checkCat}' este invalidă.` }) };
                }
                if (checkSubcat && (!validCategories[checkCat].includes(checkSubcat))) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Subcategoria '${checkSubcat}' este invalidă pentru categoria '${checkCat}'.` }) };
                }
            }

            if (safeBody.options_json !== undefined) {
                if (typeof safeBody.options_json === 'string') {
                    safeBody.options_json = JSON.parse(safeBody.options_json);
                }
                if (!Array.isArray(safeBody.options_json) || safeBody.options_json.length < 2 || safeBody.options_json.length > 6) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Numărul de opțiuni trebuie să fie între 2 și 6.' }) };
                }
            }
            if (safeBody.exam_type) {
                safeBody.exam_type = normalizeExamType(safeBody.exam_type);
            }
            if (safeBody.correct_index !== undefined) {
                safeBody.correct_index = parseInt(safeBody.correct_index);
            }

            if (Object.keys(safeBody).length === 0) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'No valid fields provided for update.' }) };
            }

            const response = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(safeBody)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Update failed: ${response.status} - ${errText}`);
            }

            const data = await response.json();
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };

        } else if (method === 'DELETE') {
            const id = params.id;
            if (!id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing question id.' }) };
            }

            const response = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Delete failed: ${response.status} - ${errText}`);
            }

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Question deleted.' }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    } catch (error) {
        console.error('Error in manage-questions:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
