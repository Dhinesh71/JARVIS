
const puppeteer = require('puppeteer');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Helper for waiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function solveQuiz(url, userDetails) {
    console.log(`[JARVIS] Starting quiz at: ${url}`);

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
    });

    const page = await browser.newPage();

    // 1. Clear State
    try {
        const client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');
    } catch (e) { console.log("Clear cookies failed:", e.message); }

    // 2. Bypass Security
    await page.evaluateOnNewDocument(() => {
        const noop = () => Promise.resolve();
        Element.prototype.requestFullscreen = noop;
        Element.prototype.webkitRequestFullscreen = noop;
        Element.prototype.mozRequestFullScreen = noop;
        Element.prototype.msRequestFullscreen = noop;
        Object.defineProperty(document, 'fullscreenEnabled', { get: () => false });
        Object.defineProperty(document, 'webkitFullscreenEnabled', { get: () => false });
    });

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // 3. Fill Details
        console.log("[JARVIS] Filling user details...");
        await delay(4000);
        await fillFormFields(page, userDetails);

        // 4. Main Loop - Sequential Processing
        let finished = false;
        let iteration = 0;
        const MAX_ITERATIONS = 200;
        let noQuestionCount = 0;

        while (!finished && iteration < MAX_ITERATIONS) {
            iteration++;
            // A. Check for Completion
            if (await checkCompletion(page)) {
                console.log("[COMPLETE] Completion keywords found!");
                finished = true;
                break;
            }

            // B. Find Visible Question (Assigns ID)
            const questionData = await findNextQuestion(page);

            if (questionData) {
                noQuestionCount = 0;
                console.log(`\n[QUESTION FOUND] [ID:${questionData.id}] "${questionData.question.substring(0, 40)}..."`);

                // Scroll to it
                await page.evaluate((id) => {
                    const el = document.querySelector(`[data-jarvis-id="${id}"]`);
                    if (el) el.scrollIntoView({ behavior: 'auto', block: 'center' });
                }, questionData.id);

                // C. Solve It
                const answerObj = await getAIAnswer(questionData.question, questionData.options);
                console.log(`[AI ANSWER] Index: ${answerObj.index}, Text: "${answerObj.text}"`);

                // Click Answer - SCOPED to the container ID, with Index Backup
                const clicked = await clickAnswer(page, questionData.id, answerObj.text, answerObj.index);

                // VERIFY if it was actually selected
                const isActuallySelected = await page.evaluate((id) => {
                    const container = document.querySelector(`[data-jarvis-id="${id}"]`);
                    if (!container) return false;
                    const checked = container.querySelector('input:checked');
                    return !!checked;
                }, questionData.id);

                if (clicked && isActuallySelected) {
                    console.log("[ACTION] Answer Clicked & Verified.");
                    // Mark done
                    await page.evaluate((id) => {
                        const el = document.querySelector(`[data-jarvis-id="${id}"]`);
                        if (el) el.setAttribute('data-jarvis-done', 'true');
                    }, questionData.id);

                    await delay(500);
                } else {
                    console.log("[WARNING] Click reported success but verification failed. Retrying force click...");

                    // Force click using INDEX if available
                    if (answerObj.index) {
                        await page.evaluate(({ id, idx }) => {
                            const container = document.querySelector(`[data-jarvis-id="${id}"]`);
                            if (container) {
                                const inputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
                                if (inputs[idx - 1]) inputs[idx - 1].click();
                            }
                        }, { id: questionData.id, idx: answerObj.index });
                    } else {
                        // Original Fallback
                        await page.evaluate((id) => {
                            const container = document.querySelector(`[data-jarvis-id="${id}"]`);
                            if (container) {
                                const firstInput = container.querySelector('input');
                                if (firstInput) firstInput.click();
                            }
                        }, questionData.id);
                    }

                    // Re-verify
                    const retrySelected = await page.evaluate((id) => {
                        const container = document.querySelector(`[data-jarvis-id="${id}"]`);
                        return !!(container && container.querySelector('input:checked'));
                    }, questionData.id);

                    if (retrySelected) {
                        console.log("[ACTION] Force Click Successful.");
                        await page.evaluate((id) => {
                            const el = document.querySelector(`[data-jarvis-id="${id}"]`);
                            if (el) el.setAttribute('data-jarvis-done', 'true');
                        }, questionData.id);
                    } else {
                        console.log("[ERROR] Could not select answer even after force retry. Skipping to avoid loop.");
                        await page.evaluate((id) => {
                            const el = document.querySelector(`[data-jarvis-id="${id}"]`);
                            if (el) el.setAttribute('data-jarvis-done', 'true');
                        }, questionData.id);
                    }
                }

            } else {
                noQuestionCount++;

                // CRITICAL FIX: Handle Validation Errors (Skipped Questions)
                // If the page scrolled to an error or we see :invalid inputs
                const validationFix = await page.evaluate(() => {
                    const invalidInput = document.querySelector('input:invalid, .error input, input[aria-invalid="true"]');
                    if (invalidInput) {
                        invalidInput.scrollIntoView({ behavior: 'auto', block: 'center' });

                        // Find the container for this input
                        let container = invalidInput.parentElement;
                        // Go up until we find a block
                        for (let i = 0; i < 3; i++) {
                            if (container.tagName === 'DIV' || container.tagName === 'SECTION') break;
                            container = container.parentElement;
                        }

                        // Click ANY valid option in this container (Fallback)
                        const options = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
                        if (options.length > 0) {
                            options[0].click();
                            return true;
                        }
                    }
                    return false;
                });

                if (validationFix) {
                    console.log("[EMERGENCY] Found ignored question (validation error). Fixed it by clicking first option.");
                    await delay(1000);
                    noQuestionCount = 0; // Reset counter
                    continue; // Loop again to see if there are more or to submit
                }

                if (noQuestionCount > 2) {
                    console.log("[INFO] No unanswered questions in view...");
                }

                // D. Try Navigation (Next/Submit)
                const navClicked = await clickNextOrSubmit(page);
                if (navClicked) {
                    await delay(4000); // Wait for page load
                    noQuestionCount = 0;
                } else {
                    await delay(1000);
                }
            }
        }

        console.log(`[JARVIS] Session ended.`);
        return { success: true, message: "Quiz completed." };

    } catch (error) {
        console.error('[JARVIS ERROR]', error.message);
        return { success: false, error: error.message };
    } finally {
        // Keep open for a bit
        await delay(5000);
        await browser.close();
    }
}

// --- Helper Functions ---

async function findNextQuestion(page) {
    return await page.evaluate(() => {
        // Look for containers that have radio/checkbox inputs
        // We prefer 'question' class, but fallback to generic blocks
        const allContainers = Array.from(document.querySelectorAll('div, section, article, .question, [role="listitem"]'));

        for (const container of allContainers) {
            // 1. Skip if already processed
            if (container.getAttribute('data-jarvis-done') === 'true') continue;

            // 2. Must have inputs
            const inputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
            if (inputs.length < 2) continue;

            // 3. Determine if this container is "atomic" (mostly for nested divs)
            // Heuristic: If this container has a sub-container with inputs, skip this one.
            const hasSubWrapper = Array.from(container.children).some(child =>
                child.querySelectorAll('input[type="radio"], input[type="checkbox"]').length >= 2
            );
            if (hasSubWrapper) continue; // Let the loop find the child later

            // 4. Extract Question Text
            let qText = "";
            // Priority: Headers, paragraphs
            const textEls = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, p, span.title, strong, legend'));
            for (const el of textEls) {
                const t = el.innerText.trim();
                // Avoid "Option 1" style text
                if (t.length > 5 && t.length < 500 && !t.toLowerCase().startsWith('option')) {
                    qText = t;
                    // Prefer ones with '?'
                    if (t.includes('?')) break;
                }
            }
            // Fallback to raw text if reasonable
            if (!qText) {
                const lines = container.innerText.split('\n').filter(l => l.trim().length > 5);
                if (lines.length > 0) qText = lines[0];
            }

            if (!qText || qText.length < 3) continue;

            // 5. Extract Options
            const labels = Array.from(container.querySelectorAll('label'));
            let options = labels.map(l => l.innerText.trim()).filter(t => t && t !== qText);

            // Fallback if no labels (weird HTML)
            if (options.length < 2) {
                inputs.forEach(inp => {
                    // Check next sibling
                    if (inp.nextSibling && inp.nextSibling.textContent) {
                        options.push(inp.nextSibling.textContent.trim());
                    } else if (inp.parentElement) {
                        options.push(inp.parentElement.innerText.trim());
                    }
                });
                options = options.filter(o => o && o !== qText);
                options = [...new Set(options)];
            }

            if (options.length >= 2) {
                // Generate and assign ID
                const id = 'chk_' + Math.random().toString(36).substr(2, 9);
                container.setAttribute('data-jarvis-id', id);

                return {
                    question: qText,
                    options: options.slice(0, 10),
                    id: id
                };
            }
        }
        return null;
    });
}

async function checkCompletion(page) {
    return await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        const h1s = Array.from(document.querySelectorAll('h1, h2')).map(h => h.innerText.toLowerCase());
        if (h1s.some(t => t.includes('thank you') || t.includes('submitted'))) return true;

        return false;
    });
}

async function clickAnswer(page, containerId, answerText, answerIndex) {
    return await page.evaluate(({ id, text, idx }) => {
        const container = document.querySelector(`[data-jarvis-id="${id}"]`);
        if (!container) return false;

        const lower = text.toLowerCase().trim();

        // Strategy 1: Find valid text element INSIDE container
        const candidates = Array.from(container.querySelectorAll('label, div, span, p, b, strong, li'));

        // A. Exact Match
        let match = candidates.find(el => {
            const t = el.innerText.trim().toLowerCase();
            return t === lower;
        });

        // B. Contains Match (if exact fails)
        if (!match) {
            match = candidates.find(el => {
                const t = el.innerText.trim().toLowerCase();
                return t && (t.includes(lower) || lower.includes(t));
            });
        }

        if (match) {
            match.scrollIntoView({ block: 'center' });
            match.click();

            // Ensure input is checked
            const input = container.querySelector(`input[value="${match.innerText}"]`) ||
                match.querySelector('input') ||
                (match.previousElementSibling && match.previousElementSibling.tagName === 'INPUT' ? match.previousElementSibling : null);

            if (input) input.click();
            return true;
        }

        // FALLBACK 1: Use Index if available
        if (idx) {
            const inputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
            if (inputs[idx - 1]) {
                inputs[idx - 1].scrollIntoView({ behavior: 'auto', block: 'center' });
                inputs[idx - 1].click();
                return true;
            }
        }

        // FALLBACK 2: Click the FIRST option.
        const firstInput = container.querySelector('input[type="radio"], input[type="checkbox"]');
        if (firstInput) {
            firstInput.click();
            return true;
        }

        return false;
    }, { id: containerId, text: answerText, idx: answerIndex });
}

async function clickNextOrSubmit(page) {
    return await page.evaluate(() => {
        // Prioritize "Submit" if we are deep in the process
        const submitKeywords = ['submit', 'finish', 'complete', 'end quiz'];
        const navKeywords = ['next', 'cntinue', 'continue', 'proceed', 'start'];

        const allBtns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"], a, div.btn, span[role="button"]'));

        // 1. Try explicit Submit first
        let target = allBtns.find(btn => {
            const t = (btn.innerText || btn.value || '').toLowerCase();
            return submitKeywords.some(k => t.includes(k)) && btn.offsetParent !== null;
        });

        // 2. If no submit, try Next
        if (!target) {
            target = allBtns.find(btn => {
                const t = (btn.innerText || btn.value || '').toLowerCase();
                return navKeywords.some(k => t.includes(k)) && btn.offsetParent !== null;
            });
        }

        if (target) {
            target.scrollIntoView({ block: 'center' });
            target.click();
            return true;
        }
        return false;
    });
}

async function fillFormFields(page, details) {
    const fields = await page.$$('input, textarea');
    for (const field of fields) {
        try {
            const info = await page.evaluate(el => ({
                name: (el.name || '').toLowerCase(),
                placeholder: (el.placeholder || '').toLowerCase(),
                type: (el.type || '').toLowerCase()
            }), field);

            if (['radio', 'checkbox', 'hidden', 'submit', 'button'].includes(info.type)) continue;

            const key = (info.name + " " + info.placeholder);
            let val = "";
            if (key.includes('name')) val = details.name;
            else if (key.includes('email')) val = details.email;
            else if (key.includes('phone')) val = details.phone;
            else if (key.includes('reg') || key.includes('roll')) val = details.regNo;

            if (val) {
                await field.click({ clickCount: 3 });
                await field.type(val, { delay: 50 });
            }
        } catch (e) { }
    }
}

async function getAIAnswer(question, options) {
    // Robust Fallback Strategy: Gemini Pro -> Gemini Flash -> Groq Llama
    if (!question) return { text: options[0], index: 1 };

    const prompt = `
You are a World-Class Expert Professor in IoT (Internet of Things), Embedded Systems, Computer Science, and Engineering.
You are taking a high-stakes exam where accuracy is paramount.

Question: "${question}"

Options:
${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

INSTRUCTIONS:
1. Analyze the question carefully for keywords (e.g., "NOT", "ALWAYS", "protocol").
2. Evaluate EACH option one by one with a critical eye.
3. Select the DEFINITIVELY correct answer.
4. If the options include "All of the above" or "None of the above", prioritize that if it fits.
5. Provide a short, precise reasoning.

OUTPUT FORMAT (Strict JSON-like block):
REASONING: [Your detailed step-by-step verification]
ANSWER_INDEX: [Only the number 1, 2, 3, or 4]
ANSWER_TEXT: [The exact text of the correct option]
`;

    // Helper to clean response
    const parseResponse = (text) => {
        let result = { text: null, index: null, reasoning: null };

        // Extract Reasoning
        const reasonMatch = text.match(/REASONING:\s*([\s\S]*?)(?=ANSWER_INDEX:|ANSWER_TEXT:|$)/i);
        if (reasonMatch) result.reasoning = reasonMatch[1].trim();

        // Extract Index
        const idxMatch = text.match(/ANSWER_INDEX:\s*(\d+)/i);
        if (idxMatch && idxMatch[1]) result.index = parseInt(idxMatch[1], 10);

        // Extract Text
        const txtMatch = text.match(/ANSWER_TEXT:\s*(.*)/i);
        if (txtMatch && txtMatch[1]) {
            let answer = txtMatch[1].trim();
            answer = answer.replace(/^Option \d+[:.]\s*/i, '').replace(/^\d+[:.]\s*/, '').replace(/^["']|["']$/g, '');
            result.text = answer;
        } else {
            // Fallback text extraction
            const simpleMatch = text.match(/ANSWER:\s*(.*)/i);
            if (simpleMatch) result.text = simpleMatch[1].trim();
        }
        return result;
    };

    // 1. Try Gemini 1.5 Pro (Best Logic)
    if (process.env.GEMINI_API_KEY) {
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
            const result = await model.generateContent(prompt);
            const raw = result.response.text();
            console.log(`[AI THINKING (Gemini Pro)] ${raw.substring(0, 150).replace(/\n/g, ' ')}...`);
            const parsed = parseResponse(raw);
            if (parsed.text && parsed.index) return parsed;
        } catch (e) {
            console.log(`[WARN] Gemini Pro failed: ${e.message}. Falling back...`);
        }

        // 2. Try Gemini 1.5 Flash (Backup)
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(prompt);
            const raw = result.response.text();
            console.log(`[AI THINKING (Gemini Flash)] ${raw.substring(0, 150).replace(/\n/g, ' ')}...`);
            const parsed = parseResponse(raw);
            if (parsed.text && parsed.index) return parsed;
        } catch (e) {
            console.log(`[WARN] Gemini Flash failed: ${e.message}. Falling back...`);
        }
    }

    // 3. Try Groq Llama 3.3 (Strong Open Source)
    if (process.env.GROQ_API_KEY) {
        try {
            const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1
                },
                { headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` } }
            );
            const raw = response.data.choices[0].message.content;
            console.log(`[AI THINKING (Groq Llama)] ${raw.substring(0, 150).replace(/\n/g, ' ')}...`);
            const parsed = parseResponse(raw);
            if (parsed.text && parsed.index) return parsed;
        } catch (e) { console.error(`[WARN] Groq Llama failed: ${e.message}`); }
    }

    // 4. Ultimate Fail-safe
    console.log("[ERROR] All AI models failed. Returning default Option 1.");
    return { text: options[0], index: 1 };
}

module.exports = { solveQuiz };
