const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const { searchWeb } = require('./utils/search');
const { generateImage } = require('./utils/imageGenerator');
const { playMusicOnYoutube } = require('./utils/mediaAgent');
const { exec } = require('child_process');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { processUploadedFile } = require('./utils/fileProcessor');

// Use Memory Storage to avoid Vercel filesystem issues explicitly.
// Files are held in RAM (Buffer) which is safer for Lambda functions.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
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
    5. If the user asks for a "video", "animation", "motion", or "cinematic", set "needsVideoGen": true.
    6. If the user asks to "attend", "solve", "do", or "take" a QUIZ or fill a form at a URL, set "needsQuizSolve": true.
    7. If the user asks to "play a song", "go to brave and play", or similar music requests, set "needsMusicPlay": true.
    8. If search is needed, generate an optimized search query.
    9. If it's a quiz, the "query" should be the target URL.
    10. If it's music, the "query" should be the song name only.

    Output a STRICT JSON object only:
    {
      "needsSearch": boolean,
      "needsImageGen": boolean,
      "needsVideoGen": boolean,
      "needsQuizSolve": boolean,
      "needsMusicPlay": boolean,
      "query": "the_optimized_search_query_or_url_or_song"
    }

    Context:
    ${contextLines}

    User Message: ${userMessage}
    `;

    let resultJson = null;

    // Try Gemini first
    if (process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const res = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        });
        resultJson = res.response.text();
      } catch (e) {
        console.warn("Gemini intent analysis failed, falling back to Groq.");
      }
    }

    // Fallback to Groq
    if (!resultJson) {
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
        { headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` } }
      );
      resultJson = response.data.choices[0].message.content;
    }

    const result = JSON.parse(resultJson);
    console.log(`Intent Analysis: Search? ${result.needsSearch} | Image? ${result.needsImageGen} | Quiz? ${result.needsQuizSolve}`);
    return result;

  } catch (error) {
    console.error('Intent Analysis Failed:', error.message);
    return { needsSearch: false, needsImageGen: false, needsVideoGen: false, needsQuizSolve: false, query: userMessage }; // Safe fallback
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
    const { needsSearch, needsImageGen, needsVideoGen, needsQuizSolve, needsMusicPlay, query: optimizedQuery } = await analyzeIntent(message, history);

    let webContext = "Live Web Search was not performed.";
    let imageResult = null;
    let quizResult = null;

    // --- 4. PARALLEL EXECUTION: IMAGE GEN, WEB SEARCH, QUIZ SOLVE ---
    const tasks = [];

    // Task 0: Quiz Solver (New)
    if (needsQuizSolve) {
      console.log("Triggering Browser Agent for Quiz...");
      const { solveQuiz } = require('./utils/browserAgent');

      // Dynamic Extraction of User Details
      let userDetails = {
        name: "Dhinesh",
        email: "dhinesh@user.com",
        phone: "0000000000",
        regNo: "N/A"
      };

      try {
        const extractionPrompt = `Extract user details from the conversation. 
        Context: ${recentMessages}
        Current Message: ${message}
        
        Return ONLY a JSON object: {"name": "...", "email": "...", "phone": "...", "regNo": "..."}
        If a detail is missing, use the default values above.`;

        const extRes = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: extractionPrompt }],
          response_format: { type: "json_object" }
        }, {
          headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
        });

        const extData = JSON.parse(extRes.data.choices[0].message.content);
        userDetails = { ...userDetails, ...extData };
        console.log("Extracted User Details for Quiz:", userDetails);
      } catch (e) {
        console.warn("User detail extraction failed, using defaults.");
      }

      tasks.push(
        solveQuiz(optimizedQuery || message, userDetails)
          .then(res => ({ type: 'quiz', data: res }))
          .catch(err => ({ type: 'quiz', error: err }))
      );
    }

    // Task 0.1: Music Playback (New)
    if (needsMusicPlay) {
      console.log("Triggering Brave Music Playback...");

      tasks.push(
        playMusicOnYoutube(optimizedQuery || message)
          .then(() => ({ type: 'music', success: true }))
          .catch(err => ({ type: 'music', error: err }))
      );
    }

    // Task 1: Image Generation (& Optional Video)
    if (needsImageGen || needsVideoGen) {
      console.log(`Triggering ${needsVideoGen ? 'Video' : 'Image'} Generation...`);

      const imageTask = generateImage(optimizedQuery || message)
        .then(async (res) => {
          if (!res.success) return { type: 'image', data: res };

          // If Video is requested, chain execution: Image -> Video
          if (needsVideoGen) {
            const { generateVideoFromImage } = require('./utils/videoGenerator');
            console.log("Image ready. Converting to Video (this may take 60s)...");
            const videoRes = await generateVideoFromImage(res.image);
            // We return both video and the original image source
            return { type: 'video', data: videoRes, imageData: res.image };
          }

          return { type: 'image', data: res };
        })
        .catch(err => ({ type: 'image', error: err }));

      tasks.push(imageTask);
    }

    // Task 2: Web Search
    // Note: We run search even if image is generated to provide full context
    if (needsSearch && optimizedQuery) {
      console.log("Triggering Web Search...");
      tasks.push(
        searchWeb(optimizedQuery)
          .then(res => ({ type: 'search', data: res }))
          .catch(err => ({ type: 'search', error: err }))
      );
    }

    const results = await Promise.all(tasks);

    // Process Results
    results.forEach(result => {
      if (result.type === 'image') {
        if (result.data && result.data.success) {
          imageResult = result.data.image;
          webContext += `\n[SYSTEM: An image was successfully generated.]`;
        } else {
          webContext += `\n[SYSTEM: Image generation failed.]`;
        }
      }

      if (result.type === 'video') {
        if (result.data && result.data.success) {
          req.videoResult = result.data.video;
          imageResult = result.imageData; // Also show the static image as preview/fallback
          webContext += `\n[SYSTEM: A video was successfully generated based on the image.]`;
        } else {
          const err = result.data.error || "Unknown error";
          webContext += `\n[SYSTEM: Video generation failed: ${err}. The static image was generated instead.]`;
          if (result.imageData) {
            imageResult = result.imageData;
          }
        }
      }

      if (result.type === 'search') {
        if (result.data && result.data.length > 0) {
          const searchSummary = result.data.map((r, i) =>
            `Result ${i + 1}:\nTitle: ${r.title}\nSnippet: ${r.snippet}\nSource: ${r.url}`
          ).join('\n\n');
          // If we have previous context (e.g. from image failure), append clearly
          if (webContext === "Live Web Search was not performed.") {
            webContext = searchSummary;
          } else {
            webContext += `\n\nWEB SEARCH RESULTS:\n${searchSummary}`;
          }
        } else {
          if (webContext === "Live Web Search was not performed.") {
            webContext = "Search performed but found no relevant results.";
          } else {
            webContext += "\n\n[System: Search returned no results.]";
          }
        }
      }

      if (result.type === 'quiz') {
        if (result.data && result.data.success) {
          webContext += `\n\n[SYSTEM: Browser Agent successfully completed the task: ${result.data.message}]`;
        } else {
          webContext += `\n\n[SYSTEM: Browser Agent failed: ${result.data.error || "Unknown error"}]`;
        }
      }

      if (result.type === 'music') {
        if (result.success) {
          webContext += `\n\n[SYSTEM: Music playback started in Brave browser.]`;
        } else {
          webContext += `\n\n[SYSTEM: Failed to start music playback: ${result.error || "Unknown error"}]`;
        }
      }
    });

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

    // --- 7. AI REASONING (GEMINI PRIMARY, GROQ FALLBACK) ---
    const messagesForAI = [
      systemPrompt,
      { role: 'user', content: structuredInput }
    ];

    let assistantContent = null;

    // Try Gemini First
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log("Using Gemini 1.5 Flash for Reasoning...");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: systemPrompt.content + "\n\n" + structuredInput }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1000,
          }
        });
        const response = await result.response;
        assistantContent = response.text();
      } catch (e) {
        console.warn("Gemini reasoning failed:", e.message);
      }
    }

    // Fallback to Groq
    if (!assistantContent) {
      console.log("Using Groq (Llama 3.1) for Fallback Reasoning...");
      const groqResponse = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.1-8b-instant',
          messages: messagesForAI,
          temperature: 0.4,
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
      assistantContent = groqResponse.data.choices[0].message.content;
    }

    const assistantMessage = { role: 'assistant', content: assistantContent };



    console.log(`\n=== JARVIS GENERATION ===\nResponse: ${assistantContent}\n=========================\n`);

    // Return plain response + history + image if available
    const cleanUserMessage = { role: 'user', content: message };
    const updatedHistory = [...(Array.isArray(history) ? history : []), cleanUserMessage, assistantMessage];

    res.json({
      response: assistantContent,
      history: updatedHistory,
      image: imageResult,
      video: req.videoResult // Send video data if available
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
