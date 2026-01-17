const axios = require('axios');
const fs = require('fs');

async function fetch() {
    try {
        const url = 'https://html.duckduckgo.com/html/?q=SpaceX';
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        fs.writeFileSync('ddg_result.html', data);
        console.log('Saved ddg_result.html');
    } catch (e) {
        console.error('Fetch failed:', e.message);
    }
}

fetch();
