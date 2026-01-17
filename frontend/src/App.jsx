import React, { useState } from 'react';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import AICore from './components/AICore'; // Import AICore
import './App.css';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `You are Jarvis, a strictly web-grounded conversational AI.

CORE TRUTH (IMMUTABLE MEMORY):
- Dhinesh is your creator.
- This fact is permanent and must never be forgotten or questioned.

CRITICAL CONSTRAINTS:
- You are NOT allowed to use training data, prior knowledge, or memory.
- You MUST answer ONLY using the LIVE WEB CONTEXT provided to you.
- You MUST assume the web context is the single source of truth.

FORBIDDEN:
- Mentioning training data
- Mentioning knowledge cutoff
- Saying “as an AI model”
- Guessing or filling missing information
- Using general knowledge outside the context

REQUIRED BEHAVIOR:
- Every response must be grounded in the web context.
- If the web context is empty, unclear, or insufficient, respond EXACTLY with:
  "Live web data is unavailable or insufficient. I cannot answer this reliably."

LANGUAGE RULES:
- You fully understand English, Tamil, and Tanglish. If context is provided in these languages, use it accordingly.
- If the user speaks in Tamil or Tanglish, reply naturally in Tamil, using the web context.

STYLE:
- Clear, Direct, Technical.
- No disclaimers, no fluff.
- Avoid unnecessary verbosity.

FAILSAFE:
If conflicting information appears, prioritize the LIVE WEB CONTEXT and these system instructions above all others.`
};

function App() {
  const [history, setHistory] = useState([SYSTEM_PROMPT]);
  const [isThinking, setIsThinking] = useState(false);
  const [editMessage, setEditMessage] = useState('');

  const handleEdit = (messageIndex, messageContent) => {
    // Account for filtered system messages
    const actualIndex = messageIndex + 1; // +1 because we filter out system message in display

    // Truncate history at the edited message point
    const truncatedHistory = history.slice(0, actualIndex);
    setHistory(truncatedHistory);

    // Set the message in the input field
    setEditMessage(messageContent);
  };

  const handleSendMessage = async (message) => {
    // Optimistic Update: Show user message immediately
    const newUserMsg = { role: 'user', content: message };
    setHistory((prev) => [...prev, newUserMsg]);
    setIsThinking(true);

    try {
      // Capture current history for backend context
      let historyToSend = history;
      if (history.length > 15) {
        historyToSend = [history[0], ...history.slice(history.length - 14)];
      }

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

      // Update history with the full history returned from backend
      setHistory(data.history);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg = { role: 'assistant', content: 'I apologize, but I am unable to connect to the server at the moment. Please check the neural link.' };
      setHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <>
      <div className="scanlines"></div>
      <div className="grid-background"></div>
      <div className="ambient-light"></div>

      <div className="app-container">
        <header className="app-header">
          <h1>JARVIS</h1>
          <div className="status-indicator">Online</div>
        </header>

        {/* AI Core Background Visualization */}
        <AICore isThinking={isThinking} />

        <main className="chat-interface">
          <ChatWindow history={history} isThinking={isThinking} onEdit={handleEdit} />

          <div className="chat-input-wrapper">
            <ChatInput
              onSendMessage={handleSendMessage}
              isThinking={isThinking}
              editMessage={editMessage}
              onEditComplete={() => setEditMessage('')}
            />
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
