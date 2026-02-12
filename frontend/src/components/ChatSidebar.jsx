import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import authFetch from '../utils/authFetch';
import './ChatSidebar.css';

const API_BASE = import.meta.env.VITE_API_URL;

function ChatSidebar({ currentSessionId, onSessionCreated }) {
    const [sessions, setSessions] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const editInputRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Fetch sessions on mount and when currentSessionId changes
    useEffect(() => {
        fetchSessions();
    }, [currentSessionId]);

    // Focus edit input when editing starts
    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    const fetchSessions = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/sessions?limit=50`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data.sessions || []);
            }
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        }
    };

    const handleNewChat = () => {
        navigate('/');
        if (onSessionCreated) onSessionCreated(null);
    };

    const handleSelectSession = (sessionId) => {
        if (editingId) return; // Don't navigate while editing
        navigate(`/chat/${sessionId}`);
    };

    const handleStartRename = (e, session) => {
        e.stopPropagation();
        setEditingId(session.id);
        setEditTitle(session.title);
    };

    const handleSaveRename = async (e) => {
        if (e) e.stopPropagation();
        if (!editTitle.trim()) {
            setEditingId(null);
            return;
        }

        try {
            const res = await authFetch(`${API_BASE}/api/sessions/${editingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ title: editTitle.trim() }),
            });
            if (res.ok) {
                setSessions(prev =>
                    prev.map(s =>
                        s.id === editingId ? { ...s, title: editTitle.trim() } : s
                    )
                );
            }
        } catch (err) {
            console.error('Failed to rename session:', err);
        }

        setEditingId(null);
    };

    const handleCancelRename = (e) => {
        if (e) e.stopPropagation();
        setEditingId(null);
    };

    const handleDelete = async (e, sessionId) => {
        e.stopPropagation();

        try {
            const res = await authFetch(`${API_BASE}/api/sessions/${sessionId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (res.ok) {
                setSessions(prev => prev.filter(s => s.id !== sessionId));
                // If we deleted the current session, navigate to new chat
                if (currentSessionId === sessionId) {
                    navigate('/');
                    if (onSessionCreated) onSessionCreated(null);
                }
            }
        } catch (err) {
            console.error('Failed to delete session:', err);
        }
    };

    const handleEditKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSaveRename();
        } else if (e.key === 'Escape') {
            handleCancelRename();
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHr < 24) return `${diffHr}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="chat-sidebar">
            <button className="chat-sidebar-new-btn" onClick={handleNewChat}>
                <PlusOutlined />
                <span>New Chat</span>
            </button>

            <div className="chat-sidebar-list">
                {sessions.map(session => {
                    const isActive = currentSessionId === session.id;
                    const isEditing = editingId === session.id;

                    return (
                        <div
                            key={session.id}
                            className={`chat-sidebar-item ${isActive ? 'active' : ''}`}
                            onClick={() => handleSelectSession(session.id)}
                        >
                            {isEditing ? (
                                <div className="chat-sidebar-edit">
                                    <input
                                        ref={editInputRef}
                                        value={editTitle}
                                        onChange={e => setEditTitle(e.target.value)}
                                        onKeyDown={handleEditKeyDown}
                                        className="chat-sidebar-edit-input"
                                        onClick={e => e.stopPropagation()}
                                    />
                                    <button
                                        className="chat-sidebar-action-btn save"
                                        onClick={handleSaveRename}
                                        title="Save"
                                    >
                                        <CheckOutlined />
                                    </button>
                                    <button
                                        className="chat-sidebar-action-btn cancel"
                                        onClick={handleCancelRename}
                                        title="Cancel"
                                    >
                                        <CloseOutlined />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="chat-sidebar-item-content">
                                        <span className="chat-sidebar-item-title">{session.title}</span>
                                        <span className="chat-sidebar-item-time">{formatTime(session.updatedAt)}</span>
                                    </div>
                                    <div className="chat-sidebar-item-actions">
                                        <button
                                            className="chat-sidebar-action-btn"
                                            onClick={(e) => handleStartRename(e, session)}
                                            title="Rename"
                                        >
                                            <EditOutlined />
                                        </button>
                                        <button
                                            className="chat-sidebar-action-btn delete"
                                            onClick={(e) => handleDelete(e, session.id)}
                                            title="Delete"
                                        >
                                            <DeleteOutlined />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ChatSidebar;
