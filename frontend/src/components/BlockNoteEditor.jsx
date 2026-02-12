import { useCallback, useRef, useEffect } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import '@blocknote/core/fonts/inter.css';
import authFetch from '../utils/authFetch';
import './blocknote-editor.css';

const API_BASE = import.meta.env.VITE_API_URL;

/**
 * BlockNote Editor wrapper with dark theme, auto-save, and image upload
 *
 * @param {Object} props
 * @param {Array} props.initialContent - BlockNote blocks JSON
 * @param {string} props.documentId - Document ID for save/upload
 * @param {Function} props.onContentChange - Called with updated blocks on every change
 * @param {Function} props.onSave - Called with blocks when auto-save triggers
 * @param {boolean} props.editable - Whether editor is editable (default: true)
 */
function BlockNoteEditor({
    initialContent,
    documentId,
    onContentChange,
    onSave,
    editable = true,
}) {
    const saveTimerRef = useRef(null);

    // Upload handler — sends file to backend asset upload endpoint
    const handleUpload = useCallback(async (file) => {
        if (!documentId) {
            console.warn('[BlockNoteEditor] No documentId, cannot upload');
            return '';
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await authFetch(
            `${API_BASE}/api/documents/${documentId}/assets/upload`,
            {
                method: 'POST',
                body: formData,
            }
        );

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Asset upload failed');
        }

        const data = await res.json();
        return data.url;
    }, [documentId]);

    // Create editor instance
    const editor = useCreateBlockNote({
        initialContent: initialContent?.length > 0 ? initialContent : undefined,
        uploadFile: handleUpload,
    }, [initialContent]);

    // Cleanup save timer on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    // Handle content changes — debounced auto-save
    const handleChange = useCallback(() => {
        const blocks = editor.document;

        // Notify parent of content change
        if (onContentChange) {
            onContentChange(blocks);
        }

        // Debounced auto-save (3 seconds)
        if (onSave) {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
            saveTimerRef.current = setTimeout(() => {
                onSave(blocks);
            }, 3000);
        }
    }, [editor, onContentChange, onSave]);

    return (
        <div className="blocknote-editor-wrapper">
            <BlockNoteView
                editor={editor}
                editable={editable}
                theme="dark"
                onChange={handleChange}
            />
        </div>
    );
}

export default BlockNoteEditor;
