const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const Document = require('../models/Document');
const Session = require('../models/Session');
const { generateProjectPlan } = require('../services/planGenerationService');
const {
    uploadFile,
    getSignedDownloadUrl,
    getMaxUploadBytes,
    validateFileType,
} = require('../services/storageService');

const router = express.Router();

// Multer config for asset uploads (images only)
const assetUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: getMaxUploadBytes(), files: 1 },
    fileFilter: (req, file, cb) => {
        const { valid, error } = validateFileType(file.mimetype, file.originalname);
        if (!valid) {
            cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', error));
        } else {
            cb(null, true);
        }
    },
});

// POST /api/commands/generate-plan — generate project plan via AI (Streaming)
router.post('/generate-plan', authMiddleware, async (req, res) => {
    try {
        let { sessionId, prompt, options = {} } = req.body;
        const userId = req.user.sub;

        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'prompt is required' });
        }

        // Create or load chat session
        let session;
        if (sessionId) {
            session = await Session.findOne({ _id: sessionId, userId });
        }
        if (!session) {
            session = new Session({ userId, title: 'New Chat', messages: [] });
            await session.save();
            sessionId = session._id.toString();
        }

        // Save user message to session
        session.messages.push({ role: 'user', content: `/project-plan ${prompt}` });
        await session.save();

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Helper to send SSE data
        const sendSSE = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
            if (res.flush) res.flush(); // Force push to client immediately
        };

        // Send sessionId first so frontend can navigate
        sendSSE({ sessionId });

        // Generate plan using the streaming service
        let completedTitle = '';
        let completedDocId = '';
        for await (const update of generateProjectPlan(prompt, options, userId, sessionId)) {
            sendSSE(update);
            if (update.type === 'complete') {
                completedTitle = update.title;
                completedDocId = update.documentId;
            }
        }

        // Save assistant message to session (async, don't block response)
        if (completedTitle) {
            session.messages.push({
                role: 'assistant',
                content: `**Project Plan Generated!**\n\n**${completedTitle}**`,
                metadata: { planAction: true, documentId: completedDocId.toString() },
            });
            session.title = completedTitle;
            session.save().catch(err => console.error('Failed to save session:', err));
        }

        res.end();
    } catch (error) {
        console.error('Error generating project plan:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate project plan', message: error.message });
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        }
    }
});

// GET /api/documents — list user's documents
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { type, limit = 50, offset = 0 } = req.query;
        const userId = req.user.sub;

        const filter = { userId };
        if (type) {
            filter.type = type;
        }

        const documents = await Document.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .select('_id userId sessionId title type createdAt updatedAt metadata.generatedBy');

        const total = await Document.countDocuments(filter);

        res.json({
            documents,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
        });
    } catch (error) {
        console.error('Error listing documents:', error);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});

// GET /api/documents/:id — retrieve single document
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub;

        const document = await Document.findOne({ _id: id, userId });

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json(document);
    } catch (error) {
        console.error('Error retrieving document:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid document ID' });
        }
        res.status(500).json({ error: 'Failed to retrieve document' });
    }
});

// PUT /api/documents/:id — update document
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub;
        const { title, content } = req.body;

        // Validate inputs
        if (!title && !content) {
            return res.status(400).json({ error: 'title or content is required' });
        }

        // Find document and verify ownership
        const document = await Document.findOne({ _id: id, userId });

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Update fields
        if (title) document.title = title;
        if (content) document.content = content;

        await document.save();

        res.json(document);
    } catch (error) {
        console.error('Error updating document:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid document ID' });
        }
        res.status(500).json({ error: 'Failed to update document' });
    }
});

// DELETE /api/documents/:id — delete document
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub;

        const result = await Document.deleteOne({ _id: id, userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ success: true, message: 'Document deleted' });
    } catch (error) {
        console.error('Error deleting document:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid document ID' });
        }
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// ---- BlockNote JSON → Markdown converter ----

/**
 * Convert BlockNote inline content to markdown string
 */
function inlineContentToMarkdown(content) {
    if (!content || !Array.isArray(content)) return '';
    return content.map(node => {
        if (node.type === 'link') {
            const linkText = inlineContentToMarkdown(node.content);
            return `[${linkText}](${node.href})`;
        }
        let text = node.text || '';
        if (node.styles?.bold) text = `**${text}**`;
        if (node.styles?.italic) text = `*${text}*`;
        if (node.styles?.code) text = `\`${text}\``;
        return text;
    }).join('');
}

/**
 * Convert BlockNote blocks array to markdown string
 */
function blockNoteToMarkdown(blocks) {
    if (!blocks || !Array.isArray(blocks)) return '';

    return blocks.map(block => {
        const text = inlineContentToMarkdown(block.content);

        switch (block.type) {
            case 'heading': {
                const prefix = '#'.repeat(block.props?.level || 1);
                return `${prefix} ${text}`;
            }
            case 'paragraph':
                return text || '';
            case 'bulletListItem':
                return `- ${text}`;
            case 'numberedListItem':
                return `1. ${text}`;
            case 'checkListItem':
                return `- [${block.props?.checked ? 'x' : ' '}] ${text}`;
            case 'image':
                return `![${block.props?.caption || ''}](${block.props?.url || ''})`;
            case 'table': {
                if (!block.content?.rows) return '';
                const rows = block.content.rows.map(row => {
                    const cells = row.cells.map(cell => {
                        // Each cell is an array of blocks
                        if (Array.isArray(cell)) {
                            return cell.map(b => inlineContentToMarkdown(b.content)).join('');
                        }
                        return '';
                    });
                    return `| ${cells.join(' | ')} |`;
                });
                // Insert separator after header row
                if (rows.length > 0) {
                    const colCount = block.content.rows[0]?.cells?.length || 1;
                    const separator = `| ${Array(colCount).fill('---').join(' | ')} |`;
                    rows.splice(1, 0, separator);
                }
                return rows.join('\n');
            }
            default:
                return text || '';
        }
    }).join('\n\n');
}

// POST /api/documents/:id/export — export document to Markdown
router.post('/:id/export', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub;
        const { format } = req.body;

        // Only support markdown for now
        if (!format || format !== 'markdown') {
            return res.status(400).json({ error: 'format must be "markdown"' });
        }

        // Find document and verify ownership
        const document = await Document.findOne({ _id: id, userId });

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Convert BlockNote JSON to Markdown
        const markdown = blockNoteToMarkdown(document.content);

        // Return as downloadable markdown file
        const filename = `${document.title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim()}.md`;
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(markdown);
    } catch (error) {
        console.error('Error exporting document:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid document ID' });
        }
        res.status(500).json({ error: 'Failed to export document' });
    }
});

// POST /api/documents/:id/assets/upload — upload asset (image) to document
router.post('/:id/assets/upload', authMiddleware, (req, res) => {
    assetUpload.single('file')(req, res, async (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File too large.' });
                }
                return res.status(400).json({ error: err.field || err.message });
            }
            return res.status(500).json({ error: 'Upload failed.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file provided.' });
        }

        try {
            const { id } = req.params;
            const userId = req.user.sub;

            // Verify document ownership
            const document = await Document.findOne({ _id: id, userId });
            if (!document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Upload to GCS
            const uploadResult = await uploadFile(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype,
                userId
            );

            // Get signed download URL
            const downloadUrl = await getSignedDownloadUrl(uploadResult.fileId);

            // Append asset to document
            const asset = {
                assetId: uploadResult.gcsUrl,
                assetUrl: downloadUrl,
                assetType: 'image',
                description: req.file.originalname,
            };
            document.assets.push(asset);
            await document.save();

            // Return URL for BlockNote to insert
            res.status(201).json({ url: downloadUrl });
        } catch (error) {
            console.error('Error uploading asset:', error);
            res.status(500).json({ error: 'Failed to upload asset.' });
        }
    });
});

// PATCH /api/documents/:id — partial update document content (for autosave)
router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub;
        const { content, contentType } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'content is required' });
        }

        // Find document and verify ownership
        const document = await Document.findOne({ _id: id, userId });

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Update content and contentType
        document.content = content;
        if (contentType) {
            document.contentType = contentType;
        }
        document.updatedAt = new Date();

        await document.save();

        res.json({
            success: true,
            document: {
                _id: document._id,
                title: document.title,
                content: document.content,
                contentType: document.contentType,
                updatedAt: document.updatedAt,
            },
        });
    } catch (error) {
        console.error('[Documents] PATCH error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid document ID' });
        }
        res.status(500).json({ error: 'Failed to update document' });
    }
});

module.exports = router;
