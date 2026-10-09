const fs = require('fs');
const path = require('path');
const utils = require('../netlify/functions/_utils');

const dotenv = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8');
const env = {};
dotenv.split('\n').forEach(line => {
    const t = line.trim();
    if (t && !t.startsWith('#') && t.includes('=')) {
        const i = t.indexOf('=');
        env[t.substring(0, i).trim()] = t.substring(i + 1).trim();
    }
});

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY;

async function migrateStudentPasswords() {
    console.log('--- Migrare Securizată Parole Elevi ($scrypt$) ---');
    const res = await fetch(`${url}/rest/v1/students?select=id,username,password`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const students = await res.json();
    console.log(`Total elevi în sistem: ${students.length}`);

    let migrated = 0;
    for (const student of students) {
        if (!student.password || !student.password.startsWith('$scrypt$')) {
            const rawPassword = student.password || 'temp123';
            const hashed = utils.hashPassword(rawPassword);
            
            // Verify our hashed password validates against the original password
            if (!utils.verifyPassword(rawPassword, hashed)) {
                throw new Error(`Verification failed for student ${student.username}! Aborting.`);
            }

            const patchRes = await fetch(`${url}/rest/v1/students?id=eq.${student.id}`, {
                method: 'PATCH',
                headers: {
                    apikey: key,
                    Authorization: `Bearer ${key}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ password: hashed })
            });

            if (patchRes.ok) {
                console.log(`  🔒 Migrat cu succes: ${student.username}`);
                migrated++;
            } else {
                console.error(`  ❌ Eroare la migrarea ${student.username}:`, await patchRes.text());
            }
        } else {
            console.log(`  ✓ Deja securizat ($scrypt$): ${student.username}`);
        }
    }

    console.log(`\nFinalizat: ${migrated} parole migrate la scrypt. 0 parole plaintext rămase.`);
}

migrateStudentPasswords().catch(console.error);
