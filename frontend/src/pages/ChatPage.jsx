import { useState, useRef, useEffect, useCallback } from 'react';
import { Select } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import TypingIndicator from '../components/TypingIndicator';
import './chat.css';

const API_BASE = import.meta.env.VITE_API_URL;

function ChatPage() {
    const [messages, setMessages] = useState([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [providers, setProviders] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Fetch available models on mount
    useEffect(() => {
        fetchModels();
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isStreaming]);

    const fetchModels = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/chat/models`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setProviders(data.providers || []);
                // Find default model
                for (const provider of data.providers || []) {
                    const defaultModel = provider.models.find(m => m.default);
                    if (defaultModel) {
                        setSelectedModel(`${provider.id}/${defaultModel.id}`);
                        break;
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch models:', err);
        }
    };

    const handleSend = useCallback(async (text) => {
        const userMessage = { role: 'user', content: text };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setIsStreaming(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Character queue for smooth streaming
        let charQueue = '';
        let displayedContent = '';
        let typingInterval = null;

        // Start character-by-character display loop (20 chars/sec = 50ms per char)
        const startTyping = () => {
            if (typingInterval) return; // Already running
            typingInterval = setInterval(() => {
                if (charQueue.length > 0) {
                    // Take next character from queue
                    displayedContent += charQueue[0];
                    charQueue = charQueue.slice(1);

                    // Update UI
                    setMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: 'assistant',
                            content: displayedContent,
                        };
                        return updated;
                    });
                }
            }, 50); // 20 chars/sec
        };

        const stopTyping = () => {
            if (typingInterval) {
                clearInterval(typingInterval);
                typingInterval = null;
            }
        };

        try {
            const res = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    messages: updatedMessages,
                    model: selectedModel,
                }),
                signal: controller.signal,
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Chat request failed');
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            // Add empty assistant message
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            // Start typing animation
            startTyping();

            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);

                    if (data === '[DONE]') break;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) {
                            charQueue += `\n\n**Error:** ${parsed.error}`;
                        } else if (parsed.chunk) {
                            // Add chunk to character queue
                            charQueue += parsed.chunk;
                        }
                    } catch {
                        // Skip malformed JSON lines
                    }
                }
            }

            // Wait for queue to empty
            while (charQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            stopTyping();

            // Final render
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: 'assistant',
                    content: displayedContent,
                };
                return updated;
            });
        } catch (err) {
            stopTyping();
            if (err.name === 'AbortError') {
                // User cancelled — keep partial content, do final render
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        role: 'assistant',
                        content: displayedContent,
                    };
                    return updated;
                });
            } else {
                console.error('Chat error:', err);
                setMessages(prev => [
                    ...prev,
                    { role: 'assistant', content: `**Error:** ${err.message}` },
                ]);
            }
        } finally {
            setIsStreaming(false);
            abortControllerRef.current = null;
        }
    }, [messages, selectedModel]);

    const handleStop = useCallback(() => {
        abortControllerRef.current?.abort();
    }, []);

    // Build model options for Select - grouped by provider
    const modelOptions = providers.map(provider => ({
        label: provider.name, // Group label
        options: provider.models.map(model => ({
            value: `${provider.id}/${model.id}`,
            label: model.name,
        })),
    }));

    return (
        <div className="chat-container">
            {/* Header with model selector */}
            <div className="chat-header">
                <span className="chat-header-title">
                    <RocketOutlined style={{ marginRight: 8 }} />
                    Dragon AI Chat
                </span>
                <Select
                    className="model-selector"
                    value={selectedModel || undefined}
                    onChange={setSelectedModel}
                    options={modelOptions}
                    placeholder="Select model"
                    size="small"
                    popupMatchSelectWidth={false}
                />
            </div>

            {/* Messages area */}
            <div className="chat-messages">
                <div className="chat-messages-inner">
                    {messages.length === 0 ? (
                        <div className="chat-empty">
                            <div className="chat-empty-icon">🐉</div>
                            <h3>Welcome to Dragon AI</h3>
                            <p>Start a conversation by typing a message below</p>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg, i) => {
                                // Skip rendering empty assistant message during streaming — TypingIndicator replaces it
                                const isLastEmpty = isStreaming && i === messages.length - 1
                                    && msg.role === 'assistant' && msg.content === '';
                                if (isLastEmpty) return null;
                                return <ChatMessage key={i} message={msg} />;
                            })}
                            {isStreaming && messages[messages.length - 1]?.content === '' && (
                                <TypingIndicator />
                            )}
                        </>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input area */}
            <ChatInput
                onSend={handleSend}
                isStreaming={isStreaming}
                onStop={handleStop}
            />
        </div>
    );
}

export default ChatPage;
