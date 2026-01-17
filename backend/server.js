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

// Chat Endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message field is required' });
    }

    // 1. Perform Web Search (Free DuckDuckGo scraping)
    const searchResults = await searchWeb(message);

    // 2. Construct Web Context Block
    let webContextBlock = `LIVE WEB CONTEXT (FREE SEARCH RESULTS):\n\nSearch Engine: DuckDuckGo (free)\nSearch Query: "${message}"\n\n`;

    if (searchResults.length > 0) {
      searchResults.forEach((result, index) => {
        webContextBlock += `Result ${index + 1}:\nTitle: ${result.title}\nSnippet: ${result.snippet}\nSource: ${result.url}\n\n`;
      });
    } else {
      webContextBlock += "Live web data is unavailable or insufficient. I cannot answer this reliably.\n\n";
    }

    // 3. Construct Final Prompt with User Message
    const enrichedMessage = `${webContextBlock}Using ONLY the LIVE WEB CONTEXT above, answer the following question accurately:\n\n${message}`;

    // Ensure history is an array
    const previousHistory = Array.isArray(history) ? history : [];

    // Construct the messages array for the API call
    const messagesForAI = [
      ...previousHistory,
      { role: 'user', content: enrichedMessage }
    ];

    // 3. Call Groq Chat API
    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: messagesForAI,
        temperature: 0.7,
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

    // 4. Append assistant reply
    const updatedHistory = [...messagesForAI, assistantMessage];

    // 5. Return updated history + response
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
