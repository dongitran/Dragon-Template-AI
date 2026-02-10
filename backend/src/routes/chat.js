const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getProviders, resolveModel, streamChat } = require('../services/aiProvider');

const router = express.Router();

// GET /api/chat/models — return available providers and models
router.get('/models', authMiddleware, (req, res) => {
    const providers = getProviders();
    res.json({ providers });
});

// POST /api/chat — SSE streaming chat
router.post('/', authMiddleware, async (req, res) => {
    const { messages, model } = req.body;

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages array is required and must not be empty' });
    }

    // Validate each message has role and content
    for (const msg of messages) {
        if (!msg.role || !msg.content) {
            return res.status(400).json({ error: 'Each message must have role and content' });
        }
        if (!['user', 'assistant'].includes(msg.role)) {
            return res.status(400).json({ error: 'Message role must be "user" or "assistant"' });
        }
    }

    // Resolve model
    const resolved = resolveModel(model);
    if (!resolved) {
        return res.status(400).json({ error: 'Invalid model specified or no models configured' });
    }

    // Set up SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Flush headers immediately
    res.flushHeaders();

    // Handle client disconnect
    let aborted = false;
    req.on('close', () => {
        aborted = true;
    });

    try {
        const stream = streamChat(resolved.providerId, resolved.modelId, messages);

        for await (const chunk of stream) {
            if (aborted) break;
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }

        if (!aborted) {
            res.write('data: [DONE]\n\n');
        }
    } catch (err) {
        console.error('[Chat] Stream error:', err.message);
        if (!aborted) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.write('data: [DONE]\n\n');
        }
    } finally {
        if (!aborted) {
            res.end();
        }
    }
});

module.exports = router;
