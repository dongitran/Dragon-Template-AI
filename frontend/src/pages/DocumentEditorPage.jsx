import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BlockNoteEditor from '../components/BlockNoteEditor';
import './document-editor.css';

const API_BASE = import.meta.env.VITE_API_URL;

function DocumentEditorPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [document, setDocument] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [title, setTitle] = useState('');
    const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved' | 'error'
    const titleTimerRef = useRef(null);

    // Fetch document on mount
    useEffect(() => {
        fetchDocument();
    }, [id]);

    const fetchDocument = async () => {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch(`${API_BASE}/api/documents/${id}`, {
                credentials: 'include',
            });

            if (!res.ok) {
                if (res.status === 404) {
                    setError('Document not found');
                } else {
                    setError('Failed to load document');
                }
                return;
            }

            const data = await res.json();
            setDocument(data);
            setTitle(data.title || 'Untitled');
        } catch (err) {
            console.error('Error loading document:', err);
            setError('Failed to load document');
        } finally {
            setLoading(false);
        }
    };

    // Save document content
    const saveContent = useCallback(async (content) => {
        if (!id) return;

        try {
            setSaveStatus('saving');
            const res = await fetch(`${API_BASE}/api/documents/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });

            if (!res.ok) {
                throw new Error('Save failed');
            }

            setSaveStatus('saved');
        } catch (err) {
            console.error('Error saving document:', err);
            setSaveStatus('error');
        }
    }, [id]);

    // Save title (debounced)
    const handleTitleChange = useCallback((e) => {
        const newTitle = e.target.value;
        setTitle(newTitle);
        setSaveStatus('unsaved');

        if (titleTimerRef.current) {
            clearTimeout(titleTimerRef.current);
        }

        titleTimerRef.current = setTimeout(async () => {
            if (!newTitle.trim()) return;
            try {
                setSaveStatus('saving');
                await fetch(`${API_BASE}/api/documents/${id}`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newTitle }),
                });
                setSaveStatus('saved');
            } catch {
                setSaveStatus('error');
            }
        }, 1500);
    }, [id]);

    // Handle content change from editor
    const handleContentChange = useCallback(() => {
        if (saveStatus === 'saved') {
            setSaveStatus('unsaved');
        }
    }, [saveStatus]);

    // Export to markdown
    const handleExport = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/documents/${id}/export`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ format: 'markdown' }),
            });

            if (!res.ok) throw new Error('Export failed');

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = window.document.createElement('a');
            a.href = url;
            a.download = `${title || 'document'}.md`;
            window.document.body.appendChild(a);
            a.click();
            window.document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed:', err);
        }
    }, [id, title]);

    // Go back
    const handleBack = () => {
        navigate('/documents');
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
        };
    }, []);

    // --- Render ---
    if (loading) {
        return (
            <div className="document-editor-page">
                <div className="document-editor-loading">
                    <div className="loading-spinner" />
                    <span>Loading document...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="document-editor-page">
                <div className="document-editor-error">
                    <span className="error-icon">📄</span>
                    <span>{error}</span>
                    <button className="document-editor-action-btn" onClick={handleBack}>
                        ← Back to Documents
                    </button>
                </div>
            </div>
        );
    }

    const saveStatusLabel = {
        saved: '✓ Saved',
        saving: '⟳ Saving...',
        unsaved: '● Unsaved',
        error: '✕ Save failed',
    };

    return (
        <div className="document-editor-page">
            {/* Toolbar */}
            <div className="document-editor-toolbar">
                <div className="document-editor-toolbar-left">
                    <button className="document-editor-back-btn" onClick={handleBack} title="Back to Documents">
                        ←
                    </button>
                    <input
                        className="document-editor-title-input"
                        value={title}
                        onChange={handleTitleChange}
                        placeholder="Untitled document..."
                    />
                    {document?.type && (
                        <span className="document-type-badge">{document.type}</span>
                    )}
                </div>
                <div className="document-editor-toolbar-right">
                    <span className={`document-editor-save-status ${saveStatus}`}>
                        {saveStatusLabel[saveStatus]}
                    </span>
                    <button className="document-editor-action-btn" onClick={handleExport}>
                        <span className="btn-icon">↓</span>
                        Export .md
                    </button>
                </div>
            </div>

            {/* Editor */}
            <div className="document-editor-body">
                <BlockNoteEditor
                    initialContent={document?.content}
                    documentId={id}
                    onContentChange={handleContentChange}
                    onSave={saveContent}
                    editable={true}
                />
            </div>
        </div>
    );
}

export default DocumentEditorPage;
