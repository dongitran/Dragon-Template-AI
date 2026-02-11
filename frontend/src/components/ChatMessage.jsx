import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FilePdfOutlined, FileOutlined, DownloadOutlined, LoadingOutlined, FileImageOutlined } from '@ant-design/icons';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function AttachmentImage({ attachment, onDownload }) {
    const [imgSrc, setImgSrc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const fetchUrl = async () => {
            try {
                const res = await fetch(
                    `${API_BASE}${attachment.downloadUrl}`,
                    { credentials: 'include' }
                );
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();
                if (!cancelled) {
                    setImgSrc(data.url);
                    setLoading(false);
                }
            } catch {
                if (!cancelled) {
                    setError(true);
                    setLoading(false);
                }
            }
        };
        fetchUrl();
        return () => { cancelled = true; };
    }, [attachment.downloadUrl]);

    if (loading) {
        return (
            <div className="chat-attachment-card" style={{ minWidth: 120 }}>
                <span className="chat-attachment-card-icon"><LoadingOutlined /></span>
                <div className="chat-attachment-card-info">
                    <span className="chat-attachment-card-name">{attachment.fileName}</span>
                    <span className="chat-attachment-card-size">Loading...</span>
                </div>
            </div>
        );
    }

    if (error || !imgSrc) {
        return (
            <div className="chat-attachment-card" onClick={() => onDownload(attachment)}>
                <span className="chat-attachment-card-icon"><FileImageOutlined /></span>
                <div className="chat-attachment-card-info">
                    <span className="chat-attachment-card-name">{attachment.fileName}</span>
                </div>
                <span className="chat-attachment-download"><DownloadOutlined /></span>
            </div>
        );
    }

    return (
        <img
            src={imgSrc}
            alt={attachment.fileName}
            className="chat-attachment-image"
            onClick={() => window.open(imgSrc, '_blank')}
            loading="lazy"
        />
    );
}

function FileAttachments({ attachments }) {
    if (!attachments || attachments.length === 0) return null;

    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleDownload = async (attachment) => {
        try {
            const res = await fetch(
                `${API_BASE}${attachment.downloadUrl}`,
                { credentials: 'include' }
            );
            if (res.ok) {
                const data = await res.json();
                window.open(data.url, '_blank');
            }
        } catch (err) {
            console.error('Download failed:', err);
        }
    };

    const isImage = (type) => type?.startsWith('image/');

    return (
        <div className="chat-attachments">
            {attachments.map((att, i) => {
                if (isImage(att.fileType)) {
                    return <AttachmentImage key={i} attachment={att} onDownload={handleDownload} />;
                }

                const isPdf = att.fileType === 'application/pdf';
                return (
                    <div
                        key={i}
                        className="chat-attachment-card"
                        onClick={() => handleDownload(att)}
                    >
                        <span className="chat-attachment-card-icon">
                            {isPdf ? <FilePdfOutlined /> : <FileOutlined />}
                        </span>
                        <div className="chat-attachment-card-info">
                            <span className="chat-attachment-card-name" title={att.fileName}>
                                {att.fileName}
                            </span>
                            <span className="chat-attachment-card-size">
                                {formatSize(att.fileSize)}
                            </span>
                        </div>
                        <span className="chat-attachment-download">
                            <DownloadOutlined />
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function ChatMessage({ message }) {
    const { role, content, attachments } = message;
    const isUser = role === 'user';

    return (
        <div className={`chat-message ${role}`}>
            <div className="chat-message-avatar">
                {isUser ? (
                    <span>U</span>
                ) : (
                    <span>🐉</span>
                )}
            </div>
            <div className="chat-message-content">
                {/* File attachments (shown for both user and assistant) */}
                <FileAttachments attachments={attachments} />

                {/* Text content */}
                {isUser ? (
                    content || null
                ) : (
                    content ? (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                        <SyntaxHighlighter
                                            style={oneDark}
                                            language={match[1]}
                                            PreTag="div"
                                            customStyle={{
                                                background: 'rgba(0, 0, 0, 0.4)',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                            }}
                                            {...props}
                                        >
                                            {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    );
                                },
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    ) : null
                )}
            </div>
        </div>
    );
}

export default ChatMessage;
