import { useRef, useEffect, useState, useCallback } from 'react';
import { SendOutlined, StopOutlined, PaperClipOutlined, CloseOutlined, FileOutlined, FilePdfOutlined } from '@ant-design/icons';
import { Select } from 'antd';

const ACCEPTED_TYPES = '.pdf,.csv,.png,.jpg,.jpeg';
const MAX_FILES = 5;

function ChatInput({ onSend, isStreaming, onStop, modelOptions, selectedModel, onModelChange }) {
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const [hasText, setHasText] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [isDragOver, setIsDragOver] = useState(false);

    // Auto-resize textarea
    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = '24px';
            textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
            setHasText(textarea.value.trim().length > 0);
        }
    };

    useEffect(() => {
        if (!isStreaming && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isStreaming]);

    // --- File handling ---
    const addFiles = useCallback((fileList) => {
        const newFiles = Array.from(fileList);
        const validExts = ['pdf', 'csv', 'png', 'jpg', 'jpeg'];

        setPendingFiles(prev => {
            const remaining = MAX_FILES - prev.length;
            if (remaining <= 0) return prev;

            const toAdd = newFiles
                .filter(f => {
                    const ext = f.name.split('.').pop().toLowerCase();
                    return validExts.includes(ext);
                })
                .slice(0, remaining)
                .map(file => {
                    const isImage = file.type.startsWith('image/');
                    return {
                        file,
                        preview: isImage ? URL.createObjectURL(file) : null,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                    };
                });

            return [...prev, ...toAdd];
        });
    }, []);

    const removeFile = useCallback((index) => {
        setPendingFiles(prev => {
            const updated = [...prev];
            // Revoke object URL to prevent memory leaks
            if (updated[index]?.preview) {
                URL.revokeObjectURL(updated[index].preview);
            }
            updated.splice(index, 1);
            return updated;
        });
    }, []);

    // Cleanup object URLs on unmount
    useEffect(() => {
        return () => {
            pendingFiles.forEach(f => {
                if (f.preview) URL.revokeObjectURL(f.preview);
            });
        };
    }, []);

    // --- Submit ---
    const handleSubmit = () => {
        const text = textareaRef.current?.value.trim() || '';
        if ((!text && pendingFiles.length === 0) || isStreaming) return;

        onSend(text, pendingFiles.map(f => f.file));
        textareaRef.current.value = '';
        setHasText(false);
        setPendingFiles([]);
        adjustHeight();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // --- File input ---
    const handleFileClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        if (e.target.files) {
            addFiles(e.target.files);
        }
        // Reset so selecting same file again works
        e.target.value = '';
    };

    // --- Drag and Drop ---
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files?.length > 0) {
            addFiles(e.dataTransfer.files);
        }
    };

    // --- Paste from clipboard ---
    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const imageFiles = [];
        for (const item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) imageFiles.push(file);
            }
        }

        if (imageFiles.length > 0) {
            e.preventDefault();
            addFiles(imageFiles);
        }
    };

    // File size formatter
    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // File icon
    const getFileIcon = (type) => {
        if (type === 'application/pdf') return <FilePdfOutlined />;
        return <FileOutlined />;
    };

    const hasPendingFiles = pendingFiles.length > 0;
    const canSend = (hasText || hasPendingFiles) && !isStreaming;

    return (
        <div
            className={`chat-input-area ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="chat-input-container">
                {/* File preview chips */}
                {hasPendingFiles && (
                    <div className="chat-file-previews">
                        {pendingFiles.map((f, i) => (
                            <div key={i} className="chat-file-chip">
                                {f.preview ? (
                                    <img
                                        src={f.preview}
                                        alt={f.name}
                                        className="chat-file-thumb"
                                    />
                                ) : (
                                    <span className="chat-file-icon">
                                        {getFileIcon(f.type)}
                                    </span>
                                )}
                                <div className="chat-file-info">
                                    <span className="chat-file-name" title={f.name}>
                                        {f.name.length > 20
                                            ? f.name.slice(0, 17) + '...'
                                            : f.name}
                                    </span>
                                    <span className="chat-file-size">{formatSize(f.size)}</span>
                                </div>
                                <button
                                    className="chat-file-remove"
                                    onClick={() => removeFile(i)}
                                    title="Remove file"
                                >
                                    <CloseOutlined />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Textarea row */}
                <textarea
                    ref={textareaRef}
                    className="chat-input-textarea"
                    placeholder={hasPendingFiles ? 'Add a message or press Enter to send files...' : 'Ask Dragon Template anything...'}
                    rows={1}
                    onInput={adjustHeight}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                />

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    multiple
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />

                {/* Bottom controls row */}
                <div className="chat-input-controls">
                    {/* Left: Upload button */}
                    <div className="chat-input-left">
                        <button
                            className="chat-upload-btn"
                            onClick={handleFileClick}
                            disabled={isStreaming || pendingFiles.length >= MAX_FILES}
                            title={pendingFiles.length >= MAX_FILES ? `Max ${MAX_FILES} files` : 'Attach files (PDF, CSV, PNG, JPG)'}
                        >
                            <PaperClipOutlined />
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
                                disabled={!canSend}
                                title="Send message"
                            >
                                <SendOutlined />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Drag overlay */}
            {isDragOver && (
                <div className="chat-drag-overlay">
                    <div className="chat-drag-text">
                        <PaperClipOutlined style={{ fontSize: 24 }} />
                        <span>Drop files here</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatInput;
