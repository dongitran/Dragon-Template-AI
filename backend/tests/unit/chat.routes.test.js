/**
 * Chat Routes — Unit Tests
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
 */
const request = require('supertest');
const express = require('express');

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

const chatRoutes = require('../../src/routes/chat');

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
// The POST handler is the 3rd middleware (after authMiddleware which we skip)
let postChatHandler;
{
    // Extract the handler from the router stack
    const stack = chatRoutes.stack;
    const postRoute = stack.find(layer =>
        layer.route && layer.route.path === '/' && layer.route.methods.post
    );
    // The handler is the last in the route's stack (after auth middleware)
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

        it('should return 400 when message has no content', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({ messages: [{ role: 'user' }] });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('role');
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
            const chunks = events.filter(e => e !== '[DONE]').map(e => JSON.parse(e).chunk);
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
});
