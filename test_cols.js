const fs = require('fs');

async function check() {
    const env = fs.readFileSync('.env', 'utf8');
    let url = '';
    let key = '';
    env.split('\n').forEach(line => {
        if(line.startsWith('SUPABASE_URL=')) url = line.split('=')[1].trim();
        if(line.startsWith('SUPABASE_SERVICE_KEY=')) key = line.split('=')[1].trim();
    });
    
    console.log("Fetching from: ", url);
    const res = await fetch(url + '/rest/v1/', {
        headers: {
            'apikey': key,
            'Authorization': 'Bearer ' + key
        }
    });
    const data = await res.json();
    console.log(Object.keys(data.paths).filter(p => p.startsWith('/rpc/')));
}
check();
