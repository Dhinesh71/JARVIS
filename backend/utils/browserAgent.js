const puppeteer = require('puppeteer');
const axios = require('axios');

/**
 * JARVIS Browser Agent
 * This utility handles automated web interactions like filling forms and solving quizzes.
 */

async function solveQuiz(url, userDetails) {
    console.log(`[JARVIS Browser Agent] Navigating to: ${url}`);
    
    const browser = await puppeteer.launch({
        headless: false, // Set to false to see the agent working
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        
        // 1. Fill User Details
        console.log("[JARVIS Browser Agent] Attempting to fill user details...");
        await fillFormFields(page, userDetails);

        // 2. Solve Questions (Loop through pages)
        let quizFinished = false;
        while (!quizFinished) {
            console.log("[JARVIS Browser Agent] Detecting questions...");
            
            // Wait a bit for any animations
            await new Promise(r => setTimeout(r, 2000));

            const questionData = await extractQuestionAndOptions(page);
            
            if (questionData && questionData.question) {
                console.log(`[JARVIS Browser Agent] Solving: ${questionData.question.substring(0, 50)}...`);
                
                const answer = await getAIAnswer(questionData.question, questionData.options);
                console.log(`[JARVIS Browser Agent] Selected Answer: ${answer}`);

                await clickAnswer(page, answer, questionData.options);
                
                // Look for "Next" or "Submit"
                const buttonClicked = await clickNextOrSubmit(page);
                if (!buttonClicked) {
                    console.log("[JARVIS Browser Agent] No Next button found. Quiz might be done or single-page.");
                    quizFinished = true;
                }
            } else {
                console.log("[JARVIS Browser Agent] No question detected. Checking for Submit button...");
                const submitted = await clickNextOrSubmit(page);
                if (!submitted) quizFinished = true;
            }

            // Check if we are at a "Thank you" or "Result" page
            const pageText = await page.evaluate(() => document.body.innerText);
            if (pageText.toLowerCase().includes('thank you') || pageText.toLowerCase().includes('submitted') || pageText.toLowerCase().includes('score')) {
                console.log("[JARVIS Browser Agent] Quiz completion page detected.");
                quizFinished = true;
            }
        }

        return { success: true, message: "Quiz solved successfully." };

    } catch (error) {
        console.error('[JARVIS Browser Agent] Error:', error.message);
        return { success: false, error: error.message };
    } finally {
        // Keep browser open for a few seconds for visibility
        await new Promise(r => setTimeout(r, 5000));
        await browser.close();
    }
}

async function fillFormFields(page, details) {
    const fields = await page.$$('input, textarea');
    
    for (const field of fields) {
        const name = (await page.evaluate(el => el.getAttribute('name') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '', field)).toLowerCase();
        
        if (name.includes('name') && details.name) await field.type(details.name, { delay: 50 });
        else if ((name.includes('email') || name.includes('mail')) && details.email) await field.type(details.email, { delay: 50 });
        else if ((name.includes('phone') || name.includes('mobile') || name.includes('contact')) && details.phone) await field.type(details.phone, { delay: 50 });
        else if ((name.includes('reg') || name.includes('roll') || name.includes('number')) && details.regNo) await field.type(details.regNo, { delay: 50 });
    }
}

async function extractQuestionAndOptions(page) {
    return await page.evaluate(() => {
        // Common quiz structures (Google Forms, MS Forms, Generic)
        const selectors = [
            '.geS5Jd', // Google Forms question container
            '.office-form-question', // MS Forms
            '.question-container',
            'div[role="listitem"]'
        ];

        let container = null;
        for (const sel of selectors) {
            container = document.querySelector(sel);
            if (container) break;
        }

        if (!container) return null;

        const questionText = container.innerText.split('\n')[0];
        const options = Array.from(container.querySelectorAll('label, .appsMaterialWizTogglePapercheckboxLabel, .office-form-question-choice'))
            .map(el => el.innerText.trim())
            .filter(t => t.length > 0);

        return { question: questionText, options };
    });
}

async function getAIAnswer(question, options) {
    try {
        const prompt = `
        Solve this quiz question.
        Question: ${question}
        Options: ${options.join(', ')}
        
        Return ONLY the exact text of the correct option. No explanation.
        `;

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content.trim();
    } catch (e) {
        console.error("AI Solver failed:", e.message);
        return options[0]; // Fallback to first option
    }
}

async function clickAnswer(page, answerText, options) {
    const labels = await page.$$('label, span, div[role="radio"], div[role="checkbox"]');
    for (const label of labels) {
        const text = await page.evaluate(el => el.innerText.trim(), label);
        if (text.toLowerCase() === answerText.toLowerCase() || answerText.toLowerCase().includes(text.toLowerCase())) {
            await label.click();
            return;
        }
    }
}

async function clickNextOrSubmit(page) {
    const buttons = await page.$$('span, div, button');
    for (const btn of buttons) {
        const text = await page.evaluate(el => el.innerText.toLowerCase(), btn);
        if (text === 'next' || text === 'submit' || text === 'forward' || text === 'finish') {
            await btn.click();
            return true;
        }
    }
    return false;
}

module.exports = { solveQuiz };
