import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './WorkspacePreview.css';

function WorkspacePreview({ content, status, title = 'Project Plan Preview', onClose }) {
    // Custom component to render placeholders as loading states
    const components = {
        img: ({ src, alt }) => {
            if (src && src.includes('IMAGE_PLACEHOLDER_')) {
                return (
                    <div className="image-placeholder-loading">
                        <div className="image-placeholder-shimmer"></div>
                        <div className="image-placeholder-text">
                            <span className="sparkle-icon">✨</span>
                            AI is generating visual: {alt || 'diagram'}...
                        </div>
                    </div>
                );
            }
            return <img src={src} alt={alt} style={{ maxWidth: '100%', borderRadius: '8px' }} />;
        }
    };

    return (
        <div className="workspace-preview">
            <div className="workspace-preview-header">
                <div className="workspace-preview-title">
                    <span className="workspace-preview-icon">📜</span>
                    <h3>{title}</h3>
                </div>
                <div className="workspace-preview-header-right">
                    {status && (
                        <div className="workspace-preview-status">
                            <span className="status-dot"></span>
                            {status}
                        </div>
                    )}
                    {onClose && (
                        <button className="workspace-preview-close" onClick={onClose} title="Close preview">
                            &#x2715;
                        </button>
                    )}
                </div>
            </div>
            <div className="workspace-preview-content">
                <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                        {content || ''}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}

export default WorkspacePreview;
