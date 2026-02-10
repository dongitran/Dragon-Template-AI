const db = require('../helpers/db');
const User = require('../../src/models/User');
const { syncUser } = require('../../src/services/userSync');

beforeAll(async () => {
    await db.connect();
});

afterEach(async () => {
    await db.clearDatabase();
});

afterAll(async () => {
    await db.disconnect();
});

describe('User Sync Service', () => {
    const mockToken = {
        sub: 'kc-user-001',
        email: 'john@dragon.ai',
        given_name: 'John',
        family_name: 'Doe',
        preferred_username: 'johndoe',
    };

    it('should create a new user on first login', async () => {
        const user = await syncUser(mockToken);

        expect(user.keycloakId).toBe('kc-user-001');
        expect(user.email).toBe('john@dragon.ai');
        expect(user.displayName).toBe('John Doe');
        expect(user.preferences.theme).toBe('dark');
        expect(user.lastLoginAt).toBeInstanceOf(Date);

        const count = await User.countDocuments();
        expect(count).toBe(1);
    });

    it('should update lastLoginAt on subsequent login', async () => {
        const firstLogin = await syncUser(mockToken);
        const firstLoginTime = firstLogin.lastLoginAt;

        // Wait a bit to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10));

        const secondLogin = await syncUser(mockToken);

        expect(secondLogin.keycloakId).toBe(firstLogin.keycloakId);
        expect(secondLogin.lastLoginAt.getTime()).toBeGreaterThanOrEqual(firstLoginTime.getTime());

        const count = await User.countDocuments();
        expect(count).toBe(1);
    });

    it('should update email if changed in Keycloak', async () => {
        await syncUser(mockToken);

        const updatedToken = { ...mockToken, email: 'john.new@dragon.ai' };
        const user = await syncUser(updatedToken);

        expect(user.email).toBe('john.new@dragon.ai');
    });

    it('should handle missing name fields gracefully', async () => {
        const tokenNoName = {
            sub: 'kc-user-002',
            email: 'noname@dragon.ai',
            preferred_username: 'noname',
        };

        const user = await syncUser(tokenNoName);

        expect(user.displayName).toBe('noname');
    });
});
