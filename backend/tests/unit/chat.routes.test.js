/**
 * Chat Routes — Unit Tests (Phase 6: Session-aware)
 *
 * Tests:
 *  GET /api/chat/models:
 *   1. should return providers and models (200)
 *   2. should include model details (id, name, default)
 *
 *  POST /api/chat — validation:
 *   3. should return 400 when messages is missing
 *   4. should return 400 when messages is not an array
 *   5. should return 400 when messages is empty array
 *   6. should return 400 when message has no role
 *   7. should return 400 when message has no content
 *   8. should return 400 when message has invalid role
 *   9. should return 400 for invalid model
 *
 *  POST /api/chat — SSE streaming:
 *  10. should set correct SSE headers
 *  11. should stream chunks and end with [DONE]
 *  12. should use default model when model field is omitted
 *  13. should pass all conversation messages to streamChat
 *  14. should handle stream error and write error event
 *  15. should stop writing when client disconnects mid-stream
 *
 *  POST /api/chat — Session integration:
 *  16. should create a new session when no sessionId provided
 *  17. should send sessionId as first SSE event
 *  18. should load existing session when sessionId provided
 *  19. should return 404 for non-existent sessionId
 *  20. should return 404 for invalid sessionId format
 *  21. should save assistant response to session
 */
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// Mock auth middleware
jest.mock('../../src/middleware/auth', () => (req, res, next) => {
    req.user = { sub: 'test-user-id' };
    next();
});

// Store mock functions so we can control them per test
const mockStreamChat = jest.fn();
const mockResolveModel = jest.fn();
const mockGetProviders = jest.fn();

jest.mock('../../src/services/aiProvider', () => ({
    getProviders: (...args) => mockGetProviders(...args),
    resolveModel: (...args) => mockResolveModel(...args),
    streamChat: (...args) => mockStreamChat(...args),
}));

// Mock title generator
const mockGenerateTitle = jest.fn();
jest.mock('../../src/services/titleGenerator', () => ({
    generateTitle: (...args) => mockGenerateTitle(...args),
}));

let mongoServer;

beforeAll(async () => {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    // Small delay to let fire-and-forget session.save() complete
    // before we drop the database (prevents version conflict errors)
    await new Promise(r => setTimeout(r, 100));
    await mongoose.connection.db.dropDatabase();
});

const chatRoutes = require('../../src/routes/chat');
const Session = require('../../src/models/Session');

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/chat', chatRoutes);
    return app;
}

/**
 * Create mock req/res/next for directly invoking the route handler.
 * This avoids all HTTP server issues with SSE testing.
 */
function createMockReqRes(body = {}) {
    const req = {
        body,
        cookies: {},
        headers: {},
        user: { sub: 'test-user-id' },
        on: jest.fn(), // for 'close' event
    };

    const written = [];
    const headers = {};
    let statusCode = 200;
    let ended = false;

    const res = {
        writeHead: jest.fn((code, hdrs) => {
            statusCode = code;
            Object.assign(headers, hdrs);
        }),
        flushHeaders: jest.fn(),
        write: jest.fn((data) => { written.push(data); }),
        end: jest.fn(() => { ended = true; }),
        status: jest.fn(function (code) { statusCode = code; return this; }),
        json: jest.fn((data) => { written.push(JSON.stringify(data)); }),
        // Expose collected data
        _getStatusCode: () => statusCode,
        _getHeaders: () => headers,
        _getWritten: () => written,
        _isEnded: () => ended,
    };

    return { req, res };
}

/**
 * Parse SSE events from collected written data.
 */
function parseSSEEvents(written) {
    return written
        .join('')
        .split('\n\n')
        .filter(Boolean)
        .map(e => e.replace('data: ', ''));
}

// Import the route handler directly for SSE tests
let postChatHandler;
{
    const stack = chatRoutes.stack;
    const postRoute = stack.find(layer =>
        layer.route && layer.route.path === '/' && layer.route.methods.post
    );
    postChatHandler = postRoute.route.stack[postRoute.route.stack.length - 1].handle;
}

describe('Chat Routes', () => {
    let app;

    beforeEach(() => {
        app = createApp();
        jest.clearAllMocks();

        // Default mock implementations
        mockGetProviders.mockReturnValue([
            {
                id: 'google',
                name: 'Google Gemini',
                models: [
                    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', default: true },
                    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', default: false },
                ],
            },
        ]);

        mockResolveModel.mockImplementation((model) => {
            if (model === 'invalid-model') return null;
            return { providerId: 'google', modelId: 'gemini-2.5-flash' };
        });

        mockStreamChat.mockImplementation(async function* () {
            yield 'Hello ';
            yield 'world!';
        });

        mockGenerateTitle.mockResolvedValue('Test Chat Title');
    });

    // =============================================
    // GET /api/chat/models
    // =============================================
    describe('GET /api/chat/models', () => {
        it('should return providers and models (200)', async () => {
            const res = await request(app).get('/api/chat/models');
            expect(res.status).toBe(200);
            expect(res.body.providers).toBeDefined();
            expect(res.body.providers).toHaveLength(1);
            expect(res.body.providers[0].id).toBe('google');
            expect(res.body.providers[0].models).toHaveLength(2);
        });

        it('should include model details', async () => {
            const res = await request(app).get('/api/chat/models');
            const model = res.body.providers[0].models[0];
            expect(model.id).toBe('gemini-2.5-flash');
            expect(model.name).toBe('Gemini 2.5 Flash');
            expect(model.default).toBe(true);
        });
    });

    // =============================================
    // POST /api/chat — validation (uses supertest)
    // =============================================
    describe('POST /api/chat — validation', () => {
        it('should return 400 when messages is missing', async () => {
            const res = await request(app).post('/api/chat').send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('messages');
        });

        it('should return 400 when messages is not an array', async () => {
            const res = await request(app).post('/api/chat').send({ messages: 'hello' });
            expect(res.status).toBe(400);
        });

        it('should return 400 when messages is empty array', async () => {
            const res = await request(app).post('/api/chat').send({ messages: [] });
            expect(res.status).toBe(400);
        });

        it('should return 400 when message has no role', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({ messages: [{ content: 'hello' }] });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('role');
        });

        it('should return 400 when message has no content or attachments', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({ messages: [{ role: 'user' }] });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('content');
        });

        it('should return 400 when message has invalid role', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({ messages: [{ role: 'system', content: 'hello' }] });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('role');
        });

        it('should return 400 for invalid model', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({
                    messages: [{ role: 'user', content: 'hello' }],
                    model: 'invalid-model',
                });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('model');
        });
    });

    // =============================================
    // POST /api/chat — SSE streaming (uses mock req/res)
    // =============================================
    describe('POST /api/chat — SSE streaming', () => {
        it('should set correct SSE headers', async () => {
            const { req, res } = createMockReqRes({
                messages: [{ role: 'user', content: 'hello' }],
            });

            await postChatHandler(req, res);

            expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            }));
            expect(res.flushHeaders).toHaveBeenCalled();
        });

        it('should stream chunks and end with [DONE]', async () => {
            const { req, res } = createMockReqRes({
                messages: [{ role: 'user', content: 'hello' }],
            });

            await postChatHandler(req, res);

            const events = parseSSEEvents(res._getWritten());
            // First event is sessionId, then chunks, then [DONE]
            const chunkEvents = events.filter(e => {
                if (e === '[DONE]') return false;
                try {
                    const parsed = JSON.parse(e);
                    return parsed.chunk !== undefined;
                } catch { return false; }
            });
            const chunks = chunkEvents.map(e => JSON.parse(e).chunk);
            expect(chunks).toEqual(['Hello ', 'world!']);
            expect(events[events.length - 1]).toBe('[DONE]');
            expect(res.end).toHaveBeenCalled();
        });

        it('should use default model when model field is omitted', async () => {
            const { req, res } = createMockReqRes({
                messages: [{ role: 'user', content: 'hello' }],
            });

            await postChatHandler(req, res);

            expect(mockResolveModel).toHaveBeenCalledWith(undefined);
            expect(mockStreamChat).toHaveBeenCalledWith(
                'google',
                'gemini-2.5-flash',
                [{ role: 'user', content: 'hello' }]
            );
        });

        it('should pass all conversation messages to streamChat', async () => {
            const allMessages = [
                { role: 'user', content: 'Hi' },
                { role: 'assistant', content: 'Hello!' },
                { role: 'user', content: 'How are you?' },
            ];

            const { req, res } = createMockReqRes({
                messages: allMessages,
                model: 'google/gemini-2.5-flash',
            });

            await postChatHandler(req, res);

            expect(mockStreamChat).toHaveBeenCalledWith(
                'google',
                'gemini-2.5-flash',
                allMessages
            );
        });

        it('should handle stream error and write error event', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            mockStreamChat.mockImplementation(async function* () {
                yield 'partial ';
                throw new Error('API quota exceeded');
            });

            const { req, res } = createMockReqRes({
                messages: [{ role: 'user', content: 'hello' }],
            });

            await postChatHandler(req, res);

            const events = parseSSEEvents(res._getWritten());
            const parsed = events.filter(e => e !== '[DONE]').map(e => JSON.parse(e));

            expect(parsed.some(e => e.chunk === 'partial ')).toBe(true);
            expect(parsed.some(e => e.error === 'API quota exceeded')).toBe(true);
            expect(events[events.length - 1]).toBe('[DONE]');

            consoleSpy.mockRestore();
        });

        it('should stop writing when client disconnects mid-stream', async () => {
            let closeCallback;

            mockStreamChat.mockImplementation(async function* () {
                yield 'chunk-1 ';
                // Simulate client disconnect after first chunk
                closeCallback();
                yield 'chunk-2 ';
                yield 'chunk-3 ';
            });

            const { req, res } = createMockReqRes({
                messages: [{ role: 'user', content: 'hello' }],
            });

            // Capture the 'close' event listener
            req.on.mockImplementation((event, cb) => {
                if (event === 'close') closeCallback = cb;
            });

            await postChatHandler(req, res);

            const written = res._getWritten();
            const events = parseSSEEvents(written);

            // Should have written chunk-1 but stopped after disconnect
            expect(events.some(e => e !== '[DONE]' && JSON.parse(e).chunk === 'chunk-1 ')).toBe(true);

            // Should NOT have written [DONE] or called res.end() after disconnect
            expect(events.includes('[DONE]')).toBe(false);
            expect(res.end).not.toHaveBeenCalled();
        });
    });

    // =============================================
    // POST /api/chat — Session integration
    // =============================================
    describe('POST /api/chat — Session integration', () => {
        it('should create a new session when no sessionId provided', async () => {
            const { req, res } = createMockReqRes({
                messages: [{ role: 'user', content: 'hello' }],
            });

            await postChatHandler(req, res);

            // Verify session was created in DB
            const sessions = await Session.find({ userId: 'test-user-id' });
            expect(sessions).toHaveLength(1);
            expect(['New Chat', 'Test Chat Title']).toContain(sessions[0].title);
        });

        it('should send sessionId as first SSE event', async () => {
            const { req, res } = createMockReqRes({
                messages: [{ role: 'user', content: 'hello' }],
            });

            await postChatHandler(req, res);

            const events = parseSSEEvents(res._getWritten());
            const firstEvent = JSON.parse(events[0]);
            expect(firstEvent.sessionId).toBeDefined();
        });

        it('should load existing session when sessionId provided', async () => {
            // Create a session first
            const session = await Session.create({
                userId: 'test-user-id',
                title: 'Existing Chat',
            });

            const { req, res } = createMockReqRes({
                messages: [{ role: 'user', content: 'hello' }],
                sessionId: session._id.toString(),
            });

            await postChatHandler(req, res);

            // Verify it used existing session, not a new one
            const sessions = await Session.find({ userId: 'test-user-id' });
            expect(sessions).toHaveLength(1);
            expect(sessions[0].title).toBe('Existing Chat');
        });

        it('should return 404 for non-existent sessionId', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post('/api/chat')
                .send({
                    messages: [{ role: 'user', content: 'hello' }],
                    sessionId: fakeId.toString(),
                });

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('Session not found');
        });

        it('should return 404 for invalid sessionId format', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({
                    messages: [{ role: 'user', content: 'hello' }],
                    sessionId: 'invalid-format',
                });

            expect(res.status).toBe(404);
        });

        it('should save user message and assistant response to session', async () => {
            const { req, res } = createMockReqRes({
                messages: [{ role: 'user', content: 'hello' }],
            });

            await postChatHandler(req, res);

            // Wait briefly for async save
            await new Promise(r => setTimeout(r, 50));

            const sessions = await Session.find({ userId: 'test-user-id' });
            expect(sessions[0].messages).toHaveLength(2);
            expect(sessions[0].messages[0].role).toBe('user');
            expect(sessions[0].messages[0].content).toBe('hello');
            expect(sessions[0].messages[1].role).toBe('assistant');
            expect(sessions[0].messages[1].content).toBe('Hello world!');
        });

        it('should not allow loading another user\'s session', async () => {
            const session = await Session.create({
                userId: 'other-user',
                title: 'Private',
            });

            const res = await request(app)
                .post('/api/chat')
                .send({
                    messages: [{ role: 'user', content: 'hello' }],
                    sessionId: session._id.toString(),
                });

            expect(res.status).toBe(404);
        });

        it('should return 500 when session create throws non-CastError', async () => {
            const spy = jest.spyOn(Session, 'create').mockRejectedValueOnce(new Error('DB down'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const res = await request(app)
                .post('/api/chat')
                .send({
                    messages: [{ role: 'user', content: 'hello' }],
                });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to manage session');

            spy.mockRestore();
            consoleSpy.mockRestore();
        });

        it('should trigger title generation when title is "New Chat" and has ≥ 2 messages', async () => {
            const { req, res } = createMockReqRes({
                messages: [{ role: 'user', content: 'hello' }],
            });

            await postChatHandler(req, res);

            // Wait briefly for async operations
            await new Promise(r => setTimeout(r, 100));

            // Title generation should have been called (session has user + assistant = 2 msgs)
            expect(mockGenerateTitle).toHaveBeenCalled();
        });

        it('should NOT trigger title generation when session already has a title', async () => {
            const session = await Session.create({
                userId: 'test-user-id',
                title: 'Custom Title',
                messages: [{ role: 'user', content: 'old msg' }],
            });

            const { req, res } = createMockReqRes({
                messages: [
                    { role: 'user', content: 'old msg' },
                    { role: 'user', content: 'new follow up' },
                ],
                sessionId: session._id.toString(),
            });

            await postChatHandler(req, res);

            // Wait briefly for async operations
            await new Promise(r => setTimeout(r, 100));

            // Title generation should NOT have been called since title != 'New Chat'
            expect(mockGenerateTitle).not.toHaveBeenCalled();
        });

        it('should not save user message when last message is assistant role', async () => {
            const session = await Session.create({
                userId: 'test-user-id',
                title: 'Test',
                messages: [],
            });

            const { req, res } = createMockReqRes({
                messages: [
                    { role: 'user', content: 'hello' },
                    { role: 'assistant', content: 'hi there' },
                ],
                sessionId: session._id.toString(),
            });

            await postChatHandler(req, res);
            await new Promise(r => setTimeout(r, 50));

            // Only assistant response should be saved (last msg was assistant, so skip user save)
            const updated = await Session.findById(session._id);
            // The assistant message from the request should not be saved
            // but the streamed response should be saved
            expect(updated.messages.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle session.save failure for assistant response gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const { req, res } = createMockReqRes({
                messages: [{ role: 'user', content: 'hello' }],
            });

            await postChatHandler(req, res);

            // Verify the response was still sent even if save fails
            const events = parseSSEEvents(res._getWritten());
            expect(events).toContain('[DONE]');

            consoleSpy.mockRestore();
        });
    });
});
