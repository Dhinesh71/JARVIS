import React, { useState, useEffect } from 'react';
import { speechRecognizer } from '../utils/speechRecognition';

const ChatInput = ({ onSendMessage, isThinking }) => {
    const [message, setMessage] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [sttLang, setSttLang] = useState('en-IN'); // Default to English

    const toggleLanguage = () => {
        const newLang = sttLang === 'en-IN' ? 'ta-IN' : 'en-IN';
        setSttLang(newLang);
        speechRecognizer.setLanguage(newLang);
    };

    const toggleListening = () => {
        if (isListening) {
            speechRecognizer.stop();
            setIsListening(false);
        } else {
            setIsListening(true);
            speechRecognizer.start(
                (transcript) => {
                    setMessage(transcript);
                },
                () => {
                    setIsListening(false);
                },
                (error) => {
                    setIsListening(false);
                    console.error("Mic Error:", error);
                }
            );
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (message.trim() && !isThinking) {
            onSendMessage(message);
            setMessage('');
            if (isListening) {
                speechRecognizer.stop();
                setIsListening(false);
            }
        }
    };

    return (
        <form className="chat-input-container" onSubmit={handleSubmit}>
            <button
                type="button"
                className={`lang-toggle ${sttLang === 'ta-IN' ? 'active' : ''}`}
                onClick={toggleLanguage}
                disabled={isThinking || isListening}
                title="Switch Language (EN/TA)"
            >
                {sttLang === 'en-IN' ? 'EN' : 'TA'}
            </button>
            <button
                type="button"
                className={`mic-button ${isListening ? 'listening' : ''}`}
                onClick={toggleListening}
                disabled={isThinking}
                title={isListening ? "Stop Listening" : "Start Speaking"}
            >
                {isListening ? "🛑" : "🎤"}
            </button>
            <input
                type="text"
                className="chat-input"
                placeholder={isThinking ? "Jarvis is thinking..." : (isListening ? "Listening..." : "Type a message...")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isThinking}
            />
            <button type="submit" className="send-button" disabled={isThinking || !message.trim()}>
                Send
            </button>
        </form>
    );
};

export default ChatInput;
