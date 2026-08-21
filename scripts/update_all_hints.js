const fs = require('fs');

// Read .env
const env = {};
fs.readFileSync('.env', 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
});

const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables in .env');
    process.exit(1);
}

// Map of specific refined hints for questions that needed improvement
const updatedHintsMap = {
    // Basic & Fundamentals
    10: "Un număr este strict pozitiv dacă este mai mare decât zero (fără a include valoarea 0).",
    13: "Analizează dacă numărul de operații efectuate crește odată cu dimensiunea datelor de intrare n sau rămâne fix.",
    20: "Analizează relația dintre indicele de linie și cel de coloană pentru elementele situate pe diagonala principală a unei matrice.",
    27: "Variabilele de același tip structură suportă atribuirea directă, care copiază automat toate câmpurile interne.",
    29: "Gândește-te la cuvântul-cheie utilizat pentru a specifica absența unei valori returnate de către o funcție.",
    36: "Identifică relația de recurență a factorialului și condiția de oprire pentru valoarea de bază.",
    48: "Fiecare muchie conectează două noduri și contribuie cu 2 unități la suma totală a gradelor din graf.",
    50: "Amintește-ți relația fundamentală dintre numărul de noduri și numărul de muchii într-un arbore conex fără cicluri.",
    58: "Verifică relația dintre indicii de linie și coloană pentru elementele de pe diagonala secundară în funcție de tipul de indexare (de la 1 sau de la 0).",
    64: "Analizează relația dintre indicele de linie și cel de coloană pentru elementele situate pe diagonala principală a unei matrice.",
    76: "Un număr este strict pozitiv dacă este mai mare decât zero (fără a include valoarea 0).",
    98: "Un număr este strict pozitiv dacă este mai mare decât zero (fără a include valoarea 0).",
    136: "Un număr este strict pozitiv dacă este mai mare decât zero (fără a include valoarea 0).",
    142: "Variabilele de același tip structură suportă atribuirea directă, care copiază automat toate câmpurile interne.",
    144: "Un număr este strict pozitiv dacă este mai mare decât zero (fără a include valoarea 0).",
    147: "Un număr este strict pozitiv dacă este mai mare decât zero (fără a include valoarea 0).",
    171: "Un număr este strict pozitiv dacă este mai mare decât zero (fără a include valoarea 0).",
    175: "Variabilele de același tip structură suportă atribuirea directă, care copiază automat toate câmpurile interne.",
    184: "Analizează relația dintre indicele de linie și cel de coloană pentru elementele situate pe diagonala principală a unei matrice.",
    188: "Verifică relația dintre indicii de linie și coloană pentru elementele de pe diagonala secundară în funcție de tipul de indexare (de la 1 sau de la 0).",
    198: "Evaluează suma indicilor (i + j) pentru fiecare poziție din matrice și verifică pe rând ramurile if-else pentru a stabili caracterul atribuit.",
    201: "Analizează gradele fiecărui nod (numărul de conexiuni) și identifică componentele conexe formate din grupurile de noduri interconectate, respectiv nodurile izolate.",
    202: "Într-o matrice identitate, doar elementele de pe diagonala principală (unde i == j) au valoarea 1, restul fiind 0. Analizează ce paritate are suma i + i = 2*i.",
    203: "Ștergerea unui nod de grad k dintr-un arbore elimină cele k muchii incidente lui, separând arborele în subarbori independenți corespunzători fiecărui vecin.",
    204: "Recunoaște algoritmul clasic de sortare prin selecție (Selection Sort) și urmărește ordinea elementelor afișate pe măsură ce vectorul este sortat crescător.",

    // POLI Questions (Clean & strictly pedagogical)
    205: "Verifică apartenența la un interval închis fie prin dublă inegalitate, fie prin negarea situării în afara acestuia, combinată cu egalitățile pentru valorile discrete.",
    206: "Deplasarea spre dreapta a unui element aflat la indexul curent j cu un număr specificat de poziții presupune adunarea deplasamentului la indexul j.",
    207: "Funcția strchr găsește prima apariție a caracterului căutat, iar strlen pe pointerul returnat determină exact numărul de caractere adăugate prin strncat.",
    208: "Pentru a parcurge toate elementele unei linii fixe p, primul indice rămâne constant p, iar al doilea indice variază pe toate coloanele de la 1 la n.",
    209: "În matricea drumurilor, elementul a[i][j] este 1 dacă există o succesiune de arce orientate de la nodul i la nodul j. Identifică circuitele și componentele tare conexe.",
    210: "Într-un produs cartezian A_3 x A_2 x A_1, prima componentă a tuplului trebuie să provină din A_3, a doua din A_2, iar a treia din A_1.",
    211: "Analizează ce numără funcția recursivă prin testarea divizibilității lui a cu b și amintește-ți proprietatea numerelor prime privind numărul de divizori.",
    212: "Un vector de tați valid pentru un arbore are exact o rădăcină (valoarea 0), nu conține auto-bucle (tati[i] == i) și nu conține circuite.",
    213: "Urmărește cu atenție distincția dintre parametrul transmis prin referință (&x), care modifică argumentul primit, și cel transmis prin valoare (y), care păstrează o copie locală.",
    214: "Calculează numărul total de întregi din intervalul închis [a, b] și folosește faptul că două numere de parități diferite împart intervalul în mod egal între pare și impare.",
    215: "Pentru a menține minimul curent la parcurgerea tabloului, valoarea minimului se actualizează comparând minimul acumulat anterior cu elementul curent v[i].",
    216: "Atenție la modificarea lungimii șirului prin ștergere directă: când ștergi caracterul curent și incrementezi contorul i, caracterul deplasat pe poziția curentă este sărit.",
    217: "În limbajul C++, atribuirea directă este permisă exclusiv între două variabile de exact același tip structură, copiind automat toate câmpurile membre.",
    218: "Află numărul de posibilități de a alege unicul vecin al nodului specificat și înmulțește cu numărul total de grafuri neorientate ce se pot forma independent pe celelalte noduri.",
    219: "Aceasta este o definiție recursivă a funcției Ackermann. Evaluează apelurile imbricate pornind din interior spre exterior pe baza valorilor intermediare calculate."
};

async function run() {
    console.log('Fetching questions from Supabase...');
    const res = await fetch(`${supabaseUrl}/rest/v1/questions?select=id,category,subcategory,text,hint&order=id.asc`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    if (!res.ok) {
        throw new Error('Failed to fetch questions: ' + (await res.text()));
    }

    const questions = await res.json();
    console.log(`Fetched ${questions.length} questions from database.`);

    let updateCount = 0;

    for (const q of questions) {
        const newHint = updatedHintsMap[q.id];
        if (newHint && newHint !== q.hint) {
            console.log(`\nUpdating Q #${q.id} (${q.subcategory}):`);
            console.log(`  OLD: ${q.hint}`);
            console.log(`  NEW: ${newHint}`);

            const patchRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${q.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ hint: newHint })
            });

            if (!patchRes.ok) {
                console.error(`  ERROR updating Q #${q.id}: ${patchRes.status} - ${await patchRes.text()}`);
            } else {
                console.log(`  -> SUCCESS (200/204)`);
                updateCount++;
            }
        }
    }

    console.log(`\n========================================`);
    console.log(`Done! Updated ${updateCount} questions with refined hints.`);
    console.log(`========================================\n`);
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
