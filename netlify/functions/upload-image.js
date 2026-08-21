exports.handler = async function (event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token, X-Admin-Token',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    const token = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
    const validTokens = [process.env.ADMIN_SECRET].filter(Boolean);
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Supabase environment variables missing.' })
        };
    }

    if (!token || !validTokens.includes(token)) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Neautorizat' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { filename, base64data, contentType } = body;

        if (!filename || !base64data || !contentType) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Date incomplete.' })
            };
        }

        const timestamp = Date.now();
        const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const uniqueFileName = `${timestamp}-${safeName}`;

        const buffer = Buffer.from(base64data, 'base64');
        const uploadUrl = `${supabaseUrl}/storage/v1/object/images/${uniqueFileName}`;

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': contentType
            },
            body: buffer
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }

        const publicUrl = `${supabaseUrl}/storage/v1/object/public/images/${uniqueFileName}`;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ publicUrl })
        };

    } catch (e) {
        console.error('Upload Error:', e);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Eroare la încărcare.', details: e.message })
        };
    }
};
