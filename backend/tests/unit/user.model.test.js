const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../src/models/User');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
    await User.deleteMany({});
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('User Model', () => {
    const validUser = {
        keycloakId: 'kc-test-001',
        email: 'test@dragon.ai',
        displayName: 'Test User',
    };

    describe('validation', () => {
        it('should create user with valid required fields', async () => {
            const user = await User.create(validUser);

            expect(user.keycloakId).toBe('kc-test-001');
            expect(user.email).toBe('test@dragon.ai');
            expect(user.displayName).toBe('Test User');
            expect(user._id).toBeTruthy();
        });

        it('should require keycloakId', async () => {
            const user = new User({ email: 'a@b.com', displayName: 'Test' });

            await expect(user.validate()).rejects.toThrow(/keycloakId/);
        });

        it('should require email', async () => {
            const user = new User({ keycloakId: 'kc-1', displayName: 'Test' });

            await expect(user.validate()).rejects.toThrow(/email/);
        });

        it('should enforce unique keycloakId', async () => {
            await User.create(validUser);

            await expect(User.create({ ...validUser }))
                .rejects.toThrow(/duplicate key|E11000/);
        });
    });

    describe('defaults', () => {
        it('should set default preferences with dark theme', async () => {
            const user = await User.create(validUser);

            expect(user.preferences).toBeDefined();
            expect(user.preferences.theme).toBe('dark');
        });

        it('should auto-generate timestamps', async () => {
            const user = await User.create(validUser);

            expect(user.createdAt).toBeInstanceOf(Date);
            expect(user.updatedAt).toBeInstanceOf(Date);
        });

        it('should have empty string avatar by default', async () => {
            const user = await User.create(validUser);

            expect(user.avatar).toBe('');
        });

        it('should have auto-generated lastLoginAt by default', async () => {
            const user = await User.create(validUser);

            expect(user.lastLoginAt).toBeInstanceOf(Date);
        });
    });

    describe('updates', () => {
        it('should update lastLoginAt', async () => {
            const user = await User.create(validUser);
            const now = new Date();

            user.lastLoginAt = now;
            await user.save();

            const updated = await User.findById(user._id);
            expect(updated.lastLoginAt.getTime()).toBe(now.getTime());
        });

        it('should update preferences', async () => {
            const user = await User.create(validUser);

            user.preferences = { theme: 'light', language: 'vi' };
            await user.save();

            const updated = await User.findById(user._id);
            expect(updated.preferences.theme).toBe('light');
            expect(updated.preferences.language).toBe('vi');
        });
    });
});
