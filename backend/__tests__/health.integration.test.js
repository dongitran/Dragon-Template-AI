const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('GET /api/health (integration)', () => {
    it('should return mongodb connected when connected to in-memory DB', async () => {
        const res = await request(app).get('/api/health');

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('dragon-backend');
        expect(res.body.mongodb).toBe('connected');
        expect(res.body).toHaveProperty('timestamp');
    });

    it('should return valid ISO timestamp', async () => {
        const res = await request(app).get('/api/health');

        const date = new Date(res.body.timestamp);
        expect(date.toISOString()).toBe(res.body.timestamp);
    });
});
