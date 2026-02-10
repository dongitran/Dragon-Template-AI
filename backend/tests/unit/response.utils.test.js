const { setAuthCookies, serializeUser } = require('../../src/utils/response');

describe('serializeUser', () => {
    it('should serialize user fields correctly', () => {
        const user = {
            _id: 'abc123',
            email: 'test@example.com',
            displayName: 'Test User',
            avatar: 'avatar.png',
            preferences: { theme: 'dark' },
            keycloakId: 'kc-123',
            lastLoginAt: new Date(),
        };

        const result = serializeUser(user);

        expect(result).toEqual({
            id: 'abc123',
            email: 'test@example.com',
            displayName: 'Test User',
            avatar: 'avatar.png',
            preferences: { theme: 'dark' },
        });
        // Should NOT include sensitive fields
        expect(result.keycloakId).toBeUndefined();
        expect(result.lastLoginAt).toBeUndefined();
    });

    it('should handle user with missing optional fields', () => {
        const user = { _id: 'id1', email: 'a@b.com' };
        const result = serializeUser(user);

        expect(result.id).toBe('id1');
        expect(result.email).toBe('a@b.com');
        expect(result.displayName).toBeUndefined();
        expect(result.avatar).toBeUndefined();
        expect(result.preferences).toBeUndefined();
    });
});

describe('setAuthCookies', () => {
    let mockRes;

    beforeEach(() => {
        mockRes = { cookie: jest.fn() };
    });

    it('should set access_token and refresh_token cookies', () => {
        setAuthCookies(mockRes, {
            access_token: 'at-123',
            refresh_token: 'rt-456',
            expires_in: 300,
        });

        expect(mockRes.cookie).toHaveBeenCalledTimes(2);

        expect(mockRes.cookie).toHaveBeenCalledWith('access_token', 'at-123', {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            maxAge: 300000,
        });

        expect(mockRes.cookie).toHaveBeenCalledWith('refresh_token', 'rt-456', {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });
    });

    it('should set secure flag in production', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        setAuthCookies(mockRes, {
            access_token: 'at',
            refresh_token: 'rt',
            expires_in: 60,
        });

        expect(mockRes.cookie).toHaveBeenCalledWith('access_token', 'at', expect.objectContaining({
            secure: true,
        }));

        process.env.NODE_ENV = originalEnv;
    });
});
