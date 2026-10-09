const fs = require('fs');
const utils = require('../netlify/functions/_utils.js');

async function insertWaitingQuestions() {
    const supabaseUrl = utils.getLiveEnv('SUPABASE_URL');
    const supabaseKey = utils.getLiveEnv('SUPABASE_SERVICE_KEY') || utils.getLiveEnv('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase environment variables are missing.');
    }
    
    // Using simple fetch to Post to Supabase REST API
    const questions = JSON.parse(fs.readFileSync('cleaned_questions.json', 'utf8'));
    const answers = JSON.parse(fs.readFileSync('parsed_answers.json', 'utf8'));

    const itemsToInsert = [];
    
    for (let q of questions) {
        const ans = answers.find(a => a.varianta === q.varianta && a.numar === q.numar);
        if (!ans) continue;
        
        let text = q.text.trim();
        let code = q.code ? q.code.trim() : null;
        let hint = ans.hint ? ans.hint.trim() : "Analizează cu atenție cerința problemei și alege varianta corectă.";
        
        let examType = 'Poli';
        let type = q.code ? 'code' : 'choice'; 
        if (code && code.split('\n').length > 1) {
            type = 'code';
        }
        
        itemsToInsert.push({
            difficulty: q.difficulty,
            type: type,
            category: q.category,
            subcategory: q.subcategory,
            exam_type: examType,
            text: text,
            image_url: null,
            code: code,
            options_json: q.options,
            correct_index: ans.correct_index,
            hint: hint
        });
    }

    console.log(`Preparing to insert ${itemsToInsert.length} questions to waiting_questions...`);
    
    // Batch inserts
    const batchSize = 50;
    for (let i = 0; i < itemsToInsert.length; i += batchSize) {
        const batch = itemsToInsert.slice(i, i + batchSize);
        
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/waiting_questions`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(batch)
            });
            
            if (!response.ok) {
                const error = await response.text();
                console.error(`Error inserting batch ${i / batchSize}: ${error}`);
            } else {
                console.log(`Inserted batch ${i / batchSize + 1} successfully.`);
            }
        } catch (err) {
            console.error(`Fetch error on batch ${i / batchSize}:`, err);
        }
    }
    
    console.log('Finished insertions.');
}

insertWaitingQuestions().catch(console.error);
