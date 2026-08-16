exports.handler = async function(event, context) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigins = ['http://localhost:8888', 'http://127.0.0.1:8888', 'https://acadeinformatica.netlify.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://acadeinformatica.netlify.app';

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase env missing' }) };
    }

    // Verify JWT
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token lipsa' }) };
    }
    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.SUPABASE_KEY);
    } catch(e) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token invalid sau expirat' }) };
    }

    try {
        const body = JSON.parse(event.body);
        const { assigned_test_id, student_username, answers_json, time_taken_ms, current_index } = body;

        if (!assigned_test_id || !student_username) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields.' }) };
        }

        if (decoded.username !== student_username) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden: Username mismatch' }) };
        }

        // We will store this in results table as a special type
        // First delete any previous progress for this test to avoid bloat
        const deleteUrl = `${supabaseUrl}/rest/v1/results?student_username=eq.${encodeURIComponent(student_username)}&test_type=eq.progress_${assigned_test_id}`;
        await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        // Insert new progress
        const insertData = {
            student_name: student_username,
            student_username: student_username,
            score: current_index || 0, // Using score to store current_index
            total_points: 0,
            time_taken_ms: time_taken_ms || 0,
            test_type: `progress_${assigned_test_id}`,
            blur_count: 0,
            answers_json: answers_json || [],
            details_json: []
        };

        const response = await fetch(`${supabaseUrl}/rest/v1/results`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(insertData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Supabase insert failed: ${response.status} - ${errorText}`);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('Error saving progress:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
