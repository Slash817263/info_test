exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Supabase environment variables are missing.' })
        };
    }

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/questions?select=*&order=id.asc`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Supabase request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Map database fields to the exact shape the frontend expects
        const mappedQuestions = data.map(q => {
            let options = q.options_json;
            if (typeof options === 'string') {
                options = JSON.parse(options);
            }
            return {
                id: q.id,
                difficulty: q.difficulty,
                type: q.type,
                category: q.category || null,
                subcategory: q.subcategory || null,
                text: q.text,
                code: q.code,
                options: options,
                correct: q.correct_index,
                explanation: q.explanation
            };
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(mappedQuestions)
        };
    } catch (error) {
        console.error('Error fetching questions:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};
