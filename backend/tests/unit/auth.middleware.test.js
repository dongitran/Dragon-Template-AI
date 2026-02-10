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

    it('should return 401 when no token is provided', () => {
        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should extract token from Authorization header', () => {
        req.headers.authorization = 'Bearer valid-token';

        jwt.verify.mockImplementation((token, getKey, options, callback) => {
            callback(null, { sub: 'user-123', email: 'test@example.com' });
        });

        authMiddleware(req, res, next);

        expect(jwt.verify).toHaveBeenCalled();
        expect(jwt.verify.mock.calls[0][0]).toBe('valid-token');
    });

    it('should extract token from cookie when no Authorization header', () => {
        req.cookies.access_token = 'cookie-token';

        jwt.verify.mockImplementation((token, getKey, options, callback) => {
            callback(null, { sub: 'user-123' });
        });

        authMiddleware(req, res, next);

        expect(jwt.verify).toHaveBeenCalled();
        expect(jwt.verify.mock.calls[0][0]).toBe('cookie-token');
    });

    it('should call next and set req.user on valid token', () => {
        req.headers.authorization = 'Bearer valid-token';
        const decodedUser = { sub: 'user-123', email: 'test@example.com' };

        jwt.verify.mockImplementation((token, getKey, options, callback) => {
            callback(null, decodedUser);
        });

        authMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual(decodedUser);
    });

    it('should return 401 on invalid token', () => {
        req.headers.authorization = 'Bearer invalid-token';

        jwt.verify.mockImplementation((token, getKey, options, callback) => {
            callback(new Error('invalid token'));
        });

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should prefer Authorization header over cookie', () => {
        req.headers.authorization = 'Bearer header-token';
        req.cookies.access_token = 'cookie-token';

        jwt.verify.mockImplementation((token, getKey, options, callback) => {
            callback(null, { sub: 'user-123' });
        });

        authMiddleware(req, res, next);

        expect(jwt.verify.mock.calls[0][0]).toBe('header-token');
    });
});
