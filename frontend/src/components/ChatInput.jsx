import { useRef, useEffect } from 'react';
import { SendOutlined, StopOutlined } from '@ant-design/icons';

function ChatInput({ onSend, isStreaming, onStop }) {
    const textareaRef = useRef(null);

    // Auto-resize textarea
    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = '24px';
            textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
        }
    };

    useEffect(() => {
        if (!isStreaming && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isStreaming]);

    const handleSubmit = () => {
        const text = textareaRef.current?.value.trim();
        if (!text || isStreaming) return;
        onSend(text);
        textareaRef.current.value = '';
        adjustHeight();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="chat-input-area">
            <div className="chat-input-wrapper">
                <textarea
                    ref={textareaRef}
                    className="chat-input-textarea"
                    placeholder="Ask Dragon AI anything..."
                    rows={1}
                    onInput={adjustHeight}
                    onKeyDown={handleKeyDown}
                    disabled={isStreaming}
                />
                {isStreaming ? (
                    <button
                        className="chat-send-btn chat-stop-btn"
                        onClick={onStop}
                        title="Stop generating"
                    >
                        <StopOutlined />
                    </button>
                ) : (
                    <button
                        className="chat-send-btn"
                        onClick={handleSubmit}
                        title="Send message"
                    >
                        <SendOutlined />
                    </button>
                )}
            </div>
        </div>
    );
}

export default ChatInput;
