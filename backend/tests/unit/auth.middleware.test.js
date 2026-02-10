const jwt = require('jsonwebtoken');

// Mock jwks-rsa
jest.mock('jwks-rsa', () => {
    return jest.fn(() => ({
        getSigningKey: jest.fn((kid, callback) => {
            callback(null, {
                getPublicKey: () => 'test-public-key',
            });
        }),
    }));
});

// Mock jwt.verify at module level
jest.mock('jsonwebtoken', () => {
    const original = jest.requireActual('jsonwebtoken');
    return {
        ...original,
        verify: jest.fn(),
    };
});

// Mock keycloak utils (used by auto-refresh)
jest.mock('../../src/utils/keycloak', () => ({
    requestKeycloakToken: jest.fn(),
}));

// Mock response utils (used by auto-refresh)
jest.mock('../../src/utils/response', () => ({
    setAuthCookies: jest.fn(),
}));

const authMiddleware = require('../../src/middleware/auth');

describe('Auth Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            headers: {},
            cookies: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
        jwt.verify.mockReset();
    });

    it('should return 401 when no token is provided', async () => {
        await authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should extract token from Authorization header', async () => {
        req.headers.authorization = 'Bearer valid-token';

        jwt.verify.mockImplementation((token, getKey, options, callback) => {
            callback(null, { sub: 'user-123', email: 'test@example.com' });
        });

        await authMiddleware(req, res, next);

        expect(jwt.verify).toHaveBeenCalled();
        expect(jwt.verify.mock.calls[0][0]).toBe('valid-token');
    });

    it('should extract token from cookie when no Authorization header', async () => {
        req.cookies.access_token = 'cookie-token';

        jwt.verify.mockImplementation((token, getKey, options, callback) => {
            callback(null, { sub: 'user-123' });
        });

        await authMiddleware(req, res, next);

        expect(jwt.verify).toHaveBeenCalled();
        expect(jwt.verify.mock.calls[0][0]).toBe('cookie-token');
    });

    it('should call next and set req.user on valid token', async () => {
        req.headers.authorization = 'Bearer valid-token';
        const decodedUser = { sub: 'user-123', email: 'test@example.com' };

        jwt.verify.mockImplementation((token, getKey, options, callback) => {
            callback(null, decodedUser);
        });

        await authMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual(decodedUser);
    });

    it('should return 401 on invalid token', async () => {
        req.headers.authorization = 'Bearer invalid-token';

        jwt.verify.mockImplementation((token, getKey, options, callback) => {
            callback(new Error('invalid token'));
        });

        await authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should prefer Authorization header over cookie', async () => {
        req.headers.authorization = 'Bearer header-token';
        req.cookies.access_token = 'cookie-token';

        jwt.verify.mockImplementation((token, getKey, options, callback) => {
            callback(null, { sub: 'user-123' });
        });

        await authMiddleware(req, res, next);

        expect(jwt.verify.mock.calls[0][0]).toBe('header-token');
    });

    it('should auto-refresh expired token when refresh_token cookie exists', async () => {
        const { requestKeycloakToken } = require('../../src/utils/keycloak');
        const { setAuthCookies } = require('../../src/utils/response');

        req.cookies.access_token = 'expired-token';
        req.cookies.refresh_token = 'valid-refresh';

        const expiredError = new Error('jwt expired');
        expiredError.name = 'TokenExpiredError';

        let callCount = 0;
        jwt.verify.mockImplementation((token, getKey, options, callback) => {
            callCount++;
            if (callCount === 1) {
                // First call: expired token
                callback(expiredError);
            } else {
                // Second call: new token valid
                callback(null, { sub: 'user-123' });
            }
        });

        requestKeycloakToken.mockResolvedValue({
            access_token: 'new-at',
            refresh_token: 'new-rt',
            expires_in: 300,
        });

        await authMiddleware(req, res, next);

        expect(requestKeycloakToken).toHaveBeenCalledWith({
            grant_type: 'refresh_token',
            refresh_token: 'valid-refresh',
        });
        expect(setAuthCookies).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual({ sub: 'user-123' });
    });

    it('should auto-refresh when access_token cookie is absent but refresh_token exists', async () => {
        const { requestKeycloakToken } = require('../../src/utils/keycloak');
        const { setAuthCookies } = require('../../src/utils/response');

        // access_token cookie expired and was removed by the browser;
        // only refresh_token (30-day maxAge) remains.
        req.cookies = {
            refresh_token: 'valid-refresh',
        };

        requestKeycloakToken.mockResolvedValue({
            access_token: 'new-at',
            refresh_token: 'new-rt',
            expires_in: 300,
        });

        jwt.verify.mockImplementation((token, getKey, options, callback) => {
            callback(null, { sub: 'user-123' });
        });

        await authMiddleware(req, res, next);

        expect(requestKeycloakToken).toHaveBeenCalledWith({
            grant_type: 'refresh_token',
            refresh_token: 'valid-refresh',
        });
        expect(setAuthCookies).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual({ sub: 'user-123' });
    });

    it('should return 401 when access_token is absent and refresh_token is invalid', async () => {
        const { requestKeycloakToken } = require('../../src/utils/keycloak');

        req.cookies = {
            refresh_token: 'expired-refresh',
        };

        requestKeycloakToken.mockRejectedValue(new Error('Token expired'));

        await authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when neither access_token nor refresh_token exist', async () => {
        req.cookies = {};

        await authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
        expect(next).not.toHaveBeenCalled();
    });
});

