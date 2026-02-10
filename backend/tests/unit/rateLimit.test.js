const request = require('supertest');

// Force production mode to get strict rate limits (10 login, 5 register)
process.env.NODE_ENV = 'production';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const app = require('../../src/app');

describe('Rate Limiting', () => {
    describe('Login rate limiter (10 req / 15 min in production)', () => {
        it('should return 429 after exceeding login limit', async () => {
            const requests = [];

            // Send 11 requests (limit is 10 in production)
            for (let i = 0; i < 11; i++) {
                requests.push(
                    request(app)
                        .post('/api/auth/login')
                        .send({ username: 'test', password: 'test' }),
                );
            }

            const responses = await Promise.all(requests);

            // First 10 should NOT be 429
            const nonRateLimited = responses.slice(0, 10);
            nonRateLimited.forEach((res, i) => {
                expect(res.status).not.toBe(429);
            });

            // 11th request should be 429
            const lastResponse = responses[10];
            expect(lastResponse.status).toBe(429);
            expect(lastResponse.body.error).toContain('Too many login attempts');
        });

        it('should include standard rate limit headers', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'test', password: 'test' });

            // express-rate-limit v7+ uses standard headers
            expect(res.headers).toHaveProperty('ratelimit-limit');
            expect(res.headers).toHaveProperty('ratelimit-remaining');
            expect(res.headers).toHaveProperty('ratelimit-reset');
        });
    });

    describe('Register rate limiter (5 req / 1 hr in production)', () => {
        it('should return 429 after exceeding register limit', async () => {
            const requests = [];

            // Send 6 requests (limit is 5 in production)
            for (let i = 0; i < 6; i++) {
                requests.push(
                    request(app)
                        .post('/api/auth/register')
                        .send({ username: `user${i}`, email: `u${i}@test.com`, password: 'pass123' }),
                );
            }

            const responses = await Promise.all(requests);

            // First 5 should NOT be 429
            const nonRateLimited = responses.slice(0, 5);
            nonRateLimited.forEach((res) => {
                expect(res.status).not.toBe(429);
            });

            // 6th request should be 429
            const lastResponse = responses[5];
            expect(lastResponse.status).toBe(429);
            expect(lastResponse.body.error).toContain('Too many registration attempts');
        });
    });

    describe('Global rate limiter (100 req / 15 min in production)', () => {
        it('should include rate limit headers on any API request', async () => {
            const res = await request(app).get('/api/health');

            expect(res.headers).toHaveProperty('ratelimit-limit');
            expect(res.headers).toHaveProperty('ratelimit-remaining');
        });
    });

    describe('Body size limit', () => {
        it('should reject payloads larger than 10kb', async () => {
            const largePayload = { data: 'x'.repeat(20000) };

            const res = await request(app)
                .post('/api/auth/login')
                .send(largePayload);

            expect(res.status).toBe(413);
        });
    });
});
