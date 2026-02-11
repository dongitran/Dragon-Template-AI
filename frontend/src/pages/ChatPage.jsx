import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Select } from 'antd';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import TypingIndicator from '../components/TypingIndicator';
import './chat.css';

const API_BASE = import.meta.env.VITE_API_URL;

function ChatPage() {
    const { sessionId: urlSessionId } = useParams();
    const navigate = useNavigate();

    const [messages, setMessages] = useState([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [providers, setProviders] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [sessionId, setSessionId] = useState(urlSessionId || null);
    const [sessionTitle, setSessionTitle] = useState('New Chat');
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const isStreamingRef = useRef(false);

    // Fetch available models on mount
    useEffect(() => {
        fetchModels();
    }, []);

    // Load session when URL changes
    useEffect(() => {
        if (urlSessionId) {
            setSessionId(urlSessionId);
            // Don't reload session from server if we're actively streaming
            // (navigate() during streaming would wipe the in-memory messages)
            if (!isStreamingRef.current) {
                loadSession(urlSessionId);
            }
        } else {
            // New chat
            setSessionId(null);
            setMessages([]);
            setSessionTitle('New Chat');
        }
    }, [urlSessionId]);

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

    const loadSession = async (id) => {
        try {
            const res = await fetch(`${API_BASE}/api/sessions/${id}`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
                setSessionTitle(data.title || 'New Chat');
                if (data.model) setSelectedModel(data.model);
            } else {
                // Session not found — redirect to new chat
                console.error('Session not found');
                navigate('/', { replace: true });
            }
        } catch (err) {
            console.error('Failed to load session:', err);
        }
    };

    // Upload files to backend, returns attachment metadata array
    const uploadFiles = async (files) => {
        if (!files || files.length === 0) return [];

        const formData = new FormData();
        for (const file of files) {
            formData.append('files', file);
        }

        const res = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'File upload failed');
        }

        const data = await res.json();
        return data.files;
    };

    const handleSend = useCallback(async (text, files = []) => {
        const userMessage = { role: 'user', content: text || '' };

        // Upload files first if any
        let attachments = [];
        if (files.length > 0) {
            try {
                attachments = await uploadFiles(files);
                userMessage.attachments = attachments;
            } catch (err) {
                console.error('Upload failed:', err);
                setMessages(prev => [
                    ...prev,
                    { role: 'user', content: text || '' },
                    { role: 'assistant', content: `**Upload Error:** ${err.message}` },
                ]);
                return;
            }
        }

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setIsStreaming(true);
        isStreamingRef.current = true;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Character queue for smooth streaming
        let charQueue = '';
        let displayedContent = '';
        let typingInterval = null;

        // Start character-by-character display loop
        const startTyping = () => {
            if (typingInterval) return;
            const charsPerSec = parseInt(import.meta.env.VITE_CHAT_TYPING_SPEED || '75', 10);
            const intervalMs = 1000 / charsPerSec;

            typingInterval = setInterval(() => {
                if (charQueue.length > 0) {
                    displayedContent += charQueue[0];
                    charQueue = charQueue.slice(1);

                    setMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: 'assistant',
                            content: displayedContent,
                        };
                        return updated;
                    });
                }
            }, intervalMs);
        };

        const stopTyping = () => {
            if (typingInterval) {
                clearInterval(typingInterval);
                typingInterval = null;
            }
        };

        try {
            // Build request messages — include attachments metadata
            const requestMessages = updatedMessages.map(msg => {
                const m = { role: msg.role, content: msg.content || '' };
                if (msg.attachments && msg.attachments.length > 0) {
                    m.attachments = msg.attachments;
                }
                return m;
            });

            const res = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    messages: requestMessages,
                    model: selectedModel,
                    sessionId: sessionId || undefined,
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

                        if (parsed.sessionId) {
                            setSessionId(parsed.sessionId);
                            navigate(`/chat/${parsed.sessionId}`, { replace: true });
                            continue;
                        }

                        if (parsed.error) {
                            charQueue += `\n\n**Error:** ${parsed.error}`;
                        } else if (parsed.chunk) {
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

            // Refresh session title in case it was auto-generated
            setTimeout(() => {
                setSessionId(currentSid => {
                    if (currentSid) {
                        fetch(`${API_BASE}/api/sessions/${currentSid}`, { credentials: 'include' })
                            .then(r => r.ok ? r.json() : null)
                            .then(data => {
                                if (data?.title && data.title !== 'New Chat') {
                                    setSessionTitle(data.title);
                                }
                            })
                            .catch(() => { });
                    }
                    return currentSid;
                });
            }, 3000);
        } catch (err) {
            stopTyping();
            if (err.name === 'AbortError') {
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
            isStreamingRef.current = false;
            abortControllerRef.current = null;
        }
    }, [messages, selectedModel, sessionId, navigate, urlSessionId]);

    const handleStop = useCallback(() => {
        abortControllerRef.current?.abort();
        setIsStreaming(false);
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
            {/* Messages area */}
            <div className="chat-messages">
                <div className="chat-messages-inner">
                    {messages.length === 0 ? (
                        <div className="chat-empty">
                            <div className="chat-empty-icon">🐉</div>
                            <h3>Welcome to Dragon Template</h3>
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
                            {isStreaming && (
                                // Show typing indicator when:
                                // 1. No assistant message yet (waiting for fetch response)
                                // 2. Empty assistant message exists (waiting for first chunk)
                                messages[messages.length - 1]?.role !== 'assistant' ||
                                messages[messages.length - 1]?.content === ''
                            ) && (
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
                modelOptions={modelOptions}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
            />
        </div>
    );
}

export default ChatPage;
