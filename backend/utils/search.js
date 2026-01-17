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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
        return [];
    }
}

module.exports = { searchWeb };
