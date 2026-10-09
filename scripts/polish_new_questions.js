const fs = require('fs');
const utils = require('../netlify/functions/_utils.js');

async function polishNewQuestions() {
    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL');
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY') || utils.getLiveEnv('SUPABASE_KEY');

    // Fetch questions with id >= 1464 (the new 135 ones)
    const res = await fetch(`${supabaseUrl}/rest/v1/waiting_questions?id=gte.1464&select=*&order=id.asc`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const qs = await res.json();
    console.log(`Polishing ${qs.length} newly inserted questions...`);

    for (let q of qs) {
        let changed = false;

        // Clean text
        let t = q.text;
        t = t.replace(/\(pentru\s*\/C\+\+\s*\)\/true\s*\(pentru\s*\)/gi, '(pentru limbajul C++)')
             .replace(/\(pentru limbajul C\/C\+\+\s*\)\/true\s*\(pentru limbajul Pascal\s*\)/gi, '(pentru limbajul C++)')
             .replace(/va\s+riabile/gi, 'variabile')
             .replace(/va\s+loare/gi, 'valoare')
             .replace(/calcula\s+t\b/gi, 'calculat')
             .replace(/def\s+init/gi, 'definit')
             .replace(/subprogramului\s+f\s+definit/gi, 'subprogramului f definit')
             .replace(/i\s*--/g, 'i--')
             .replace(/j\s*--/g, 'j--')
             .replace(/i\s*\+\+/g, 'i++')
             .replace(/j\s*\+\+/g, 'j++');

        if (t !== q.text) {
            q.text = t;
            changed = true;
        }

        // Clean options
        let opts = (q.options_json || []).map(o => {
            if (typeof o !== 'string') return o;
            let opt = o.replace(/calcula\s+t\b/gi, 'calculat')
                       .replace(/n2\b/g, 'n²')
                       .replace(/i\s*--/g, 'i--')
                       .replace(/j\s*--/g, 'j--')
                       .replace(/i\s*\+\+/g, 'i++')
                       .replace(/j\s*\+\+/g, 'j++')
                       .trim();
            return opt;
        });

        if (JSON.stringify(opts) !== JSON.stringify(q.options_json)) {
            q.options_json = opts;
            changed = true;
        }

        // Clean code
        if (q.code) {
            let c = q.code.replace(/i\s*--/g, 'i--')
                          .replace(/j\s*--/g, 'j--')
                          .replace(/i\s*\+\+/g, 'i++')
                          .replace(/j\s*\+\+/g, 'j++');
            if (c !== q.code) {
                q.code = c;
                changed = true;
            }
        }

        if (changed) {
            await fetch(`${supabaseUrl}/rest/v1/waiting_questions?id=eq.${q.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    text: q.text,
                    options_json: q.options_json,
                    code: q.code
                })
            });
        }
    }

    console.log('Polishing complete!');
}

polishNewQuestions().catch(console.error);
