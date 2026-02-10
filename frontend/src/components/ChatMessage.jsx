import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

function ChatMessage({ message }) {
    const { role, content } = message;
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
                {isUser ? (
                    content
                ) : (
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
                )}
            </div>
        </div>
    );
}

export default ChatMessage;
