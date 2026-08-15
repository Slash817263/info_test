exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': 'https://acadeinformatica.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type',
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
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing Supabase vars' }) };
    }

    try {
        const body = JSON.parse(event.body);
        const { username, password } = body;

        if (!username || !password) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Username și parola sunt obligatorii' }) };
        }

        const res = await fetch(`${supabaseUrl}/rest/v1/students?username=eq.${encodeURIComponent(username)}&select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!res.ok) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Eroare la baza de date' }) };
        }

        const data = await res.json();

        if (data.length === 0) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Utilizator negăsit' }) };
        }

        const student = data[0];
        const bcrypt = require('bcryptjs');

        let isPasswordValid = false;
        let needsMigration = false;

        // Check if the stored password is a bcrypt hash (starts with $2)
        if (student.password.startsWith('$2')) {
            isPasswordValid = bcrypt.compareSync(password, student.password);
        } else {
            // It's a plain text password (needs migration)
            if (student.password === password) {
                isPasswordValid = true;
                needsMigration = true;
            }
        }

        if (!isPasswordValid) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Parolă incorectă' }) };
        }

        // Automatic migration in the background
        if (needsMigration) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            fetch(`${supabaseUrl}/rest/v1/students?id=eq.${student.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password: hashedPassword })
            }).catch(err => console.error('Eroare la migrarea parolei:', err));
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Autentificare cu succes',
                student: {
                    id: student.id,
                    username: student.username,
                    phone_number: student.phone_number
                }
            })
        };

    } catch (e) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Eroare internă de server' })
        };
    }
};
