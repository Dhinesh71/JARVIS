import React, { useState } from 'react';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import './App.css';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `You are JARVIS, a disciplined conversational AI assistant.

Personality:
- Calm
- Intelligent
- Observant
- Professional and natural
- No emojis unless explicitly asked

Conversation Rules:
- Remember earlier messages
- Refer back to previous context when relevant
- Ask follow-up questions only when useful
- Do NOT repeat information
- Adapt smoothly when topic changes

Accuracy Rules:
- Never invent facts
- If unsure, say: 'I don’t have enough information'

Purpose:
- Help users think, learn, plan, and solve problems
- Be concise by default
- Be detailed only when requested

You are not emotional, not human, and not role-playing fantasies.
You exist to be useful, reliable, and context-aware.`
};

function App() {
  const [history, setHistory] = useState([SYSTEM_PROMPT]);
  const [isThinking, setIsThinking] = useState(false);

  const handleSendMessage = async (message) => {
    setIsThinking(true);

    try {
      // Manage Conversation Memory Limit (System + Last 15)
      let historyToSend = history;
      if (history.length > 15) {
        // Keep System (index 0) and the last 14 messages
        historyToSend = [history[0], ...history.slice(history.length - 14)];
      }

      // Backend API URL (Use environment variable or default to local)
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/chat';

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          history: historyToSend,
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();

      // Update history with the full history returned from backend (which includes the new user msg + assistant reply)
      // Note: Backend handles appending user msg and assistant msg.
      setHistory(data.history);

    } catch (error) {
      console.error('Error sending message:', error);
      // Optional: Add a visual error message to chat
      const errorMsg = { role: 'assistant', content: 'I apologize, but I am unable to connect to the server at the moment.' };
      setHistory(prev => [...prev, { role: 'user', content: message }, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>JARVIS</h1>
        <div className="status-indicator">Online</div>
      </header>
      <main className="chat-interface">
        <ChatWindow history={history} isThinking={isThinking} />
        <ChatInput onSendMessage={handleSendMessage} isThinking={isThinking} />
      </main>
    </div>
  );
}

export default App;
