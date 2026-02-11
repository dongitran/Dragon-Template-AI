const { GoogleGenAI } = require('@google/genai');
const Document = require('../models/Document');
const { generateMultipleImages } = require('./imageGenerationService');
const storageService = require('./storageService');

/**
 * Generate a project plan via AI (Streaming)
 * @param {string} prompt - User's project description
 * @param {Object} options - Generation options (includeImages, imageStyle, sections)
 * @param {string} userId - User ID
 * @param {string} sessionId - Optional session ID to link document
 * @yields {Object} Progress updates {type: 'text'|'status'|'complete', ...}
 */
async function* generateProjectPlan(prompt, options = {}, userId, sessionId = null) {
    if (!prompt) {
        throw new Error('Prompt is required');
    }

    if (!userId) {
        throw new Error('userId is required');
    }

    // --- Phase 1: Stream text content ---
    console.log('[planGeneration] Phase 1: Streaming plan content');
    let planMarkdown = '';

    for await (const chunk of generatePlanContentStream(prompt, options)) {
        planMarkdown += chunk;
        yield { type: 'text', chunk };
    }

    // --- Phase 2: Save document immediately (with placeholders) ---
    const title = extractTitle(planMarkdown) || `Project Plan: ${prompt.slice(0, 50)}`;
    const blockNoteContent = markdownToBlockNote(planMarkdown);

    console.log('[planGeneration] Phase 2: Saving document to database');
    const document = new Document({
        userId,
        sessionId,
        title,
        type: 'project-plan',
        content: blockNoteContent,
        metadata: {
            generatedBy: 'ai',
            prompt,
            model: 'gemini-2.5-flash',
            generatedAt: new Date(),
        },
        assets: [],
    });
    await document.save();
    console.log(`[planGeneration] Document created: ${document._id}`);

    // Send complete immediately — user can see the plan right away
    yield {
        type: 'complete',
        documentId: document._id,
        title: document.title,
        finalMarkdown: planMarkdown,
    };

    // --- Phase 3: Generate images async (after complete) ---
    const imagePlaceholders = extractImagePlaceholders(planMarkdown);
    if (options.includeImages !== false && imagePlaceholders.length > 0) {
        console.log(`[planGeneration] Phase 3: Generating ${imagePlaceholders.length} images`);
        yield { type: 'status', message: `Generating ${imagePlaceholders.length} images...` };

        try {
            const generatedImages = await generatePlanImages(
                imagePlaceholders,
                { imageStyle: options.imageStyle || 'professional' }
            );

            if (generatedImages.length > 0) {
                console.log('[planGeneration] Uploading images to GCS');
                const uploadedImages = await uploadImagesToGCS(generatedImages, userId);

                // Replace placeholders and update document
                const finalMarkdown = replacePlaceholders(planMarkdown, uploadedImages);
                document.content = markdownToBlockNote(finalMarkdown);
                document.assets = uploadedImages;
                await document.save();

                console.log(`[planGeneration] Document updated with ${uploadedImages.length} images`);
                yield { type: 'images-ready', finalMarkdown };
            }
        } catch (err) {
            console.error('[planGeneration] Image generation failed:', err.message);
            // Non-fatal — document already saved with placeholder text
        }
    }
}

/**
 * Generate plan content via Gemini AI (Streaming)
 */
async function* generatePlanContentStream(prompt, options = {}) {
    const { sections } = options;

    const systemPrompt = `You are a project planning expert. Generate a comprehensive, detailed project plan.

Structure the plan with the following sections:
${sections && sections.length > 0 ? sections.map(s => `- ${s}`).join('\n') : `
- Executive Summary
- Project Overview
- Timeline & Milestones
- Team Structure
- Budget Estimate
- Risk Analysis
`}

Use markdown formatting with proper headings (# ## ###), bullet points, and tables where appropriate.

For images, use placeholders in this exact format:
![Description of image](IMAGE_PLACEHOLDER_<NUMBER>)

Example:
![App dashboard mockup showing main features](IMAGE_PLACEHOLDER_1)
![Team org chart](IMAGE_PLACEHOLDER_2)

Include ${options.includeImages !== false ? '3-5 image placeholders for visual elements like mockups, diagrams, charts, or illustrations.' : 'no image placeholders.'}

Generate realistic, detailed, professional content for each section. Be specific and actionable.`;

    const userPrompt = `Create a project plan for: ${prompt}`;

    const apiKey = process.env.GEMINI_API_KEYS?.split(',')[0];
    if (!apiKey) {
        throw new Error('GEMINI_API_KEYS not configured');
    }

    const ai = new GoogleGenAI({ apiKey });

    const result = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [{
            role: 'user',
            parts: [{
                text: `${systemPrompt}\n\n${userPrompt}`,
            }],
        }],
    });

    for await (const chunk of result) {
        const text = chunk.text;
        if (text) yield text;
    }
}

/**
 * Extract image placeholders from markdown
 */
function extractImagePlaceholders(markdown) {
    const placeholders = [];
    const regex = /!\[([^\]]+)\]\(IMAGE_PLACEHOLDER_(\d+)\)/g;
    let match;

    while ((match = regex.exec(markdown)) !== null) {
        placeholders.push({
            id: match[2],
            description: match[1],
            placeholder: match[0],
        });
    }

    return placeholders;
}

/**
 * Replace image placeholders with actual URLs
 */
function replacePlaceholders(markdown, images) {
    if (images.length === 0) {
        return markdown.replace(/!\[([^\]]*)\]\(IMAGE_PLACEHOLDER_\d+\)/g, '');
    }

    let result = markdown;
    images.forEach(img => {
        const placeholderRegex = new RegExp(`!\\[([^\\]]*)\\]\\(IMAGE_PLACEHOLDER_${img.id}\\)`, 'g');
        result = result.replace(placeholderRegex, `![$1](${img.assetUrl})`);
    });

    // Remove any remaining unreplaced placeholders (failed image generations)
    result = result.replace(/!\[([^\]]*)\]\(IMAGE_PLACEHOLDER_\d+\)\n?/g, '');

    return result;
}

/**
 * Parse inline markdown into BlockNote InlineContent
 */
function parseInlineContent(text) {
    if (!text) return [];

    const result = [];
    const inlineRegex = /(?:\*\*(.+?)\*\*)|(?:\*(.+?)\*)|(?:`([^`]+)`)|(?:\[([^\]]+)\]\(([^)]+)\))/g;
    let lastIndex = 0;
    let match;

    while ((match = inlineRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            result.push({ type: 'text', text: text.slice(lastIndex, match.index) });
        }

        if (match[1]) {
            result.push({ type: 'text', text: match[1], styles: { bold: true } });
        } else if (match[2]) {
            result.push({ type: 'text', text: match[2], styles: { italic: true } });
        } else if (match[3]) {
            result.push({ type: 'text', text: match[3], styles: { code: true } });
        } else if (match[4] && match[5]) {
            result.push({
                type: 'link',
                content: [{ type: 'text', text: match[4] }],
                href: match[5],
            });
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        result.push({ type: 'text', text: text.slice(lastIndex) });
    }

    return result.length > 0 ? result : [{ type: 'text', text }];
}

/**
 * Convert markdown to BlockNote JSON format
 */
function markdownToBlockNote(markdown) {
    const lines = markdown.split('\n');
    const blocks = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') continue;

        if (trimmed.startsWith('### ')) {
            blocks.push({
                type: 'heading',
                props: { level: 3 },
                content: parseInlineContent(trimmed.slice(4)),
            });
        } else if (trimmed.startsWith('## ')) {
            blocks.push({
                type: 'heading',
                props: { level: 2 },
                content: parseInlineContent(trimmed.slice(3)),
            });
        } else if (trimmed.startsWith('# ')) {
            blocks.push({
                type: 'heading',
                props: { level: 1 },
                content: parseInlineContent(trimmed.slice(2)),
            });
        } else if (/^[-*]\s+\[[ x]\]\s/.test(trimmed)) {
            const checked = /^[-*]\s+\[x\]/i.test(trimmed);
            const text = trimmed.replace(/^[-*]\s+\[[ x]\]\s*/i, '');
            blocks.push({
                type: 'checkListItem',
                props: { checked },
                content: parseInlineContent(text),
            });
        } else if (/^[-*+]\s+/.test(trimmed)) {
            const text = trimmed.replace(/^[-*+]\s+/, '');
            blocks.push({
                type: 'bulletListItem',
                content: parseInlineContent(text),
            });
        } else if (/^\d+\.\s+/.test(trimmed)) {
            const text = trimmed.replace(/^\d+\.\s+/, '');
            blocks.push({
                type: 'numberedListItem',
                content: parseInlineContent(text),
            });
        } else if (/^!\[([^\]]*)\]\(([^)]+)\)$/.test(trimmed)) {
            const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
            blocks.push({
                type: 'image',
                props: {
                    url: imgMatch[2],
                    caption: imgMatch[1] || '',
                    width: 512,
                },
            });
        } else if (/^[-*_]{3,}$/.test(trimmed)) {
            continue;
        } else if (trimmed.startsWith('|')) {
            const tableRows = [trimmed];
            while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
                i++;
                tableRows.push(lines[i].trim());
            }
            const parsedTable = parseMarkdownTable(tableRows);
            if (parsedTable) {
                blocks.push(parsedTable);
            }
        } else {
            blocks.push({
                type: 'paragraph',
                content: parseInlineContent(trimmed),
            });
        }
    }

    return blocks;
}

/**
 * Parse markdown table rows into BlockNote table block
 */
function parseMarkdownTable(rows) {
    if (!rows || rows.length < 2) return null;

    const dataRows = rows.filter(r => !/^\|?[\s-:|]+\|?$/.test(r));
    if (dataRows.length === 0) return null;

    const tableContent = {
        type: 'table',
        content: {
            type: 'tableContent',
            rows: dataRows.map(row => {
                const rawCells = row.split('|');
                const startIdx = rawCells[0].trim() === '' ? 1 : 0;
                const endIdx = rawCells[rawCells.length - 1].trim() === '' ? rawCells.length - 1 : rawCells.length;

                const cells = rawCells.slice(startIdx, endIdx).map(cell => {
                    return parseInlineContent(cell.trim());
                });

                return { cells };
            }),
        },
    };

    return tableContent;
}

/**
 * Extract title from markdown
 */
function extractTitle(markdown) {
    const match = markdown.match(/^#\s+(.+)$/m);
    return match ? match[1] : null;
}

/**
 * Generate images for plan placeholders
 */
async function generatePlanImages(placeholders, options = {}) {
    if (!placeholders || placeholders.length === 0) return [];

    const { imageStyle = 'professional' } = options;

    try {
        const promptObjects = placeholders.map(p => ({
            id: p.id,
            description: `${imageStyle} style, high quality: ${p.description}`,
        }));

        const imageResults = await generateMultipleImages(promptObjects, {
            aspectRatio: '16:9',
            retries: 3,
        });

        return imageResults.filter(r => !r.error);
    } catch (error) {
        console.error('[planGeneration] Error generating images:', error);
        return [];
    }
}

/**
 * Upload generated images to GCS
 */
async function uploadImagesToGCS(images, userId) {
    if (!images || images.length === 0) return [];

    try {
        const uploadPromises = images.map(async (img) => {
            const ext = img.mimeType === 'image/png' ? 'png' : 'jpg';
            const filename = `plan-image-${img.id}.${ext}`;

            const uploadResult = await storageService.uploadFile(
                img.buffer,
                filename,
                img.mimeType,
                userId
            );

            const downloadUrl = await storageService.getSignedDownloadUrl(
                uploadResult.fileId,
                7 * 24 * 60 * 60 * 1000
            );

            return {
                id: img.id,
                assetId: uploadResult.gcsUrl,
                assetUrl: downloadUrl,
                assetType: 'image',
                description: img.description,
            };
        });

        return Promise.all(uploadPromises);
    } catch (error) {
        console.error('[planGeneration] Error uploading images:', error);
        return [];
    }
}

module.exports = {
    generateProjectPlan,
    generatePlanContentStream,
    extractImagePlaceholders,
    replacePlaceholders,
    markdownToBlockNote,
    parseInlineContent,
    parseMarkdownTable,
    extractTitle,
    generatePlanImages,
    uploadImagesToGCS,
};
