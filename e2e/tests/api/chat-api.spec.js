/**
 * Chat API E2E Tests
 *
 * Tests the chat REST API endpoints against the real Docker backend.
 *
 * Test cases:
 *  1. GET /api/chat/models — should reject unauthenticated request (401)
 *  2. GET /api/chat/models — should return providers and models
 *  3. POST /api/chat — should reject unauthenticated request (401)
 *  4. POST /api/chat — should reject missing messages (400)
 *  5. POST /api/chat — should reject invalid message role (400)
 *  6. POST /api/chat — should reject invalid model (400)
 *  7. POST /api/chat — should stream SSE response for valid message
 */
import { test, expect } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:3001';

/** Login and return cookies string for subsequent requests */
async function loginAndGetCookies(request) {
    const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
        data: { username: 'testuser', password: 'testpass123' },
    });
    expect(loginRes.status()).toBe(200);

    const setCookies = loginRes.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie');
    return setCookies.map(c => c.value.split(';')[0]).join('; ');
}

test.describe('Chat API — Models', () => {
    test('should reject unauthenticated request to /api/chat/models (401)', async ({ request }) => {
        const res = await request.get(`${API_BASE}/api/chat/models`);
        expect(res.status()).toBe(401);
    });

    test('should return providers and models', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);

        const res = await request.get(`${API_BASE}/api/chat/models`, {
            headers: { Cookie: cookies },
        });

        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.providers).toBeDefined();
        expect(Array.isArray(body.providers)).toBe(true);
        expect(body.providers.length).toBeGreaterThan(0);

        // Check structure
        const provider = body.providers[0];
        expect(provider).toHaveProperty('id');
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('models');
        expect(provider.models.length).toBeGreaterThan(0);

        const model = provider.models[0];
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
    });
});

test.describe('Chat API — Send Message', () => {
    test('should reject unauthenticated request to POST /api/chat (401)', async ({ request }) => {
        const res = await request.post(`${API_BASE}/api/chat`, {
            data: { messages: [{ role: 'user', content: 'hello' }] },
        });
        expect(res.status()).toBe(401);
    });

    test('should reject missing messages (400)', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);

        const res = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {},
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('messages');
    });

    test('should reject invalid message role (400)', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);

        const res = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: { messages: [{ role: 'system', content: 'hello' }] },
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('role');
    });

    test('should reject invalid model (400)', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);

        // Use model-only format — resolveModel returns null when not found in config
        const res = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {
                messages: [{ role: 'user', content: 'hello' }],
                model: 'nonexistent-model-xyz',
            },
        });
        expect(res.status()).toBe(400);
    });

    test('should stream SSE response for valid message', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);

        const res = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {
                messages: [{ role: 'user', content: 'Say exactly: "Hello Dragon"' }],
            },
        });

        expect(res.status()).toBe(200);

        // Check SSE Content-Type
        const contentType = res.headers()['content-type'];
        expect(contentType).toBe('text/event-stream');

        // Parse SSE body
        const body = await res.text();
        const lines = body.split('\n').filter(l => l.startsWith('data: '));

        // Should have at least one data chunk and a [DONE] marker
        expect(lines.length).toBeGreaterThanOrEqual(2);
        expect(lines[lines.length - 1]).toBe('data: [DONE]');

        // First chunks should contain valid JSON with chunk field
        const firstLine = lines[0].replace('data: ', '');
        const parsed = JSON.parse(firstLine);
        expect(parsed).toHaveProperty('chunk');
        expect(typeof parsed.chunk).toBe('string');
    });
});
