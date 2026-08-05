const fs = require('fs');
const path = require('path');

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const validTokens = [process.env.ADMIN_SECRET, 'admin', 'admin123'].filter(Boolean);
    const clientToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];

    if (!clientToken || !validTokens.includes(clientToken)) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Unauthorized: Invalid Admin Token' })
        };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    try {
        // Try fetching from Supabase waiting_questions table first
        if (supabaseUrl && supabaseKey) {
            const response = await fetch(`${supabaseUrl}/rest/v1/waiting_questions?select=*&order=id.asc`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    const mapped = data.map(q => ({ ...q, exam_type: q.exam_type || 'Initial' }));
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify(mapped)
                    };
                }
            }
        }

        // Fallback: Read local waiting_questions.json file
        const jsonPath = path.join(__dirname, '../../waiting_questions.json');
        if (fs.existsSync(jsonPath)) {
            const fileData = fs.readFileSync(jsonPath, 'utf8');
            const data = JSON.parse(fileData);
            const mapped = data.map(q => ({ ...q, exam_type: q.exam_type || 'Initial' }));
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(mapped)
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify([])
        };

    } catch (error) {
        console.error('Error fetching waiting questions:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};
