import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import AICore from './AICore';

const ChatWindow = ({ history, isThinking }) => {
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [history, isThinking]);

    return (
        <div className="chat-window">
            {history.map((msg, index) => (
                <MessageBubble key={index} role={msg.role} content={msg.content} />
            ))}

            {/* Show AI Core only if no user messages yet (length <= 1 means only system prompt) */}
            {history.length <= 1 && <AICore />}

            {isThinking && (
                <div className="message-container assistant-container">
                    <div className="message-bubble assistant-bubble thinking-bubble">
                        <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
};

export default ChatWindow;
