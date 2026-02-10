const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getProviders, resolveModel, streamChat } = require('../services/aiProvider');
const { generateTitle } = require('../services/titleGenerator');
const Session = require('../models/Session');

const router = express.Router();

// GET /api/chat/models — return available providers and models
router.get('/models', authMiddleware, (req, res) => {
    const providers = getProviders();
    res.json({ providers });
});

// POST /api/chat — SSE streaming chat with session support
router.post('/', authMiddleware, async (req, res) => {
    const { messages, model, sessionId } = req.body;

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

    // --- Session handling ---
    let session = null;
    const modelString = model || `${resolved.providerId}/${resolved.modelId}`;

    try {
        if (sessionId) {
            // Load existing session — verify ownership
            session = await Session.findOne({
                _id: sessionId,
                userId: req.user.sub,
            });
            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }
        } else {
            // Create new session
            session = await Session.create({
                userId: req.user.sub,
                title: 'New Chat',
                model: modelString,
                messages: [],
            });
        }

        // Save the latest user message to session
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg && lastUserMsg.role === 'user') {
            session.messages.push({
                role: lastUserMsg.role,
                content: lastUserMsg.content,
            });
            session.model = modelString;
            await session.save();
        }
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Session not found' });
        }
        console.error('[Chat] Session error:', err.message);
        return res.status(500).json({ error: 'Failed to manage session' });
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

    // Send sessionId as first event (so frontend can update URL)
    res.write(`data: ${JSON.stringify({ sessionId: session._id })}\n\n`);

    // Handle client disconnect
    let aborted = false;
    req.on('close', () => {
        aborted = true;
    });

    let fullResponse = '';

    try {
        const stream = streamChat(resolved.providerId, resolved.modelId, messages);

        for await (const chunk of stream) {
            if (aborted) break;
            fullResponse += chunk;
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

        // Save assistant response to session (async, fire-and-forget)
        if (fullResponse) {
            session.messages.push({
                role: 'assistant',
                content: fullResponse,
            });
            session.save().catch(err =>
                console.error('[Chat] Failed to save assistant message:', err.message)
            );
        }

        // Auto-generate title if this is the first exchange (2 messages = user + assistant)
        if (session.title === 'New Chat' && session.messages.length >= 2) {
            generateTitle(session.messages).then(title => {
                Session.findByIdAndUpdate(session._id, { title }).catch(err =>
                    console.error('[Chat] Failed to update title:', err.message)
                );
            });
        }
    }
});

module.exports = router;
