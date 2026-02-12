import { useState, useCallback, useEffect } from 'react';
import BlockNoteEditor from './BlockNoteEditor';
import { markdownToBlockNote } from '../utils/markdownToBlockNote';
import authFetch from '../utils/authFetch';
import './plan-editor-view.css';

const API_BASE = import.meta.env.VITE_API_URL;

/**
 * Plan Editor with BlockNote - supports streaming markdown → editing with autosave
 *
 * @param {Object} props
 * @param {string} props.markdown - Markdown content (during streaming)
 * @param {string} props.documentId - Document ID (available after 'complete' event)
 * @param {boolean} props.isGenerating - True during SSE streaming
 * @param {string} props.status - Status message during generation
 * @param {Function} props.onClose - Close preview callback
 */
function PlanEditorView({ markdown, documentId, isGenerating, status, onClose }) {
    const [blocks, setBlocks] = useState([]);
    const [editable, setEditable] = useState(false);
    const [saveStatus, setSaveStatus] = useState(''); // '', 'Saving...', 'Saved', 'Save failed'

    // Convert markdown to BlockNote blocks whenever markdown changes
    // Use a key to force BlockNoteEditor re-mount when loading existing plan (not during streaming)
    const [editorKey, setEditorKey] = useState(0);

    useEffect(() => {
        if (markdown) {
            try {
                const converted = markdownToBlockNote(markdown);
                setBlocks(converted);
                // Only force re-mount when loading an existing plan (not streaming)
                if (!isGenerating) {
                    setEditorKey(prev => prev + 1);
                }
            } catch (err) {
                console.error('[PlanEditorView] Markdown conversion error:', err);
                setBlocks([{ type: 'paragraph', content: [{ type: 'text', text: markdown.slice(0, 100) + '...', styles: {} }] }]);
                if (!isGenerating) {
                    setEditorKey(prev => prev + 1);
                }
            }
        }
    }, [markdown, isGenerating]);

    // Enable editing when generation completes
    useEffect(() => {
        if (!isGenerating && documentId) {
            setEditable(true);
        } else {
            setEditable(false);
        }
    }, [isGenerating, documentId]);

    // Autosave handler
    const handleSave = useCallback(async (updatedBlocks) => {
        if (!documentId) {
            console.warn('[PlanEditorView] No documentId, skipping save');
            return;
        }

        setSaveStatus('Saving...');
        try {
            const res = await authFetch(`${API_BASE}/api/documents/${documentId}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: JSON.stringify(updatedBlocks),
                    contentType: 'blocknote',
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Save failed');
            }

            setSaveStatus('Saved');
            setTimeout(() => setSaveStatus(''), 2000);
        } catch (err) {
            console.error('[PlanEditorView] Save error:', err);
            setSaveStatus('Save failed');
            setTimeout(() => setSaveStatus(''), 3000);
        }
    }, [documentId]);

    return (
        <div className="plan-editor-view">
            <div className="plan-editor-header">
                <div className="plan-editor-title">
                    <span className="plan-editor-icon">📜</span>
                    <h3>Project Plan</h3>
                </div>
                <div className="plan-editor-header-right">
                    {status && (
                        <div className="plan-editor-status">
                            <span className="status-dot"></span>
                            {status}
                        </div>
                    )}
                    {saveStatus && (
                        <div
                            className={`plan-editor-save-status ${saveStatus === 'Saved'
                                ? 'success'
                                : saveStatus === 'Saving...'
                                    ? 'loading'
                                    : 'error'
                                }`}
                        >
                            {saveStatus}
                        </div>
                    )}
                    {!editable && isGenerating && (
                        <div className="plan-editor-readonly-badge">
                            Read-only (generating...)
                        </div>
                    )}
                    {onClose && (
                        <button
                            className="plan-editor-close"
                            onClick={onClose}
                            title="Close"
                            aria-label="Close plan editor"
                        >
                            &#x2715;
                        </button>
                    )}
                </div>
            </div>
            <div className="plan-editor-content">
                {blocks.length > 0 ? (
                    <BlockNoteEditor
                        key={editorKey}
                        initialContent={blocks}
                        documentId={documentId}
                        editable={editable}
                        onSave={handleSave}
                    />
                ) : (
                    <div className="plan-editor-loading">
                        <span>Loading plan content...</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PlanEditorView;
