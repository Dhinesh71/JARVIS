const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Performs a free web search using DuckDuckGo HTML version.
 * @param {string} query The search query.
 * @returns {Promise<Array>} Array of result objects {title, snippet, url}.
 */
async function searchWeb(query) {
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const $ = cheerio.load(data);
        const results = [];

        $('.result').each((i, el) => {
            if (i >= 3) return false; // Limit to 3 results as requested

            const title = $(el).find('.result__a').text().trim();
            const snippet = $(el).find('.result__snippet').text().trim();
            const link = $(el).find('.result__a').attr('href');

            if (title && snippet && link) {
                // DuckDuckGo direct links are often redirected, but html version usually gives clean ones or relative ones
                let finalUrl = link;
                if (link.startsWith('//')) finalUrl = 'https:' + link;

                results.push({ title, snippet, url: finalUrl });
            }
        });

        return results;
    } catch (error) {
        console.error('Web search failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', JSON.stringify(error.response.headers));
            // console.error('Data:', error.response.data); // Too verbose to enable by default
        }
        return [];
    }
}

module.exports = { searchWeb };
