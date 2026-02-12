/**
 * Convert markdown string to BlockNote blocks
 * Supports headings, paragraphs, lists, code blocks, images, inline formatting
 */
export function markdownToBlockNote(markdown) {
    if (!markdown || typeof markdown !== 'string') {
        return [];
    }

    const blocks = [];
    const lines = markdown.split('\n');
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) {
            i++;
            continue;
        }

        // Heading (# ## ### etc.)
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = Math.min(headingMatch[1].length, 3); // BlockNote supports 1-3
            const text = headingMatch[2];
            blocks.push({
                type: 'heading',
                props: {
                    level,
                    textColor: 'default',
                },
                content: parseInlineMarkdown(text),
            });
            i++;
            continue;
        }

        // Image (![alt](url))
        const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (imageMatch) {
            blocks.push({
                type: 'image',
                props: {
                    url: imageMatch[2],
                    caption: imageMatch[1] || '',
                },
            });
            i++;
            continue;
        }

        // Code block (```)
        if (trimmed.startsWith('```')) {
            const lang = trimmed.slice(3).trim() || 'plaintext';
            i++;
            let code = '';
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                code += lines[i] + '\n';
                i++;
            }
            blocks.push({
                type: 'code',
                props: { language: lang },
                content: [{ type: 'text', text: code.trimEnd(), styles: {} }],
            });
            i++; // Skip closing ```
            continue;
        }

        // Bullet list (- or *)
        if (trimmed.match(/^[-*]\s+/)) {
            while (i < lines.length && lines[i].trim().match(/^[-*]\s+/)) {
                const text = lines[i].trim().replace(/^[-*]\s+/, '');
                blocks.push({
                    type: 'bulletListItem',
                    content: parseInlineMarkdown(text),
                });
                i++;
            }
            continue;
        }

        // Numbered list (1. 2. 3.)
        if (trimmed.match(/^\d+\.\s+/)) {
            while (i < lines.length && lines[i].trim().match(/^\d+\.\s+/)) {
                const text = lines[i].trim().replace(/^\d+\.\s+/, '');
                blocks.push({
                    type: 'numberedListItem',
                    content: parseInlineMarkdown(text),
                });
                i++;
            }
            continue;
        }

        // Horizontal rule (---, ___, ***)
        if (trimmed.match(/^([-_*]){3,}$/)) {
            blocks.push({
                type: 'paragraph',
                content: [{ type: 'text', text: '---', styles: {} }],
            });
            i++;
            continue;
        }

        // Default: paragraph
        blocks.push({
            type: 'paragraph',
            content: parseInlineMarkdown(trimmed),
        });
        i++;
    }

    return blocks;
}

/**
 * Parse inline markdown formatting (bold, italic, code, links)
 * Returns BlockNote inline content array
 */
function parseInlineMarkdown(text) {
    if (!text) {
        return [{ type: 'text', text: '', styles: {} }];
    }

    const content = [];
    let i = 0;
    let current = '';

    while (i < text.length) {
        // Inline code (`code`)
        if (text[i] === '`' && text[i - 1] !== '\\') {
            if (current) {
                content.push({ type: 'text', text: current, styles: {} });
                current = '';
            }
            i++;
            let code = '';
            while (i < text.length && text[i] !== '`') {
                code += text[i++];
            }
            content.push({ type: 'text', text: code, styles: { code: true } });
            i++; // Skip closing `
            continue;
        }

        // Bold (**text** or __text__)
        if ((text.slice(i, i + 2) === '**' || text.slice(i, i + 2) === '__') && text[i - 1] !== '\\') {
            if (current) {
                content.push({ type: 'text', text: current, styles: {} });
                current = '';
            }
            const delimiter = text.slice(i, i + 2);
            i += 2;
            let bold = '';
            while (i < text.length - 1 && text.slice(i, i + 2) !== delimiter) {
                bold += text[i++];
            }
            content.push({ type: 'text', text: bold, styles: { bold: true } });
            i += 2; // Skip closing **
            continue;
        }

        // Italic (*text* or _text_) - must not be ** or __
        if ((text[i] === '*' || text[i] === '_') && text[i + 1] !== text[i] && text[i - 1] !== '\\') {
            if (current) {
                content.push({ type: 'text', text: current, styles: {} });
                current = '';
            }
            const delimiter = text[i];
            i++;
            let italic = '';
            while (i < text.length && text[i] !== delimiter) {
                italic += text[i++];
            }
            content.push({ type: 'text', text: italic, styles: { italic: true } });
            i++; // Skip closing
            continue;
        }

        // Link ([text](url))
        if (text[i] === '[' && text[i - 1] !== '\\') {
            if (current) {
                content.push({ type: 'text', text: current, styles: {} });
                current = '';
            }
            i++;
            let linkText = '';
            while (i < text.length && text[i] !== ']') {
                linkText += text[i++];
            }
            i++; // Skip ]
            if (text[i] === '(') {
                i++; // Skip (
                let url = '';
                while (i < text.length && text[i] !== ')') {
                    url += text[i++];
                }
                // BlockNote doesn't have link type in inline content, just show as text
                content.push({ type: 'text', text: linkText, styles: {} });
                i++; // Skip )
            } else {
                // Not a link, just text
                content.push({ type: 'text', text: '[' + linkText + ']', styles: {} });
            }
            continue;
        }

        current += text[i++];
    }

    if (current) {
        content.push({ type: 'text', text: current, styles: {} });
    }

    return content.length > 0 ? content : [{ type: 'text', text: '', styles: {} }];
}
