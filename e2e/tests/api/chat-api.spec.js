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
 *  8. POST /api/chat — should return 404 for non-existent sessionId
 *  9. POST /api/chat — should return 404 for malformed sessionId format
 * 10. POST /api/chat — should reject message with empty content (400)
 * 11. POST /api/chat — should support multi-turn conversation in same session
 * 12. POST /api/chat — should include all required SSE event types in response
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

        // Should have at least: sessionId event + 1 chunk + [DONE]
        expect(lines.length).toBeGreaterThanOrEqual(3);
        expect(lines[lines.length - 1]).toBe('data: [DONE]');

        // First event should be sessionId (Phase 6 change)
        const firstEvent = JSON.parse(lines[0].replace('data: ', ''));
        expect(firstEvent).toHaveProperty('sessionId');
        expect(firstEvent.sessionId).toMatch(/^[a-f0-9]{24}$/);

        // Subsequent events should contain chunk data
        const chunkLine = lines.find(l => {
            try {
                const parsed = JSON.parse(l.replace('data: ', ''));
                return parsed.chunk;
            } catch { return false; }
        });
        expect(chunkLine).toBeDefined();
        const parsed = JSON.parse(chunkLine.replace('data: ', ''));
        expect(typeof parsed.chunk).toBe('string');
    });

    test('should return 404 for non-existent sessionId', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);

        const res = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {
                messages: [{ role: 'user', content: 'hello' }],
                sessionId: '000000000000000000000000',
            },
        });
        expect(res.status()).toBe(404);
        const body = await res.json();
        expect(body.error).toContain('Session not found');
    });

    test('should return 404 for malformed sessionId format', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);

        const res = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {
                messages: [{ role: 'user', content: 'hello' }],
                sessionId: 'not-a-valid-objectid',
            },
        });
        expect(res.status()).toBe(404);
    });

    test('should reject message with empty content (400)', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);

        const res = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {
                messages: [{ role: 'user', content: '' }],
            },
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('content');
    });

    test('should support multi-turn conversation in same session', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);

        // First message — creates session
        const res1 = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {
                messages: [{ role: 'user', content: 'Say exactly: hello' }],
            },
        });
        expect(res1.status()).toBe(200);
        const events1 = (await res1.text()).split('\n').filter(l => l.startsWith('data: '));
        const { sessionId } = JSON.parse(events1[0].replace('data: ', ''));
        expect(sessionId).toBeDefined();

        // Wait for async save
        await new Promise(r => setTimeout(r, 1500));

        // Second message — continue session
        const res2 = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {
                messages: [
                    { role: 'user', content: 'Say exactly: hello' },
                    { role: 'assistant', content: 'hello' },
                    { role: 'user', content: 'Say exactly: world' },
                ],
                sessionId,
            },
        });
        expect(res2.status()).toBe(200);
        const events2 = (await res2.text()).split('\n').filter(l => l.startsWith('data: '));
        // Should return same sessionId
        const session2 = JSON.parse(events2[0].replace('data: ', ''));
        expect(session2.sessionId).toBe(sessionId);

        // Wait for async save
        await new Promise(r => setTimeout(r, 1500));

        // Verify session has all messages accumulated
        const getRes = await request.get(`${API_BASE}/api/sessions/${sessionId}`, {
            headers: { Cookie: cookies },
        });
        const sessionData = await getRes.json();
        // At least 4 messages: user1, assistant1, user2, assistant2
        expect(sessionData.messages.length).toBeGreaterThanOrEqual(4);
    });

    test('should include all required SSE event types in response', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);

        const res = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {
                messages: [{ role: 'user', content: 'Say exactly: test' }],
            },
        });

        const body = await res.text();
        const dataLines = body.split('\n').filter(l => l.startsWith('data: '));

        // Must have: sessionId event, at least 1 chunk, [DONE]
        expect(dataLines.length).toBeGreaterThanOrEqual(3);

        // Event 1: sessionId
        const sessionEvent = JSON.parse(dataLines[0].replace('data: ', ''));
        expect(sessionEvent).toHaveProperty('sessionId');
        expect(typeof sessionEvent.sessionId).toBe('string');

        // Middle events: chunks (at least one)
        const chunkEvents = dataLines.slice(1, -1).map(l => {
            try { return JSON.parse(l.replace('data: ', '')); }
            catch { return null; }
        }).filter(e => e && e.chunk);
        expect(chunkEvents.length).toBeGreaterThan(0);
        chunkEvents.forEach(e => {
            expect(typeof e.chunk).toBe('string');
            expect(e.chunk.length).toBeGreaterThan(0);
        });

        // Last event: [DONE]
        expect(dataLines[dataLines.length - 1]).toBe('data: [DONE]');
    });
});
