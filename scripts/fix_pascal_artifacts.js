const fs = require('fs');
const path = require('path');

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

async function patchPascalQuestions() {
    const updates = [
        {
            id: 2166,
            text: 'În subprogramul recursiv următor se consideră că $v$ este un vector declarat global, format din numere întregi. Pentru care dintre vectorii $v$ următori, expresia C/C++ ddd(0, 18) returnează valoarea 10?'
        },
        {
            id: 2167,
            text: 'Pentru un vector $x$ declarat global, vector cu 10 componente întregi, stabiliți care sunt valorile memorate de componentele tabloului $x$ în urma apelului C/C++ ex(0, 9).'
        },
        {
            id: 2168,
            text: 'Care este rezultatul afișat la apelul C++ f("examenul", 0)?'
        }
    ];

    for (const u of updates) {
        const res = await fetch(`${url}/rest/v1/questions?id=eq.${u.id}`, {
            method: 'PATCH',
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ text: u.text })
        });
        console.log(`Patched question ${u.id}: HTTP ${res.status}`);
    }

    // Verify 0 pascal mentions
    const checkRes = await fetch(`${url}/rest/v1/questions?or=(text.ilike.*pascal*,code.ilike.*pascal*)&select=id`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const checkData = await checkRes.json();
    console.log(`Remaining Pascal questions: ${checkData.length}`);
}

patchPascalQuestions().catch(console.error);
