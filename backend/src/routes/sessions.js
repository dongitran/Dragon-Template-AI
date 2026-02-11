const express = require('express');
const authMiddleware = require('../middleware/auth');
const Session = require('../models/Session');
const Document = require('../models/Document');

const router = express.Router();

// POST /api/sessions — create a new session
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, model } = req.body;

        const session = await Session.create({
            userId: req.user.sub,
            title: title || 'New Chat',
            model: model || '',
        });

        res.status(201).json({
            id: session._id,
            title: session.title,
            model: session.model,
            messages: [],
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
        });
    } catch (err) {
        console.error('[Sessions] Create error:', err.message);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// GET /api/sessions — list user's sessions (newest first)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const [sessions, total] = await Promise.all([
            Session.find({ userId: req.user.sub })
                .select('title model updatedAt createdAt')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Session.countDocuments({ userId: req.user.sub }),
        ]);

        res.json({
            sessions: sessions.map(s => ({
                id: s._id,
                title: s.title,
                model: s.model,
                updatedAt: s.updatedAt,
                createdAt: s.createdAt,
            })),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error('[Sessions] List error:', err.message);
        res.status(500).json({ error: 'Failed to list sessions' });
    }
});

// GET /api/sessions/:id — get session with messages
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const [session, documents] = await Promise.all([
            Session.findOne({
                _id: req.params.id,
                userId: req.user.sub,
            }).lean(),
            Document.find({
                sessionId: req.params.id,
                userId: req.user.sub,
            }).select('_id title type').lean(),
        ]);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({
            id: session._id,
            title: session.title,
            model: session.model,
            messages: session.messages.map(m => ({
                id: m._id,
                role: m.role,
                content: m.content,
                attachments: m.attachments || [],
                metadata: m.metadata || null,
                createdAt: m.createdAt,
            })),
            documents: documents.map(d => ({
                id: d._id,
                title: d.title,
                type: d.type,
            })),
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
        });
    } catch (err) {
        // Invalid ObjectId format
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Session not found' });
        }
        console.error('[Sessions] Get error:', err.message);
        res.status(500).json({ error: 'Failed to get session' });
    }
});

// PATCH /api/sessions/:id — rename session
router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        const { title } = req.body;

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
        }

        const session = await Session.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.sub },
            { title: title.trim() },
            { new: true }
        );

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({
            id: session._id,
            title: session.title,
            updatedAt: session.updatedAt,
        });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Session not found' });
        }
        console.error('[Sessions] Update error:', err.message);
        res.status(500).json({ error: 'Failed to update session' });
    }
});

// DELETE /api/sessions/:id — delete session
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const session = await Session.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.sub,
        });

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({ success: true });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Session not found' });
        }
        console.error('[Sessions] Delete error:', err.message);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

module.exports = router;
