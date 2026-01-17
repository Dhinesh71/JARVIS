const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const { searchWeb } = require('./utils/search');
const { generateImage } = require('./utils/imageGenerator');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { processUploadedFile } = require('./utils/fileProcessor');

// Use system temp directory for uploads (works on Vercel & Local)
const uploadDir = os.tmpdir();

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit matching express config
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsOptions = {
  origin: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Pre-flight request handling
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Key Check
if (!process.env.GROQ_API_KEY) {
  console.error('WARNING: GROQ_API_KEY is not set in .env file.');
}

// Root Endpoint
app.get('/', (req, res) => {
  res.send('JARVIS Backend System Online.');
});

// Intent Analysis & Query Optimization (Step 1)
async function analyzeIntent(userMessage, history) {
  try {
    const contextLines = Array.isArray(history)
      ? history.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')
      : '';

    const prompt = `
    You are an intelligent Intent Classifier and query optimizer.
    Your Job:
    1. Analyze the User's message and Context.
    2. Determine if the user is asking for information that requires a LIVE WEB SEARCH (e.g., "latest news", "weather", "stock price", "release date", "who is...", "recent events").
    3. General coding questions, greetings, logic puzzles, or creative writing DO NOT require search.
    4. If the user asks to "generate", "create", "draw", "visualize" an IMAGE, set "needsImageGen": true.
    5. If search is needed, generate an optimized search query.

    Output a STRICT JSON object only:
    {
      "needsSearch": boolean,
      "needsImageGen": boolean,
      "query": "the_optimized_search_query_or_image_prompt"
    }

    Context:
    ${contextLines}

    User Message: ${userMessage}
    `;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You represent output in JSON format only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 100,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let result = response.data.choices[0].message.content;

    // Parse JSON safely
    try {
      if (typeof result === 'string') {
        result = JSON.parse(result);
      }
    } catch (e) {
      // Fallback if JSON parsing fails but looks like a string
      console.warn("JSON Parse failed, attempting fallback logic.");
      return { needsSearch: false, needsImageGen: false, query: userMessage };
    }

    console.log(`Intent Analysis: Search? ${result.needsSearch} | Image? ${result.needsImageGen}`);
    return result;

  } catch (error) {
    console.error('Intent Analysis Failed:', error.message);
    return { needsSearch: false, needsImageGen: false, query: userMessage }; // Safe fallback
  }
}

// Chat Endpoint
// Chat Endpoint
// Chat Endpoint
app.post('/chat', upload.array('files'), async (req, res) => {
  try {
    let { message, history } = req.body;

    // Handle FormData parsing for history (it comes as string)
    if (typeof history === 'string') {
      try {
        history = JSON.parse(history);
      } catch (e) {
        history = [];
      }
    }

    // --- FILE PROCESSING ---
    let fileContext = "";
    if (req.files && req.files.length > 0) {
      console.log(`Received ${req.files.length} files.`);
      const processedFiles = await Promise.all(req.files.map(file => processUploadedFile(file)));

      fileContext = processedFiles.map(f =>
        `FILE: ${f.filename} (${f.type})\nSUMMARY/ANALYSIS:\n${f.summary}`
      ).join('\n\n');

      // Append notification to message for LLM awareness
      message += `\n\n[System Notification: User uploaded ${req.files.length} file(s). See FILE CONTEXT.]`;
    }

    if (!message) {
      return res.status(400).json({ error: 'Message field is required' });
    }

    // --- 1. MEMORY & CONTEXT (Hardcoded/Inferred for now) ---
    const USER_MEMORY = `Name: Dhinesh
Project: Jarvis AI
Preference: Confident, decisive, short answers.
Role: Full Stack Developer building JARVIS.`;

    const SESSION_CONTEXT = "User is interacting with JARVIS to build and debug the system.";

    // --- 2. RECENT MESSAGES ---
    const recentMessages = Array.isArray(history)
      ? history.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'JARVIS'}: ${m.content}`).join('\n')
      : "No recent history.";

    // --- 3. ANALYZE INTENT & SEARCH (Conditional) ---
    const { needsSearch, needsImageGen, query: optimizedQuery } = await analyzeIntent(message, history);

    let webContext = "Live Web Search was not performed.";
    let imageResult = null;

    // --- 4a. IMAGE GENERATION (Highest Priority if active) ---
    if (needsImageGen) {
      console.log("Triggering Image Generation...");
      const genResult = await generateImage(optimizedQuery || message);

      if (genResult && genResult.success) {
        imageResult = genResult.image;
        // We return early or inject this into the response. 
        // Better to let the LLM know it generated an image so it can present it.
        webContext += `\n[SYSTEM: An image was successfully generated based on the user's request. The image data is attached to the response.]`;
      } else {
        webContext += `\n[SYSTEM: Image generation failed. Apologize to the user.]`;
      }
    }

    // --- 4b. EXECUTE WEB SEARCH (Only if needed and not simple image gen) ---
    if (needsSearch && !imageResult && optimizedQuery) {
      const searchResults = await searchWeb(optimizedQuery);

      if (searchResults && searchResults.length > 0) {
        webContext = searchResults.map((r, i) =>
          `Result ${i + 1}:\nTitle: ${r.title}\nSnippet: ${r.snippet}\nSource: ${r.url}`
        ).join('\n\n');
      } else {
        webContext = "Search performed but found no relevant results.";
      }
    }

    // --- 5. STRUCTURED INPUT CONSTRUCTION ---
    const structuredInput = `
USER MEMORY:
${USER_MEMORY}

SESSION CONTEXT:
${SESSION_CONTEXT}

RECENT MESSAGES:
${recentMessages}

WEB SEARCH CONTEXT:
${webContext}

FILE CONTEXT (UPLOADED FILES):
${fileContext || "No files uploaded."}

USER MESSAGE:
${message}
`;

    // --- 6. SYSTEM PROMPT ---
    const systemPrompt = {
      role: "system",
      content: `You are JARVIS, an intelligent conversational AI assistant.

You receive structured context sections.
You must combine all of them into ONE clear, confident response.

Rules:
- Never mention memory, search, Groq, or backend logic.
- PRIVACY RULE: Do NOT mention the User's name (Dhinesh), role, or private details in general conversation.
- EXCEPTION: If explicitly asked "Who created you?" or "Who made you?", you MUST answer: "I was created by Dhinesh."
- NO ROBOTIC FILLER: Do NOT start with "Based on...", "According to...", "I can tell you...", "Here is the information". JUST SAY THE ANSWER.
- Never explain missing data.
- Never use weak or uncertain language.
- Always infer intent from context.
- Answer directly and decisively.

Follow the response strategy and style strictly.`
    };

    // --- 7. CALL GROQ (REASONING ENGINE) ---
    const messagesForAI = [
      systemPrompt,
      { role: 'user', content: structuredInput }
    ];

    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: messagesForAI,
        temperature: 0.4, // Controlled and confident
        max_tokens: 500,
        top_p: 0.9
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const assistantContent = groqResponse.data.choices[0].message.content;
    const assistantMessage = { role: 'assistant', content: assistantContent };



    console.log(`\n=== JARVIS GENERATION ===\nResponse: ${assistantContent}\n=========================\n`);

    // Return plain response + history + image if available
    const cleanUserMessage = { role: 'user', content: message };
    const updatedHistory = [...(Array.isArray(history) ? history : []), cleanUserMessage, assistantMessage];

    res.json({
      response: assistantContent,
      history: updatedHistory,
      image: imageResult // Send image data to frontend
    });

  } catch (error) {
    console.error('Error in /chat endpoint:', error.response?.data || error.message);
    const errorMessage = error.response?.data?.error?.message || 'Internal Server Error';
    res.status(500).json({ error: errorMessage });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`JARVIS Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
