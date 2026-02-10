function TypingIndicator() {
    return (
        <div className="typing-indicator">
            <div className="chat-message-avatar" style={{
                background: 'linear-gradient(135deg, #6C5CE7, #a855f7)',
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
            }}>
                🐉
            </div>
            <div className="typing-indicator-dots">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
            </div>
        </div>
    );
}

export default TypingIndicator;
