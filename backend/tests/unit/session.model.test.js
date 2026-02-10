/**
 * Session Model — Unit Tests
 *
 * Tests schema validation, defaults, and embedded messages.
 */
const mongoose = require('mongoose');

// Use in-memory MongoDB for testing
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

const Session = require('../../src/models/Session');

describe('Session Model', () => {
    it('should create a session with required fields', async () => {
        const session = await Session.create({
            userId: 'user-123',
        });

        expect(session.userId).toBe('user-123');
        expect(session.title).toBe('New Chat');
        expect(session.model).toBe('');
        expect(session.messages).toEqual([]);
        expect(session.createdAt).toBeInstanceOf(Date);
        expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('should require userId', async () => {
        await expect(Session.create({}))
            .rejects.toThrow(/userId.*required/i);
    });

    it('should store title and model', async () => {
        const session = await Session.create({
            userId: 'user-123',
            title: 'Test Session',
            model: 'google/gemini-2.5-flash',
        });

        expect(session.title).toBe('Test Session');
        expect(session.model).toBe('google/gemini-2.5-flash');
    });

    it('should embed messages with role and content', async () => {
        const session = await Session.create({
            userId: 'user-123',
            messages: [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' },
            ],
        });

        expect(session.messages).toHaveLength(2);
        expect(session.messages[0].role).toBe('user');
        expect(session.messages[0].content).toBe('Hello');
        expect(session.messages[0].createdAt).toBeInstanceOf(Date);
        expect(session.messages[1].role).toBe('assistant');
    });

    it('should validate message role enum', async () => {
        await expect(
            Session.create({
                userId: 'user-123',
                messages: [{ role: 'system', content: 'test' }],
            })
        ).rejects.toThrow();
    });

    it('should require message content', async () => {
        await expect(
            Session.create({
                userId: 'user-123',
                messages: [{ role: 'user' }],
            })
        ).rejects.toThrow();
    });

    it('should require message role', async () => {
        await expect(
            Session.create({
                userId: 'user-123',
                messages: [{ content: 'test' }],
            })
        ).rejects.toThrow();
    });

    it('should push messages to existing session', async () => {
        const session = await Session.create({
            userId: 'user-123',
        });

        session.messages.push({ role: 'user', content: 'First message' });
        await session.save();

        const saved = await Session.findById(session._id);
        expect(saved.messages).toHaveLength(1);
        expect(saved.messages[0].content).toBe('First message');
    });

    it('should sort by updatedAt with compound index', async () => {
        await Session.create({ userId: 'user-123', title: 'Old' });
        await new Promise(r => setTimeout(r, 10)); // Ensure different timestamps
        await Session.create({ userId: 'user-123', title: 'New' });

        const sessions = await Session.find({ userId: 'user-123' })
            .sort({ updatedAt: -1 });

        expect(sessions[0].title).toBe('New');
        expect(sessions[1].title).toBe('Old');
    });
});
