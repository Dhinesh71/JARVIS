import React, { useState, useEffect } from 'react';
import { speechRecognizer } from '../utils/speechRecognition';

const ChatInput = ({ onSendMessage, isThinking, editMessage, onEditComplete }) => {
    const [message, setMessage] = useState('');
    const [isListening, setIsListening] = useState(false);

    // Handle edit message
    useEffect(() => {
        if (editMessage) {
            setMessage(editMessage);
            if (onEditComplete) {
                onEditComplete();
            }
        }
    }, [editMessage, onEditComplete]);

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

        // Prevent double submission if already thinking or text is empty
        if (!message.trim() || isThinking) return;

        // Immediate Mic Shutdown to prevent trickling text
        if (isListening) {
            speechRecognizer.stop();
            setIsListening(false);
        }

        const finalMessage = message.trim();
        setMessage(''); // Clear input immediately
        onSendMessage(finalMessage);
    };

    return (
        <form className="chat-input-container" onSubmit={handleSubmit}>
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
