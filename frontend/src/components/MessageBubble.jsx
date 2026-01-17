import React from 'react';

const MessageBubble = ({ role, content }) => {
    const isUser = role === 'user';
    const isSystem = role === 'system';

    if (isSystem) return null; // Don't show system prompts

    return (
        <div className={`message-container ${isUser ? 'user-container' : 'assistant-container'}`}>
            <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
                <div className="message-role">{isUser ? 'You' : 'JARVIS'}</div>
                <div className="message-content">{content}</div>
            </div>
        </div>
    );
};

export default MessageBubble;
