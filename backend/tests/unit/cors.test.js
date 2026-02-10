const request = require('supertest');

// Set CORS_ORIGIN before importing app (app.js reads it at import time)
process.env.CORS_ORIGIN = 'http://localhost:5173';

const app = require('../../src/app');

describe('CORS Configuration', () => {
    const allowedOrigin = process.env.CORS_ORIGIN;

    it('should allow requests from configured origin', async () => {
        const res = await request(app)
            .get('/api/health')
            .set('Origin', allowedOrigin);

        expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    });

    it('should support credentials', async () => {
        const res = await request(app)
            .get('/api/health')
            .set('Origin', allowedOrigin);

        expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should not set CORS headers for disallowed origins', async () => {
        const res = await request(app)
            .get('/api/health')
            .set('Origin', 'http://evil-site.com');

        // When origin doesn't match, CORS middleware doesn't set the header
        expect(res.headers['access-control-allow-origin']).not.toBe('http://evil-site.com');
    });

    it('should handle preflight OPTIONS requests', async () => {
        const res = await request(app)
            .options('/api/auth/login')
            .set('Origin', allowedOrigin)
            .set('Access-Control-Request-Method', 'POST')
            .set('Access-Control-Request-Headers', 'Content-Type');

        expect(res.status).toBe(204);
        expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    });
});
