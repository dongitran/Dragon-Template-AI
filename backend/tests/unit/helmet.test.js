const request = require('supertest');
const app = require('../../src/app');

describe('Security Headers (Helmet)', () => {
    it('should set X-Content-Type-Options to nosniff', async () => {
        const res = await request(app).get('/api/health');

        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options to SAMEORIGIN', async () => {
        const res = await request(app).get('/api/health');

        // Helmet v5+ uses Content-Security-Policy frame-ancestors instead,
        // but x-frame-options may still be set for backward compat
        expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('should remove X-Powered-By header', async () => {
        const res = await request(app).get('/api/health');

        expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('should set X-DNS-Prefetch-Control', async () => {
        const res = await request(app).get('/api/health');

        expect(res.headers['x-dns-prefetch-control']).toBe('off');
    });

    it('should set X-Download-Options', async () => {
        const res = await request(app).get('/api/health');

        expect(res.headers['x-download-options']).toBe('noopen');
    });

    it('should set Content-Security-Policy header', async () => {
        const res = await request(app).get('/api/health');

        expect(res.headers['content-security-policy']).toBeTruthy();
    });

    it('should set Strict-Transport-Security header', async () => {
        const res = await request(app).get('/api/health');

        expect(res.headers['strict-transport-security']).toBeTruthy();
    });
});
