jest.mock('../../src/utils/keycloak');
jest.mock('../../src/utils/response');
jest.mock('../../src/services/userSync');
jest.mock('../../src/models/User');
jest.mock('../../src/middleware/auth', () => (req, res, next) => {
    if (req.headers.authorization === 'Bearer valid') {
        req.user = { sub: 'kc-123' };
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
});

const request = require('supertest');
const app = require('../../src/app');
const { requestKeycloakToken, decodeTokenPayload, createKeycloakUser } = require('../../src/utils/keycloak');
const { setAuthCookies, serializeUser } = require('../../src/utils/response');
const { syncUser } = require('../../src/services/userSync');
const User = require('../../src/models/User');

describe('POST /api/auth/login', () => {
    afterEach(() => jest.clearAllMocks());

    it('should return 400 if username is missing', async () => {
        const res = await request(app).post('/api/auth/login').send({ password: 'test' });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('required');
    });

    it('should return 400 if password is missing', async () => {
        const res = await request(app).post('/api/auth/login').send({ username: 'test' });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('required');
    });

    it('should return 401 for invalid credentials', async () => {
        const error = new Error('Unauthorized');
        error.response = { status: 401 };
        requestKeycloakToken.mockRejectedValue(error);

        const res = await request(app).post('/api/auth/login').send({ username: 'bad', password: 'bad' });
        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Invalid');
    });

    it('should return 500 for unexpected errors', async () => {
        requestKeycloakToken.mockRejectedValue(new Error('Connection refused'));

        const res = await request(app).post('/api/auth/login').send({ username: 'u', password: 'p' });
        expect(res.status).toBe(500);
    });

    it('should login successfully and set cookies', async () => {
        const tokenData = { access_token: 'at', refresh_token: 'rt', expires_in: 300 };
        requestKeycloakToken.mockResolvedValue(tokenData);
        decodeTokenPayload.mockReturnValue({ sub: 'kc-1', email: 'test@test.com' });
        syncUser.mockResolvedValue({ _id: 'u1', email: 'test@test.com', displayName: 'Test' });
        serializeUser.mockReturnValue({ id: 'u1', email: 'test@test.com', displayName: 'Test' });
        setAuthCookies.mockImplementation(() => { });

        const res = await request(app).post('/api/auth/login').send({ username: 'testuser', password: 'pass' });

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe('test@test.com');
        expect(res.body.expiresIn).toBe(300);
        expect(setAuthCookies).toHaveBeenCalled();
    });
});

describe('POST /api/auth/register', () => {
    afterEach(() => jest.clearAllMocks());

    it('should return 400 if required fields are missing', async () => {
        const res = await request(app).post('/api/auth/register').send({ username: 'only' });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('required');
    });

    it('should return 409 for duplicate user (Keycloak 409)', async () => {
        const adminToken = { access_token: 'admin-at' };
        requestKeycloakToken.mockResolvedValueOnce(adminToken);

        const error = new Error('Conflict');
        error.response = { status: 409 };
        createKeycloakUser.mockRejectedValue(error);

        const res = await request(app).post('/api/auth/register').send({
            username: 'dup', email: 'dup@test.com', password: 'pass123',
        });
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('already exists');
    });

    it('should return 409 for duplicate user (Keycloak 403)', async () => {
        const adminToken = { access_token: 'admin-at' };
        requestKeycloakToken.mockResolvedValueOnce(adminToken);

        const error = new Error('Forbidden');
        error.response = { status: 403, data: { error: 'unknown_error' } };
        createKeycloakUser.mockRejectedValue(error);

        const res = await request(app).post('/api/auth/register').send({
            username: 'dup', email: 'dup@test.com', password: 'pass123',
        });
        expect(res.status).toBe(409);
    });

    it('should register successfully and auto-login', async () => {
        const adminToken = { access_token: 'admin-at' };
        const loginToken = { access_token: 'login-at', refresh_token: 'rt', expires_in: 300 };
        requestKeycloakToken
            .mockResolvedValueOnce(adminToken)    // client_credentials
            .mockResolvedValueOnce(loginToken);   // password grant
        createKeycloakUser.mockResolvedValue();
        decodeTokenPayload.mockReturnValue({ sub: 'kc-new' });
        syncUser.mockResolvedValue({ _id: 'u2', email: 'new@test.com', displayName: 'New' });
        serializeUser.mockReturnValue({ id: 'u2', email: 'new@test.com', displayName: 'New' });
        setAuthCookies.mockImplementation(() => { });

        const res = await request(app).post('/api/auth/register').send({
            username: 'newuser', email: 'new@test.com', password: 'pass123',
        });

        expect(res.status).toBe(201);
        expect(res.body.user.email).toBe('new@test.com');
        expect(createKeycloakUser).toHaveBeenCalledWith('admin-at', expect.objectContaining({
            username: 'newuser', email: 'new@test.com', enabled: true,
        }));
    });

    it('should return 500 for unexpected registration errors', async () => {
        requestKeycloakToken.mockRejectedValue(new Error('Keycloak down'));

        const res = await request(app).post('/api/auth/register').send({
            username: 'u', email: 'e@e.com', password: 'p',
        });
        expect(res.status).toBe(500);
    });
});

describe('POST /api/auth/refresh', () => {
    afterEach(() => jest.clearAllMocks());

    it('should return 401 if no refresh token cookie', async () => {
        const res = await request(app).post('/api/auth/refresh');
        expect(res.status).toBe(401);
        expect(res.body.error).toContain('refresh token');
    });

    it('should refresh tokens with valid cookie', async () => {
        const tokenData = { access_token: 'new-at', refresh_token: 'new-rt', expires_in: 300 };
        requestKeycloakToken.mockResolvedValue(tokenData);
        setAuthCookies.mockImplementation(() => { });

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', 'refresh_token=old-rt');

        expect(res.status).toBe(200);
        expect(res.body.expiresIn).toBe(300);
    });

    it('should clear cookies and return 401 if refresh fails', async () => {
        requestKeycloakToken.mockRejectedValue(new Error('Invalid grant'));

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', 'refresh_token=expired-rt');

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('refresh failed');
    });
});

describe('GET /api/auth/me', () => {
    afterEach(() => jest.clearAllMocks());

    it('should return 401 without auth', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });

    it('should return user profile with valid auth', async () => {
        const mockUser = {
            _id: 'u1', email: 'test@test.com', displayName: 'Test',
            keycloakId: 'kc-123', lastLoginAt: new Date(), createdAt: new Date(),
        };
        User.findOne.mockResolvedValue(mockUser);
        serializeUser.mockReturnValue({ id: 'u1', email: 'test@test.com', displayName: 'Test' });

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer valid');

        expect(res.status).toBe(200);
        expect(res.body.email).toBe('test@test.com');
        expect(res.body.lastLoginAt).toBeTruthy();
    });

    it('should return 404 if user not found in MongoDB', async () => {
        User.findOne.mockResolvedValue(null);

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer valid');

        expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
        User.findOne.mockRejectedValue(new Error('DB connection lost'));

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer valid');

        expect(res.status).toBe(500);
    });
});

describe('POST /api/auth/logout', () => {
    it('should clear cookies and return success', async () => {
        const res = await request(app).post('/api/auth/logout');
        expect(res.status).toBe(200);
        expect(res.body.message).toContain('Logged out');
    });
});
