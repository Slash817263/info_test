exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
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
        const body = JSON.parse(event.body);
        const {
            student_name,
            student_email,
            test_type,
            score,
            total_points,
            time_taken_ms,
            blur_count,
            answers_json,
            details_json
        } = body;

        if (!student_name || score === undefined || total_points === undefined || time_taken_ms === undefined) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields in request body.' })
            };
        }

        const insertData = {
            student_name,
            score,
            total_points,
            time_taken_ms
        };

        // Optional fields
        if (student_email) insertData.student_email = student_email;
        if (test_type) insertData.test_type = test_type;
        if (blur_count !== undefined) insertData.blur_count = blur_count;
        if (answers_json) insertData.answers_json = answers_json;
        if (details_json) insertData.details_json = details_json;

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

        const data = await response.json();

        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ success: true, data })
        };
    } catch (error) {
        console.error('Error saving result:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};
