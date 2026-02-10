const request = require('supertest');
const app = require('../../src/app');

describe('GET /api/health', () => {
    it('should return status ok', async () => {
        const res = await request(app).get('/api/health');

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('dragon-backend');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('mongodb');
    });

    it('should return disconnected mongodb when not connected', async () => {
        const res = await request(app).get('/api/health');

        expect(res.body.mongodb).toBe('disconnected');
    });
});
