import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Select } from 'antd';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import TypingIndicator from '../components/TypingIndicator';
import PlanEditorView from '../components/PlanEditorView';
import CommandSuggestions from '../components/CommandSuggestions';
import authFetch from '../utils/authFetch';
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

    // --- Split View & Plan Streaming State ---
    const [isSplitView, setIsSplitView] = useState(false);
    const [streamingPlan, setStreamingPlan] = useState('');
    const [planStatus, setPlanStatus] = useState('');
    const [activePlan, setActivePlan] = useState(null); // { documentId, title } — which plan is shown in workspace

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
            // New chat - reset all state
            setSessionId(null);
            setMessages([]);
            setSessionTitle('New Chat');
            setIsSplitView(false);
            setActivePlan(null);

            // Reset streaming state (fix for send button stuck disabled)
            setIsStreaming(false);
            isStreamingRef.current = false;

            // Abort any ongoing streaming request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        }
    }, [urlSessionId]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isStreaming]);

    const fetchModels = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/chat/models`, {
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
            const res = await authFetch(`${API_BASE}/api/sessions/${id}`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                const msgs = data.messages || [];

                // Restore plan action state from message metadata
                for (let i = 0; i < msgs.length; i++) {
                    const meta = msgs[i].metadata;
                    if (meta?.planAction && meta?.documentId) {
                        msgs[i] = { ...msgs[i], planAction: true, documentId: meta.documentId };
                    }
                }

                // Fallback: for old sessions without metadata, match documents to messages
                const planDocs = (data.documents || []).filter(d => d.type === 'project-plan');
                if (planDocs.length > 0) {
                    const hasMetadata = msgs.some(m => m.planAction && m.documentId);
                    if (!hasMetadata) {
                        // Old session — link last plan doc to last "Project Plan Generated!" message
                        const lastPlanDoc = planDocs[planDocs.length - 1];
                        for (let i = msgs.length - 1; i >= 0; i--) {
                            if (msgs[i].role === 'assistant' && msgs[i].content?.includes('Project Plan Generated')) {
                                msgs[i] = { ...msgs[i], planAction: true, documentId: lastPlanDoc.id };
                                break;
                            }
                        }
                    }
                }

                setMessages(msgs);
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

    const loadPlanContent = async (documentId) => {
        try {
            const mdRes = await authFetch(`${API_BASE}/api/documents/${documentId}/export`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ format: 'markdown' }),
            });
            if (mdRes.ok) {
                const markdown = await mdRes.text();
                setStreamingPlan(markdown);
            }
        } catch (err) {
            console.error('Failed to load plan content:', err);
        }
    };

    const openPlan = (documentId, title) => {
        setActivePlan({ documentId, title });
        setStreamingPlan('');
        setPlanStatus('');
        setIsSplitView(true);
        loadPlanContent(documentId);
    };

    const closePlan = () => {
        setIsSplitView(false);
    };

    // Upload files to backend, returns attachment metadata array
    const uploadFiles = async (files) => {
        if (!files || files.length === 0) return [];

        const formData = new FormData();
        for (const file of files) {
            formData.append('files', file);
        }

        const res = await authFetch(`${API_BASE}/api/upload`, {
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

    const handleGeneratePlan = useCallback(async () => {
        // Build a prompt from the conversation context
        const history = messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => `${m.role}: ${m.content}`)
            .join('\n\n');

        if (!history.trim()) {
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: 'Please have a conversation first before generating a project plan.' },
            ]);
            return;
        }

        // Use conversation as the prompt — same API, no backend changes needed
        const prompt = `Based on our conversation below, generate a comprehensive project plan:\n\n${history}`;

        // Enable Split View
        setIsSplitView(true);
        setStreamingPlan('');
        setPlanStatus('');
        setActivePlan(null);
        setIsStreaming(true);
        isStreamingRef.current = true;

        // Show generating message
        setMessages(prev => [
            ...prev,
            { role: 'assistant', content: 'Generating project plan based on our conversation...' },
        ]);

        try {
            const res = await authFetch(`${API_BASE}/api/commands/generate-plan`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    sessionId: sessionId || undefined,
                    options: { includeImages: true },
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Plan generation failed');
            }

            // SSE Reader
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let accPlan = '';
            let planCompleted = false;
            let pendingData = null;

            const showCompleted = (data) => {
                setActivePlan({ documentId: data.documentId, title: data.title || 'Project Plan' });
                setPlanStatus('');
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        role: 'assistant',
                        content: `✅ **Project plan created**: [${data.title || 'Project Plan'}](/documents/${data.documentId})`,
                        planAction: true,
                        documentId: data.documentId,
                    };
                    return updated;
                });
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                        const data = JSON.parse(jsonStr);

                        if (data.sessionId && !sessionId) {
                            setSessionId(data.sessionId);
                            navigate(`/chat/${data.sessionId}`, { replace: true });
                        } else if (data.type === 'text') {
                            accPlan += data.chunk;
                            setStreamingPlan(accPlan);
                        } else if (data.type === 'status') {
                            setPlanStatus(data.message);
                            if (!planCompleted) {
                                setMessages(prev => {
                                    const updated = [...prev];
                                    updated[updated.length - 1] = {
                                        role: 'assistant',
                                        content: data.message,
                                    };
                                    return updated;
                                });
                            }
                        } else if (data.type === 'images-ready') {
                            if (data.finalMarkdown) {
                                setStreamingPlan(data.finalMarkdown);
                            }
                            if (pendingData) {
                                showCompleted(pendingData);
                                pendingData = null;
                            }
                        } else if (data.type === 'complete') {
                            planCompleted = true;
                            if (data.finalMarkdown) {
                                setStreamingPlan(data.finalMarkdown);
                            }
                            pendingData = { documentId: data.documentId, title: data.title };
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    } catch (e) {
                        if (e.message && !e.message.includes('JSON')) throw e;
                    }
                }
            }

            if (pendingData) {
                showCompleted(pendingData);
            }
        } catch (err) {
            console.error('Plan generation failed:', err);
            setIsSplitView(false);
            setMessages(prev => {
                const updated = [...prev];
                if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                    updated[updated.length - 1] = {
                        role: 'assistant',
                        content: `**Plan Generation Failed**\n\n${err.message}`,
                    };
                } else {
                    updated.push({ role: 'assistant', content: `**Plan Generation Failed**\n\n${err.message}` });
                }
                return updated;
            });
        } finally {
            setIsStreaming(false);
            isStreamingRef.current = false;
        }
    }, [messages, sessionId, navigate]);

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
            const charsPerSec = parseInt(import.meta.env.VITE_CHAT_TYPING_SPEED || '110', 10);
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

            const res = await authFetch(`${API_BASE}/api/chat`, {
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
                        authFetch(`${API_BASE}/api/sessions/${currentSid}`, { credentials: 'include' })
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

    // Check if any message has a plan (for keeping WorkspacePreview mounted)
    const hasPlanMessage = messages.some(m => m.planAction && m.documentId);

    return (
        <div className={`chat-container ${isSplitView ? 'split-view' : ''}`}>
            {/* Main Center Area: Plan Editor with BlockNote */}
            <div className="chat-main-area">
                {(isSplitView || hasPlanMessage) && (
                    <PlanEditorView
                        markdown={streamingPlan}
                        documentId={activePlan?.documentId}
                        isGenerating={isStreaming}
                        status={planStatus}
                        onClose={closePlan}
                    />
                )}
            </div>

            {/* Right Panel: Chat Messages & Input */}
            <div className="chat-right-panel">
                <div className="chat-messages">
                    <div className="chat-messages-inner">
                        {messages.length === 0 && !isSplitView && (
                            <div className="chat-empty">
                                <div className="chat-empty-icon">🐉</div>
                                <h3>Welcome to Dragon Template</h3>
                                <p>Start a conversation by typing a message below</p>
                            </div>
                        )}
                        {messages.length > 0 && (
                            <>
                                {messages.map((msg, i) => {
                                    const isLastEmpty = isStreaming && i === messages.length - 1
                                        && msg.role === 'assistant' && msg.content === '';
                                    if (isLastEmpty) return null;
                                    const isActivePlan = activePlan?.documentId === msg.documentId;
                                    return (
                                        <div key={i}>
                                            <ChatMessage message={msg} />
                                            {msg.planAction && msg.documentId && (
                                                <div className="plan-action-buttons">
                                                    <button
                                                        className="plan-action-btn primary"
                                                        onClick={() => {
                                                            if (isSplitView && isActivePlan) {
                                                                closePlan();
                                                            } else {
                                                                openPlan(msg.documentId, msg.title || 'Project Plan');
                                                            }
                                                        }}
                                                    >
                                                        {isSplitView && isActivePlan ? '✕ Close Plan' : '📋 Open Plan in Workspace'}
                                                    </button>
                                                    {!isSplitView && (
                                                        <button
                                                            className="plan-action-btn"
                                                            onClick={() => navigate(`/documents/${msg.documentId}`)}
                                                        >
                                                            ✏️ Edit in Full Screen
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {/* Show CommandSuggestions after assistant messages (except plan action messages) */}
                                            {msg.role === 'assistant' && !msg.planAction && !isStreaming && (
                                                <CommandSuggestions onGeneratePlan={handleGeneratePlan} />
                                            )}
                                        </div>
                                    );
                                })}
                                {isStreaming && (
                                    messages[messages.length - 1]?.role !== 'assistant' ||
                                    messages[messages.length - 1]?.content === ''
                                ) && <TypingIndicator />}
                            </>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className="chat-right-panel-input">
                    <ChatInput
                        onSend={handleSend}
                        isStreaming={isStreaming}
                        onStop={handleStop}
                        modelOptions={modelOptions}
                        selectedModel={selectedModel}
                        onModelChange={setSelectedModel}
                    />
                </div>
            </div>
        </div>
    );
}

export default ChatPage;
