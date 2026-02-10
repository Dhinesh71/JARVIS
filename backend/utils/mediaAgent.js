
const puppeteer = require('puppeteer');

// Helper for waiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Automates Brave to play a song on YouTube.
 * Workflow: Open Brave -> Go to YouTube -> Search Song -> Play Song
 * @param {string} songName - Name of the song to play
 */
async function playMusicOnYoutube(songName) {
    console.log(`[MEDIA AGENT] Starting workflow for: ${songName}`);

    // Path to Brave Browser
    const bravePath = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";

    const browser = await puppeteer.launch({
        executablePath: bravePath,
        headless: false,
        defaultViewport: null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--start-maximized',
            '--disable-notifications',
            '--disable-extensions'
        ]
    });

    try {
        const page = await browser.newPage();

        // 1. Open YouTube
        console.log("[MEDIA AGENT] Step 1: Opening YouTube...");
        await page.goto('https://www.youtube.com', { waitUntil: 'load', timeout: 90000 });

        // Wait a bit for JS to execute
        await delay(5000);

        // 2. Search for the song
        console.log(`[MEDIA AGENT] Step 2: Searching for "${songName}"...`);

        // Try multiple selectors for the search box
        const searchInputSelector = 'input[name="search_query"], input#search, input.ytd-searchbox';

        try {
            await page.waitForSelector(searchInputSelector, { visible: true, timeout: 15000 });
            await page.click(searchInputSelector);
        } catch (e) {
            console.log("[MEDIA AGENT] Standard selector failed, trying fallback focus...");
            await page.keyboard.press('/'); // YouTube shortcut to focus search
            await delay(1000);
        }

        // Type the song name
        await page.keyboard.type(songName, { delay: 100 });
        await delay(500);
        await page.keyboard.press('Enter');

        // 3. Play the song
        console.log("[MEDIA AGENT] Step 3: Waiting for search results to play...");

        // Wait for video links
        const videoLinkSelector = 'a#video-title, #video-title-link, a.ytd-video-renderer';
        await page.waitForSelector(videoLinkSelector, { visible: true, timeout: 30000 });

        // Click the first video result
        console.log("[MEDIA AGENT] Clicking the first video result...");
        const firstVideo = await page.$(videoLinkSelector);
        if (firstVideo) {
            await firstVideo.click();
        } else {
            throw new Error("No video results found.");
        }

        console.log(`[MEDIA AGENT] Workflow Complete: Playing ${songName}`);

        // Extra delay to ensure video starts
        await delay(5000);

    } catch (error) {
        const currentUrl = page ? await page.url() : 'unknown';
        console.error(`[MEDIA AGENT ERROR] At URL: ${currentUrl} - ${error.message}`);
        // On error, we close to cleanup
        try { await browser.close(); } catch (e) { }
    }
}

module.exports = { playMusicOnYoutube };
