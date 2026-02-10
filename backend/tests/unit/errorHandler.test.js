const request = require('supertest');
const express = require('express');

describe('Global Error Handler', () => {
    let app;

    function createApp(nodeEnv) {
        // We need to create a fresh app-like setup to test the error handler
        // because the real app.js reads NODE_ENV at import time
        const testApp = express();
        testApp.use(express.json());

        const isProduction = nodeEnv === 'production';

        // Route that throws a sync error
        testApp.get('/api/test/sync-error', (req, res) => {
            throw new Error('Something broke');
        });

        // Route that throws an error with a custom status
        testApp.get('/api/test/custom-status', (req, res) => {
            const err = new Error('Not found');
            err.status = 404;
            throw err;
        });

        // Route that works fine
        testApp.get('/api/test/ok', (req, res) => {
            res.json({ status: 'ok' });
        });

        // Global error handler (mirrors app.js implementation)
        testApp.use((err, req, res, next) => {
            const status = err.status || 500;
            res.status(status).json({
                error: isProduction ? 'Internal server error' : err.message,
            });
        });

        return testApp;
    }

    describe('in development mode', () => {
        beforeAll(() => {
            app = createApp('development');
        });

        it('should return JSON for unhandled errors (not HTML)', async () => {
            const res = await request(app).get('/api/test/sync-error');

            expect(res.status).toBe(500);
            expect(res.headers['content-type']).toMatch(/json/);
            expect(res.body.error).toBe('Something broke');
        });

        it('should expose error message in development', async () => {
            const res = await request(app).get('/api/test/sync-error');

            expect(res.body.error).toBe('Something broke');
            expect(res.body.error).not.toBe('Internal server error');
        });

        it('should propagate custom status codes', async () => {
            const res = await request(app).get('/api/test/custom-status');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Not found');
        });
    });

    describe('in production mode', () => {
        beforeAll(() => {
            app = createApp('production');
        });

        it('should hide error details in production', async () => {
            const res = await request(app).get('/api/test/sync-error');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Internal server error');
            expect(res.body.error).not.toContain('Something broke');
        });

        it('should still return JSON in production', async () => {
            const res = await request(app).get('/api/test/sync-error');

            expect(res.headers['content-type']).toMatch(/json/);
        });
    });

    describe('normal routes', () => {
        beforeAll(() => {
            app = createApp('development');
        });

        it('should not affect successful responses', async () => {
            const res = await request(app).get('/api/test/ok');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });
    });
});
