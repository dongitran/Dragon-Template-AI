import { useRef, useEffect, useState } from 'react';
import { SendOutlined, StopOutlined } from '@ant-design/icons';
import { Select } from 'antd';

function ChatInput({ onSend, isStreaming, onStop, modelOptions, selectedModel, onModelChange }) {
    const textareaRef = useRef(null);
    const [hasText, setHasText] = useState(false);

    // Auto-resize textarea
    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = '24px';
            textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
            // Update hasText state
            setHasText(textarea.value.trim().length > 0);
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
        setHasText(false);
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
            <div className="chat-input-container">
                {/* Textarea row */}
                <textarea
                    ref={textareaRef}
                    className="chat-input-textarea"
                    placeholder="Ask Dragon Template anything..."
                    rows={1}
                    onInput={adjustHeight}
                    onKeyDown={handleKeyDown}
                    disabled={isStreaming}
                />

                {/* Bottom controls row */}
                <div className="chat-input-controls">
                    {/* Left: Tools button (placeholder for future) */}
                    <div className="chat-input-left">
                        <button className="chat-tools-btn" disabled>
                            <span className="chat-tools-icon">+</span>
                            <span className="chat-tools-text">Tools</span>
                        </button>
                    </div>

                    {/* Right: Model selector + Send button */}
                    <div className="chat-input-right">
                        <Select
                            className="chat-input-model-selector"
                            value={selectedModel || undefined}
                            onChange={onModelChange}
                            options={modelOptions}
                            size="small"
                            popupMatchSelectWidth={false}
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
            </div>
        </div>
    );
}

export default ChatInput;
