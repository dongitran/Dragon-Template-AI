const express = require('express');
const authMiddleware = require('../middleware/auth');
const Document = require('../models/Document');
const { generateProjectPlan } = require('../services/planGenerationService');

const router = express.Router();

// POST /api/commands/generate-plan — generate project plan via AI
router.post('/commands/generate-plan', authMiddleware, async (req, res) => {
    try {
        const { sessionId, prompt, options = {} } = req.body;
        const userId = req.user.sub;

        // Validate prompt
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'prompt is required and must be a string' });
        }

        // Generate plan
        const result = await generateProjectPlan(prompt, options, userId, sessionId);

        res.status(201).json(result);
    } catch (error) {
        console.error('Error generating project plan:', error);
        res.status(500).json({ error: 'Failed to generate project plan', message: error.message });
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

// POST /api/documents/:id/export — export document to PDF or Markdown
router.post('/:id/export', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub;
        const { format } = req.body;

        // Validate format
        if (!format || !['pdf', 'markdown'].includes(format)) {
            return res.status(400).json({ error: 'format must be "pdf" or "markdown"' });
        }

        // Find document and verify ownership
        const document = await Document.findOne({ _id: id, userId });

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // TODO: Implement export logic in Phase 8.5
        // For now, return placeholder response
        res.status(501).json({ error: 'Export functionality not yet implemented' });
    } catch (error) {
        console.error('Error exporting document:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid document ID' });
        }
        res.status(500).json({ error: 'Failed to export document' });
    }
});

// POST /api/documents/:id/assets/upload — upload asset (image) to document
router.post('/:id/assets/upload', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub;

        // TODO: Implement asset upload in Phase 8.3
        // Will use multer + storageService similar to upload.js
        res.status(501).json({ error: 'Asset upload not yet implemented' });
    } catch (error) {
        console.error('Error uploading asset:', error);
        res.status(500).json({ error: 'Failed to upload asset' });
    }
});

module.exports = router;
