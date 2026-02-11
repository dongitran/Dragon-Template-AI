import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './documents-page.css';

const API_BASE = import.meta.env.VITE_API_URL;

function DocumentsPage() {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/api/documents`, {
                credentials: 'include',
            });

            if (!res.ok) throw new Error('Failed to load');

            const data = await res.json();
            setDocuments(data.documents || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Error loading documents:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = useCallback(async (docId, e) => {
        e.stopPropagation();
        if (!window.confirm('Delete this document?')) return;

        try {
            const res = await fetch(`${API_BASE}/api/documents/${docId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (res.ok) {
                setDocuments(prev => prev.filter(d => d._id !== docId));
                setTotal(prev => prev - 1);
            }
        } catch (err) {
            console.error('Error deleting document:', err);
        }
    }, []);

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHr < 24) return `${diffHr}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
        return d.toLocaleDateString();
    };

    const typeIcons = {
        'project-plan': '📋',
        'workflow': '⚡',
        'roadmap': '🗺️',
        'sprint': '🏃',
    };

    if (loading) {
        return (
            <div className="documents-page">
                <div className="documents-header">
                    <h2 className="documents-title">Documents</h2>
                </div>
                <div className="documents-loading">
                    <div className="loading-spinner" />
                    <span>Loading documents...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="documents-page">
            <div className="documents-header">
                <div>
                    <h2 className="documents-title">Documents</h2>
                    <span className="documents-count">{total} document{total !== 1 ? 's' : ''}</span>
                </div>
            </div>

            {documents.length === 0 ? (
                <div className="documents-empty">
                    <span className="documents-empty-icon">📄</span>
                    <h3>No documents yet</h3>
                    <p>Generate your first project plan by typing <code>/project-plan</code> in the chat.</p>
                    <button className="documents-cta-btn" onClick={() => navigate('/')}>
                        Go to Chat →
                    </button>
                </div>
            ) : (
                <div className="documents-grid">
                    {documents.map(doc => (
                        <div
                            key={doc._id}
                            className="document-card"
                            onClick={() => navigate(`/documents/${doc._id}`)}
                        >
                            <div className="document-card-header">
                                <span className="document-card-icon">
                                    {typeIcons[doc.type] || '📄'}
                                </span>
                                <span className="document-card-type">{doc.type}</span>
                                <button
                                    className="document-card-delete"
                                    onClick={(e) => handleDelete(doc._id, e)}
                                    title="Delete"
                                >
                                    ✕
                                </button>
                            </div>
                            <h3 className="document-card-title">{doc.title}</h3>
                            <div className="document-card-meta">
                                <span className="document-card-date">{formatDate(doc.createdAt)}</span>
                                {doc.metadata?.generatedBy === 'ai' && (
                                    <span className="document-card-ai-badge">AI Generated</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default DocumentsPage;
