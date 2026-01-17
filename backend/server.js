const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const { searchWeb } = require('./utils/search');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Key Check
if (!process.env.GROQ_API_KEY) {
  console.error('WARNING: GROQ_API_KEY is not set in .env file.');
}

// Root Endpoint
app.get('/', (req, res) => {
  res.send('JARVIS Backend System Online.');
});

// Query Rewriting Function (Step 1)
async function rewriteQuery(userMessage, history) {
  try {
    const contextLines = Array.isArray(history)
      ? history.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')
      : '';

    const prompt = `
    You are a Search Query Optimizer.
    Your task: Rewrite the user's last message into a clean, effective web search query.
    1. Resolve ambiguous pronouns (e.g., "it", "he", "this") using the Context.
    2. Make the query specific (add names, titles, topics).
    3. Remove unnecessary pleasantries.
    4. Return ONLY the raw search query string. No quotes, no markdown.

    Context:
    ${contextLines}

    User: ${userMessage}
    
    Search Query:
    `;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 30
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const rewritten = response.data.choices[0].message.content.trim().replace(/^"|"$/g, '');
    console.log(`Query Rewritten: "${userMessage}" -> "${rewritten}"`);
    return rewritten;

  } catch (error) {
    console.error('Query Rewriting Failed:', error.message);
    return userMessage; // Fallback to raw query
  }
}

// Chat Endpoint
// Chat Endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

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

    // --- 3. REWRITE QUERY ---
    const searchQuery = await rewriteQuery(message, history);

    // --- 4. WEB SEARCH ---
    const searchResults = await searchWeb(searchQuery);

    let webContext = "No relevant web search results found.";
    if (searchResults && searchResults.length > 0) {
      webContext = searchResults.map((r, i) =>
        `Result ${i + 1}:\nTitle: ${r.title}\nSnippet: ${r.snippet}\nSource: ${r.url}`
      ).join('\n\n');
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

    console.log(`\n=== JARVIS GENERATION ===\nQuery: ${searchQuery}\nResponse: ${assistantContent}\n=========================\n`);

    // Return plain response + history
    const cleanUserMessage = { role: 'user', content: message };
    const updatedHistory = [...(Array.isArray(history) ? history : []), cleanUserMessage, assistantMessage];

    res.json({
      response: assistantContent,
      history: updatedHistory
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
