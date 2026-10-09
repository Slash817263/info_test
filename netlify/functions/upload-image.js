const path = require('path');
const utils = require('./_utils');

const ALLOWED_MIME_TYPES = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/gif': ['.gif']
};
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function verifyImageSignature(buffer, mime) {
    if (!buffer || buffer.length < 12) return false;

    // JPEG: FF D8 FF
    if (mime === 'image/jpeg') {
        return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }
    // PNG: 89 50 4E 47
    if (mime === 'image/png') {
        return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    }
    // GIF: GIF8 (47 49 46 38)
    if (mime === 'image/gif') {
        return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
    }
    // WebP: RIFF .... WEBP
    if (mime === 'image/webp') {
        const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
        const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
        return isRiff && isWebp;
    }

    return false;
}

exports.handler = async function (event, context) {
    const headers = utils.getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return utils.createErrorResponse(405, 'Method Not Allowed', headers);
    }

    if (!utils.verifyAdminToken(event)) {
        return utils.createErrorResponse(401, 'Neautorizat: Token invalid sau lipsă', headers);
    }

    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL', process.env.SUPABASE_URL);
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY', process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

    if (!supabaseUrl || !supabaseKey) {
        return utils.createErrorResponse(500, 'Supabase environment variables missing.', headers);
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { filename, base64data, contentType } = body;

        if (!filename || !base64data || !contentType) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Date incomplete (filename, base64data, contentType sunt obligatorii).' })
            };
        }

        const normalizedMime = String(contentType).trim().toLowerCase();
        const allowedExts = ALLOWED_MIME_TYPES[normalizedMime];
        if (!allowedExts) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Tip de fișier nepermis. Sunt acceptate doar imagini JPG, PNG, WEBP și GIF.' })
            };
        }

        const rawExt = path.extname(filename || '').toLowerCase();
        const effectiveExt = allowedExts.includes(rawExt) ? rawExt : allowedExts[0];

        const buffer = Buffer.from(base64data, 'base64');
        if (buffer.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Fișierul încărcat este gol.' })
            };
        }

        if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Imaginea depășește limita maximă permisă de 5MB.' })
            };
        }

        if (!verifyImageSignature(buffer, normalizedMime)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Semnătura fișierului este invalidă (conținutul nu este o imagine validă de tipul declarat).' })
            };
        }

        const timestamp = Date.now();
        const rawBase = path.basename(filename, rawExt);
        const safeBase = rawBase.replace(/[^a-zA-Z0-9.\-_]/g, '').substring(0, 60) || 'image';
        const uniqueFileName = `${timestamp}-${safeBase}${effectiveExt}`;

        const uploadUrl = `${supabaseUrl}/storage/v1/object/images/${uniqueFileName}`;

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': normalizedMime
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
            body: JSON.stringify({ error: 'Eroare la încărcare.' })
        };
    }
};
