import { speakText } from "../utils/voice";
import "./MessageBubble.css";

function MessageBubble({ message }) {
    const isAI = message.role === "assistant";

    return (
        <div className={`message-bubble ${message.role}`}>
            <div className="message-header">
                {isAI ? "J.A.R.V.I.S" : "YOU"}
            </div>
            <div className="message-content">
                {message.content}
            </div>

            {isAI && (
                <button
                    className="speak-btn"
                    onClick={() => speakText(message.content)}
                    title="Speak"
                >
                    🔊
                </button>
            )}
        </div>
    );
}

export default MessageBubble;
