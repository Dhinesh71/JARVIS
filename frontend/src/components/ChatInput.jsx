import React, { useState } from 'react';

const ChatInput = ({ onSendMessage, isThinking }) => {
    const [message, setMessage] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (message.trim() && !isThinking) {
            onSendMessage(message);
            setMessage('');
        }
    };

    return (
        <form className="chat-input-container" onSubmit={handleSubmit}>
            <input
                type="text"
                className="chat-input"
                placeholder={isThinking ? "Jarvis is thinking..." : "Type a message..."}
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
