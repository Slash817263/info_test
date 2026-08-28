const utils = require('./_utils');

exports.handler = async function(event, context) {
    const headers = utils.getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing Supabase vars' }) };
    }

    // Verify token (either Admin token or Student JWT)
    const isAdmin = utils.verifyAdminToken(event);
    let authenticatedUsername = null;
    if (!isAdmin) {
        const decoded = utils.parseJwt(event);
        if (decoded && decoded.username) {
            authenticatedUsername = decoded.username;
        }
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { student_id, username, phone_number, phone } = body;
        const rawPhone = phone_number || phone;
        const targetUsername = username || authenticatedUsername;

        if (!rawPhone || (!student_id && !targetUsername)) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: 'Numărul de telefon și identificatorul elevului sunt obligatorii.' }) 
            };
        }

        if (!isAdmin && authenticatedUsername && targetUsername && authenticatedUsername.toLowerCase() !== targetUsername.toLowerCase()) {
            return { 
                statusCode: 403, 
                headers, 
                body: JSON.stringify({ error: 'Nu ai permisiunea de a modifica acest profil.' }) 
            };
        }

        // Normalize Romanian phone numbers if starting with +40, 40, etc
        let cleanPhone = String(rawPhone).trim().replace(/\s+/g, '').replace(/[-().]/g, '');
        if (cleanPhone.startsWith('+40')) cleanPhone = '0' + cleanPhone.substring(3);
        else if (cleanPhone.startsWith('40') && cleanPhone.length === 11) cleanPhone = '0' + cleanPhone.substring(2);
        else if (cleanPhone.startsWith('7') && cleanPhone.length === 9) cleanPhone = '0' + cleanPhone;

        // Validate Romanian phone number (starts with 07, exactly 10 digits)
        const phoneRegex = /^07\d{8}$/;
        if (!phoneRegex.test(cleanPhone)) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: 'Format număr invalid. Trebuie să fie de tipul 07XXXXXXXX (10 cifre).' }) 
            };
        }

        // Try updating by student_id and/or username
        let filterQuery = '';
        if (student_id && targetUsername) {
            filterQuery = `id=eq.${student_id}&username=ilike.${encodeURIComponent(targetUsername)}`;
        } else if (student_id) {
            filterQuery = `id=eq.${student_id}`;
        } else {
            filterQuery = `username=ilike.${encodeURIComponent(targetUsername)}`;
        }

        let res = await fetch(`${supabaseUrl}/rest/v1/students?${filterQuery}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ phone_number: cleanPhone })
        });

        if (!res.ok) {
            return { 
                statusCode: 500, 
                headers, 
                body: JSON.stringify({ error: 'Eroare la baza de date la actualizarea numărului' }) 
            };
        }

        let data = await res.json();
        
        // If query with student_id returned empty, try fallback by username alone
        if ((!data || data.length === 0) && targetUsername && student_id) {
            const fallbackRes = await fetch(`${supabaseUrl}/rest/v1/students?username=ilike.${encodeURIComponent(targetUsername)}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ phone_number: cleanPhone })
            });
            if (fallbackRes.ok) {
                const fbData = await fallbackRes.json();
                if (fbData && fbData.length > 0) {
                    data = fbData;
                }
            }
        }

        if (!data || data.length === 0) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Utilizator negăsit.' }) };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, phone_number: cleanPhone })
        };

    } catch (e) {
        console.error('update-phone error:', e);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Eroare internă de server.' })
        };
    }
};
