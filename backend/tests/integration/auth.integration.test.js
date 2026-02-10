const request = require('supertest');
const db = require('../helpers/db');
const app = require('../../src/app');

beforeAll(async () => {
    await db.connect();
});

afterEach(async () => {
    await db.clearDatabase();
});

afterAll(async () => {
    await db.disconnect();
});

describe('Auth Routes', () => {
    describe('POST /api/auth/login', () => {
        it('should return 400 when username is missing', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ password: 'test' });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Username and password are required');
        });

        it('should return 400 when password is missing', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'test' });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Username and password are required');
        });
    });

    describe('POST /api/auth/register', () => {
        it('should return 400 when required fields are missing', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'test' });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Username, email, and password are required');
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('should return 401 when no refresh token cookie', async () => {
            const res = await request(app)
                .post('/api/auth/refresh');

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('No refresh token');
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return 401 when not authenticated', async () => {
            const res = await request(app)
                .get('/api/auth/me');

            expect(res.statusCode).toBe(401);
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should return success message', async () => {
            const res = await request(app)
                .post('/api/auth/logout');

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Logged out successfully');
        });
    });
});
