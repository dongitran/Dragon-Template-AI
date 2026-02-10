/**
 * Sessions Routes — Unit Tests
 *
 * Tests CRUD operations, auth protection, ownership validation, and pagination.
 * Uses in-memory MongoDB for realistic testing.
 */
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// Mock auth middleware
jest.mock('../../src/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-test-user'] || 'test-user-id' };
    next();
});

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
    await mongoose.connection.db.dropDatabase();
});

const sessionRoutes = require('../../src/routes/sessions');
const Session = require('../../src/models/Session');

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionRoutes);
    return app;
}

describe('Sessions Routes', () => {
    let app;

    beforeEach(() => {
        app = createApp();
    });

    // ─── POST /api/sessions ───

    describe('POST /api/sessions', () => {
        it('should create a new session', async () => {
            const res = await request(app)
                .post('/api/sessions')
                .send({});

            expect(res.status).toBe(201);
            expect(res.body.id).toBeDefined();
            expect(res.body.title).toBe('New Chat');
            expect(res.body.messages).toEqual([]);
        });

        it('should create a session with custom title', async () => {
            const res = await request(app)
                .post('/api/sessions')
                .send({ title: 'My Chat', model: 'google/gemini-2.5-flash' });

            expect(res.status).toBe(201);
            expect(res.body.title).toBe('My Chat');
            expect(res.body.model).toBe('google/gemini-2.5-flash');
        });
    });

    // ─── GET /api/sessions ───

    describe('GET /api/sessions', () => {
        it('should return empty list when no sessions', async () => {
            const res = await request(app)
                .get('/api/sessions');

            expect(res.status).toBe(200);
            expect(res.body.sessions).toEqual([]);
            expect(res.body.pagination.total).toBe(0);
        });

        it('should list sessions for current user only', async () => {
            // Create sessions for two users
            await Session.create({ userId: 'test-user-id', title: 'My Chat' });
            await Session.create({ userId: 'other-user', title: 'Other Chat' });

            const res = await request(app)
                .get('/api/sessions');

            expect(res.status).toBe(200);
            expect(res.body.sessions).toHaveLength(1);
            expect(res.body.sessions[0].title).toBe('My Chat');
        });

        it('should sort by updatedAt descending', async () => {
            const s1 = await Session.create({ userId: 'test-user-id', title: 'Old' });
            await new Promise(r => setTimeout(r, 10));
            const s2 = await Session.create({ userId: 'test-user-id', title: 'New' });

            const res = await request(app)
                .get('/api/sessions');

            expect(res.body.sessions[0].title).toBe('New');
            expect(res.body.sessions[1].title).toBe('Old');
        });

        it('should support pagination', async () => {
            // Create 5 sessions
            for (let i = 0; i < 5; i++) {
                await Session.create({ userId: 'test-user-id', title: `Chat ${i}` });
            }

            const res = await request(app)
                .get('/api/sessions?page=1&limit=2');

            expect(res.status).toBe(200);
            expect(res.body.sessions).toHaveLength(2);
            expect(res.body.pagination).toEqual({
                page: 1,
                limit: 2,
                total: 5,
                pages: 3,
            });
        });

        it('should not include message content in list', async () => {
            await Session.create({
                userId: 'test-user-id',
                messages: [{ role: 'user', content: 'Secret message' }],
            });

            const res = await request(app)
                .get('/api/sessions');

            expect(res.body.sessions[0].messages).toBeUndefined();
        });
    });

    // ─── GET /api/sessions/:id ───

    describe('GET /api/sessions/:id', () => {
        it('should get session with messages', async () => {
            const session = await Session.create({
                userId: 'test-user-id',
                title: 'Test Chat',
                messages: [
                    { role: 'user', content: 'Hello' },
                    { role: 'assistant', content: 'Hi there!' },
                ],
            });

            const res = await request(app)
                .get(`/api/sessions/${session._id}`);

            expect(res.status).toBe(200);
            expect(res.body.title).toBe('Test Chat');
            expect(res.body.messages).toHaveLength(2);
            expect(res.body.messages[0].role).toBe('user');
            expect(res.body.messages[0].content).toBe('Hello');
        });

        it('should return 404 for non-existent session', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get(`/api/sessions/${fakeId}`);

            expect(res.status).toBe(404);
        });

        it('should return 404 for invalid ObjectId', async () => {
            const res = await request(app)
                .get('/api/sessions/invalid-id');

            expect(res.status).toBe(404);
        });

        it('should not allow access to other user\'s session', async () => {
            const session = await Session.create({
                userId: 'other-user',
                title: 'Private Chat',
            });

            const res = await request(app)
                .get(`/api/sessions/${session._id}`);

            expect(res.status).toBe(404);
        });
    });

    // ─── PATCH /api/sessions/:id ───

    describe('PATCH /api/sessions/:id', () => {
        it('should rename a session', async () => {
            const session = await Session.create({
                userId: 'test-user-id',
                title: 'Old Title',
            });

            const res = await request(app)
                .patch(`/api/sessions/${session._id}`)
                .send({ title: 'New Title' });

            expect(res.status).toBe(200);
            expect(res.body.title).toBe('New Title');
        });

        it('should return 400 for empty title', async () => {
            const session = await Session.create({
                userId: 'test-user-id',
            });

            const res = await request(app)
                .patch(`/api/sessions/${session._id}`)
                .send({ title: '' });

            expect(res.status).toBe(400);
        });

        it('should return 400 for missing title', async () => {
            const session = await Session.create({
                userId: 'test-user-id',
            });

            const res = await request(app)
                .patch(`/api/sessions/${session._id}`)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should return 404 for other user\'s session', async () => {
            const session = await Session.create({
                userId: 'other-user',
            });

            const res = await request(app)
                .patch(`/api/sessions/${session._id}`)
                .send({ title: 'Hacked' });

            expect(res.status).toBe(404);
        });

        it('should return 404 for invalid ObjectId', async () => {
            const res = await request(app)
                .patch('/api/sessions/invalid-id')
                .send({ title: 'New' });

            expect(res.status).toBe(404);
        });

        it('should trim whitespace from title', async () => {
            const session = await Session.create({
                userId: 'test-user-id',
            });

            const res = await request(app)
                .patch(`/api/sessions/${session._id}`)
                .send({ title: '  Trimmed Title  ' });

            expect(res.body.title).toBe('Trimmed Title');
        });
    });

    // ─── DELETE /api/sessions/:id ───

    describe('DELETE /api/sessions/:id', () => {
        it('should delete a session', async () => {
            const session = await Session.create({
                userId: 'test-user-id',
            });

            const res = await request(app)
                .delete(`/api/sessions/${session._id}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const check = await Session.findById(session._id);
            expect(check).toBeNull();
        });

        it('should return 404 for non-existent session', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/sessions/${fakeId}`);

            expect(res.status).toBe(404);
        });

        it('should not delete other user\'s session', async () => {
            const session = await Session.create({
                userId: 'other-user',
            });

            const res = await request(app)
                .delete(`/api/sessions/${session._id}`);

            expect(res.status).toBe(404);

            // Verify it still exists
            const check = await Session.findById(session._id);
            expect(check).not.toBeNull();
        });

        it('should return 404 for invalid ObjectId', async () => {
            const res = await request(app)
                .delete('/api/sessions/invalid-id');

            expect(res.status).toBe(404);
        });
    });

    // ─── Internal Server Error Coverage ───

    describe('Internal server errors (500)', () => {
        it('POST should return 500 when Session.create throws', async () => {
            const spy = jest.spyOn(Session, 'create').mockRejectedValueOnce(new Error('DB gone'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const res = await request(app)
                .post('/api/sessions')
                .send({});

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to create session');

            spy.mockRestore();
            consoleSpy.mockRestore();
        });

        it('GET list should return 500 when Session.find throws', async () => {
            const spy = jest.spyOn(Session, 'find').mockReturnValue({
                select: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.reject(new Error('DB read error')) }) }) }) }),
            });
            const countSpy = jest.spyOn(Session, 'countDocuments').mockRejectedValueOnce(new Error('DB count error'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const res = await request(app)
                .get('/api/sessions');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to list sessions');

            spy.mockRestore();
            countSpy.mockRestore();
            consoleSpy.mockRestore();
        });

        it('GET by id should return 500 when Session.findOne throws non-CastError', async () => {
            const spy = jest.spyOn(Session, 'findOne').mockReturnValue({
                lean: () => Promise.reject(new Error('Unexpected error')),
            });
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const validId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get(`/api/sessions/${validId}`);

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to get session');

            spy.mockRestore();
            consoleSpy.mockRestore();
        });

        it('PATCH should return 500 when findOneAndUpdate throws non-CastError', async () => {
            const spy = jest.spyOn(Session, 'findOneAndUpdate').mockRejectedValueOnce(new Error('DB write error'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const validId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .patch(`/api/sessions/${validId}`)
                .send({ title: 'New Title' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to update session');

            spy.mockRestore();
            consoleSpy.mockRestore();
        });

        it('DELETE should return 500 when findOneAndDelete throws non-CastError', async () => {
            const spy = jest.spyOn(Session, 'findOneAndDelete').mockRejectedValueOnce(new Error('DB delete error'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const validId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/sessions/${validId}`);

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to delete session');

            spy.mockRestore();
            consoleSpy.mockRestore();
        });
    });

    // ─── Edge Cases ───

    describe('Edge cases', () => {
        it('PATCH should return 400 for non-string title', async () => {
            const session = await Session.create({
                userId: 'test-user-id',
            });

            const res = await request(app)
                .patch(`/api/sessions/${session._id}`)
                .send({ title: 123 });

            expect(res.status).toBe(400);
        });

        it('PATCH should return 400 for whitespace-only title', async () => {
            const session = await Session.create({
                userId: 'test-user-id',
            });

            const res = await request(app)
                .patch(`/api/sessions/${session._id}`)
                .send({ title: '   ' });

            expect(res.status).toBe(400);
        });

        it('GET list should clamp page and limit params', async () => {
            await Session.create({ userId: 'test-user-id', title: 'Chat 1' });

            // page=0 should be clamped to 1, limit=100 should be clamped to 50
            const res = await request(app)
                .get('/api/sessions?page=0&limit=100');

            expect(res.status).toBe(200);
            expect(res.body.pagination.page).toBe(1);
            expect(res.body.pagination.limit).toBe(50);
        });

        it('GET list should handle negative page gracefully', async () => {
            const res = await request(app)
                .get('/api/sessions?page=-5&limit=0');

            expect(res.status).toBe(200);
            expect(res.body.pagination.page).toBe(1);
            // limit=0: parseInt('0') = 0, 0 || 20 = 20 (0 is falsy), Math.min(50, Math.max(1, 20)) = 20
            expect(res.body.pagination.limit).toBe(20);
        });

        it('POST should use default title for null title', async () => {
            const res = await request(app)
                .post('/api/sessions')
                .send({ title: null });

            expect(res.status).toBe(201);
            expect(res.body.title).toBe('New Chat');
        });

        it('GET session should include message ids and timestamps', async () => {
            const session = await Session.create({
                userId: 'test-user-id',
                messages: [{ role: 'user', content: 'Test' }],
            });

            const res = await request(app)
                .get(`/api/sessions/${session._id}`);

            expect(res.body.messages[0].id).toBeDefined();
            expect(res.body.messages[0].createdAt).toBeDefined();
        });
    });
});
