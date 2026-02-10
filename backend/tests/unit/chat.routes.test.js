const request = require('supertest');
const express = require('express');

// Mock auth middleware
jest.mock('../../src/middleware/auth', () => (req, res, next) => {
    req.user = { sub: 'test-user-id' };
    next();
});

// Mock aiProvider
jest.mock('../../src/services/aiProvider', () => ({
    getProviders: jest.fn(() => [
        {
            id: 'google',
            name: 'Google Gemini',
            models: [
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', default: true },
                { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', default: false },
            ],
        },
    ]),
    resolveModel: jest.fn((model) => {
        if (model === 'invalid-model') return null;
        return { providerId: 'google', modelId: 'gemini-2.5-flash' };
    }),
    streamChat: jest.fn(async function* () {
        yield 'Hello ';
        yield 'world!';
    }),
}));

const chatRoutes = require('../../src/routes/chat');

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/chat', chatRoutes);
    return app;
}

describe('Chat Routes', () => {
    let app;

    beforeEach(() => {
        app = createApp();
        jest.clearAllMocks();
    });

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

        // NOTE: SSE streaming response tests are verified via integration/browser testing
        // supertest cannot reliably test SSE streams with async generators
    });
});
