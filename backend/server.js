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
        model: 'llama-3.3-70b-versatile',
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
app.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message field is required' });
    }

    // 0. Greeting Detection (Fast Path)
    const greetings = ["hi", "hello", "hey", "hai", "yo"];
    if (greetings.includes(message.trim().toLowerCase().replace(/[^a-z]/g, ''))) {
      const greetingResponse = "Hi. What can I help you with?";
      const cleanUserMessage = { role: 'user', content: message };
      const assistantMessage = { role: 'assistant', content: greetingResponse };

      return res.json({
        response: greetingResponse,
        history: [...(Array.isArray(history) ? history : []), cleanUserMessage, assistantMessage]
      });
    }

    // 1. Rewrite Query (Critical Fix)
    const searchQuery = await rewriteQuery(message, req.body.history);

    // 2. Perform Web Search (Free DuckDuckGo scraping)
    const searchResults = await searchWeb(searchQuery);

    // 3. Construct Web Context Block
    let webContextBlock = `LIVE WEB CONTEXT (Groq-Optimized Query):\n\nSearch Engine: DuckDuckGo (free)\nOriginal Query: "${message}"\nOptimized Search Query: "${searchQuery}"\n\n`;

    if (searchResults.length > 0) {
      searchResults.forEach((result, index) => {
        webContextBlock += `Result ${index + 1}:\nTitle: ${result.title}\nSnippet: ${result.snippet}\nSource: ${result.url}\n\n`;
      });
    } else {
      console.log('Web Search: No results found.');
      // Do NOT add a "no info" message here. Just leave the context empty roughly, 
      // or provide what we have. The system prompt handles the "No failure language" rule.
      webContextBlock += "Search results were empty. Rely on internal knowledge or industry logic.\n\n";
    }

    if (searchResults.length > 0) {
      console.log(`Web Search: Found ${searchResults.length} results for "${searchQuery}"`);
    }

    // 3. Construct Final Prompt with User Message
    const enrichedMessage = `${webContextBlock}Using ONLY the LIVE WEB CONTEXT above, answer the following question accurately:\n\n${message}`;

    // Ensure history is an array
    const previousHistory = Array.isArray(history) ? history : [];

    // System Prompt (Strict Personality)
    const systemPrompt = {
      role: "system",
      content: `You are JARVIS, an advanced AI assistant.

ABSOLUTE RULES:
- NEVER say phrases like:
  "no information"
  "not available"
  "search results do not show"
  "insufficient data"
  "cannot find"
- NEVER mention search results, sources, or backend processes.
- NEVER explain why something is missing.

BEHAVIOR:
- If release date is officially announced, state it clearly.
- If not officially announced, state the most accurate expected timeframe
  based on reliable patterns (director, studio, announcements).
- Speak confidently and naturally.

STYLE:
- Short
- Decisive
- Human
- No follow-up questions unless strictly required`
    };

    // Construct the messages array for the API call
    const messagesForAI = [
      systemPrompt,
      ...previousHistory,
      { role: 'user', content: enrichedMessage }
    ];

    // 4. Call Groq Chat API
    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: messagesForAI,
        temperature: 0.4,
        top_p: 0.9,
        max_tokens: 1024
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

    // 5. Append clean messages to history (original message, not enriched)
    // We send back the clean user message so the UI doesn't show the internal prompt
    const cleanUserMessage = { role: 'user', content: message };
    const updatedHistory = [...previousHistory, cleanUserMessage, assistantMessage];

    // 6. Return updated history + response
    res.json({
      response: assistantContent,
      history: updatedHistory
    });

  } catch (error) {
    console.error('Error communicating with Groq API:', error.response?.data || error.message);
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
