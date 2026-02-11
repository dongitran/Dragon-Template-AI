/**
 * Session API E2E Tests
 *
 * Comprehensive tests for the session REST API endpoints against Docker backend.
 *
 * Test cases:
 *  Auth:
 *   1. GET /api/sessions — should reject unauthenticated request (401)
 *   2. POST /api/sessions — should reject unauthenticated request (401)
 *
 *  CRUD:
 *   3. POST /api/sessions — should create a new session
 *   4. POST /api/sessions — should create session with default title
 *   5. GET /api/sessions — should list user's sessions
 *   6. GET /api/sessions — should support pagination params
 *   7. GET /api/sessions — should not include messages in list
 *   8. GET /api/sessions/:id — should get session with messages
 *   9. GET /api/sessions/:id — should return 404 for non-existent session
 *  10. GET /api/sessions/:id — should return 404 for invalid ObjectId
 *  11. PATCH /api/sessions/:id — should rename session
 *  12. PATCH /api/sessions/:id — should return 400 for empty title
 *  13. PATCH /api/sessions/:id — should return 400 for missing title
 *  14. DELETE /api/sessions/:id — should delete session
 *  15. DELETE /api/sessions/:id — should return 404 for already-deleted session
 *
 *  Chat Integration:
 *  16. POST /api/chat — should create session and return sessionId in SSE
 *  17. POST /api/chat — should save messages to session
 *  18. POST /api/chat — should continue existing session when sessionId provided
 *
 *  Full Lifecycle:
 *  19. Create → Chat → Verify messages → Rename → List → Delete → Verify gone
 *
 *  Security & Edge Cases:
 *  20. Cross-user session isolation — user B cannot access user A's session
 *  21. PATCH non-existent session — should return 404
 *  22. PATCH invalid ObjectId — should return 404
 *  23. DELETE invalid ObjectId — should return 404
 *  24. Pagination beyond range — should return empty sessions
 */
import { test, expect } from '@playwright/test';

const TEST_USERNAME = process.env.E2E_TEST_USERNAME || 'testuser';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpass123';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:3001';

/** Login and return cookies string for subsequent requests */
async function loginAndGetCookies(request) {
    const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
        data: { username: TEST_USERNAME, password: TEST_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);

    const setCookies = loginRes.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie');
    return setCookies.map(c => c.value.split(';')[0]).join('; ');
}

/** Parse SSE data events from response body text */
function parseSSEData(text) {
    return text.split('\n')
        .filter(l => l.startsWith('data: '))
        .map(l => l.replace('data: ', ''));
}

// ─── Auth ───

test.describe('Session API — Auth', () => {
    test('should reject unauthenticated GET /api/sessions', async ({ request }) => {
        const res = await request.get(`${API_BASE}/api/sessions`);
        expect(res.status()).toBe(401);
    });

    test('should reject unauthenticated POST /api/sessions', async ({ request }) => {
        const res = await request.post(`${API_BASE}/api/sessions`, {
            data: { title: 'Test' },
        });
        expect(res.status()).toBe(401);
    });
});

// ─── CRUD ───

test.describe('Session API — CRUD', () => {
    let cookies;

    test.beforeAll(async ({ request }) => {
        cookies = await loginAndGetCookies(request);
    });

    test('should create a new session with custom title', async ({ request }) => {
        const res = await request.post(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
            data: { title: 'E2E Test Session', model: 'google/gemini-2.5-flash' },
        });

        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body.id).toBeDefined();
        expect(body.id).toMatch(/^[a-f0-9]{24}$/);
        expect(body.title).toBe('E2E Test Session');
        expect(body.model).toBe('google/gemini-2.5-flash');
        expect(body.messages).toEqual([]);
    });

    test('should create session with default title when title omitted', async ({ request }) => {
        const res = await request.post(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
            data: {},
        });

        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body.title).toBe('New Chat');
    });

    test('should list sessions', async ({ request }) => {
        // Create 2 sessions
        await request.post(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
            data: { title: 'List Test 1' },
        });
        await request.post(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
            data: { title: 'List Test 2' },
        });

        const res = await request.get(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
        });

        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.sessions.length).toBeGreaterThanOrEqual(2);
        expect(body.pagination).toBeDefined();
        expect(body.pagination).toHaveProperty('page');
        expect(body.pagination).toHaveProperty('limit');
        expect(body.pagination).toHaveProperty('total');
        expect(body.pagination).toHaveProperty('pages');
    });

    test('should support pagination params', async ({ request }) => {
        const res = await request.get(`${API_BASE}/api/sessions?page=1&limit=2`, {
            headers: { Cookie: cookies },
        });

        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.sessions.length).toBeLessThanOrEqual(2);
        expect(body.pagination.page).toBe(1);
        expect(body.pagination.limit).toBe(2);
    });

    test('should not include messages in list response', async ({ request }) => {
        const res = await request.get(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
        });

        const body = await res.json();
        if (body.sessions.length > 0) {
            expect(body.sessions[0].messages).toBeUndefined();
            expect(body.sessions[0]).toHaveProperty('title');
            expect(body.sessions[0]).toHaveProperty('id');
        }
    });

    test('should get session by id with messages', async ({ request }) => {
        const createRes = await request.post(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
            data: { title: 'Get Test' },
        });
        const { id } = await createRes.json();

        const res = await request.get(`${API_BASE}/api/sessions/${id}`, {
            headers: { Cookie: cookies },
        });

        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.title).toBe('Get Test');
        expect(body.messages).toEqual([]);
        expect(body.id).toBe(id);
    });

    test('should return 404 for non-existent session', async ({ request }) => {
        const res = await request.get(`${API_BASE}/api/sessions/000000000000000000000000`, {
            headers: { Cookie: cookies },
        });
        expect(res.status()).toBe(404);
    });

    test('should return 404 for invalid ObjectId format', async ({ request }) => {
        const res = await request.get(`${API_BASE}/api/sessions/invalid-format`, {
            headers: { Cookie: cookies },
        });
        expect(res.status()).toBe(404);
    });

    test('should rename session', async ({ request }) => {
        const createRes = await request.post(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
            data: { title: 'Old Name' },
        });
        const { id } = await createRes.json();

        const res = await request.patch(`${API_BASE}/api/sessions/${id}`, {
            headers: { Cookie: cookies },
            data: { title: 'New Name' },
        });

        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.title).toBe('New Name');

        // Verify via GET
        const getRes = await request.get(`${API_BASE}/api/sessions/${id}`, {
            headers: { Cookie: cookies },
        });
        const getBody = await getRes.json();
        expect(getBody.title).toBe('New Name');
    });

    test('should return 400 when renaming with empty title', async ({ request }) => {
        const createRes = await request.post(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
            data: { title: 'Test' },
        });
        const { id } = await createRes.json();

        const res = await request.patch(`${API_BASE}/api/sessions/${id}`, {
            headers: { Cookie: cookies },
            data: { title: '' },
        });

        expect(res.status()).toBe(400);
    });

    test('should return 400 when renaming with missing title', async ({ request }) => {
        const createRes = await request.post(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
            data: { title: 'Test' },
        });
        const { id } = await createRes.json();

        const res = await request.patch(`${API_BASE}/api/sessions/${id}`, {
            headers: { Cookie: cookies },
            data: {},
        });

        expect(res.status()).toBe(400);
    });

    test('should delete session', async ({ request }) => {
        const createRes = await request.post(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
            data: { title: 'Delete Me' },
        });
        const { id } = await createRes.json();

        const res = await request.delete(`${API_BASE}/api/sessions/${id}`, {
            headers: { Cookie: cookies },
        });
        expect(res.status()).toBe(200);
        expect((await res.json()).success).toBe(true);

        // Verify it's gone
        const getRes = await request.get(`${API_BASE}/api/sessions/${id}`, {
            headers: { Cookie: cookies },
        });
        expect(getRes.status()).toBe(404);
    });

    test('should return 404 when deleting already-deleted session', async ({ request }) => {
        const createRes = await request.post(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
            data: { title: 'Double Delete' },
        });
        const { id } = await createRes.json();

        // First delete
        await request.delete(`${API_BASE}/api/sessions/${id}`, {
            headers: { Cookie: cookies },
        });

        // Second delete attempt
        const res = await request.delete(`${API_BASE}/api/sessions/${id}`, {
            headers: { Cookie: cookies },
        });
        expect(res.status()).toBe(404);
    });
});

// ─── Chat Integration ───

test.describe('Session API — Chat Integration', () => {
    let cookies;

    test.beforeAll(async ({ request }) => {
        cookies = await loginAndGetCookies(request);
    });

    test('should create session and return sessionId as first SSE event', async ({ request }) => {
        const res = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {
                messages: [{ role: 'user', content: 'Hello' }],
            },
        });

        expect(res.status()).toBe(200);
        const events = parseSSEData(await res.text());

        // First event should contain sessionId
        expect(events.length).toBeGreaterThanOrEqual(2);
        const firstEvent = JSON.parse(events[0]);
        expect(firstEvent.sessionId).toBeDefined();
        expect(firstEvent.sessionId).toMatch(/^[a-f0-9]{24}$/);
    });

    test('should save messages to the new session', async ({ request }) => {
        // Send a chat message (creates new session)
        const chatRes = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {
                messages: [{ role: 'user', content: 'Save test message' }],
            },
        });

        const events = parseSSEData(await chatRes.text());
        const { sessionId } = JSON.parse(events[0]);

        // Wait a bit for async message save
        await new Promise(r => setTimeout(r, 1000));

        // Verify messages were saved
        const getRes = await request.get(`${API_BASE}/api/sessions/${sessionId}`, {
            headers: { Cookie: cookies },
        });
        expect(getRes.status()).toBe(200);
        const session = await getRes.json();
        expect(session.messages.length).toBeGreaterThanOrEqual(2); // user + assistant
        expect(session.messages[0].role).toBe('user');
        expect(session.messages[0].content).toBe('Save test message');
        expect(session.messages[1].role).toBe('assistant');
        expect(session.messages[1].content.length).toBeGreaterThan(0);
    });

    test('should continue existing session with sessionId', async ({ request }) => {
        // Create session + first message
        const chatRes = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {
                messages: [{ role: 'user', content: 'First message' }],
            },
        });
        const { sessionId } = JSON.parse(parseSSEData(await chatRes.text())[0]);

        // Wait for save
        await new Promise(r => setTimeout(r, 1000));

        // Send second message in same session
        const chatRes2 = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {
                messages: [
                    { role: 'user', content: 'First message' },
                    { role: 'assistant', content: 'Response' },
                    { role: 'user', content: 'Follow up message' },
                ],
                sessionId,
            },
        });
        expect(chatRes2.status()).toBe(200);

        // Wait for save
        await new Promise(r => setTimeout(r, 1000));

        // Verify session has accumulated messages
        const getRes = await request.get(`${API_BASE}/api/sessions/${sessionId}`, {
            headers: { Cookie: cookies },
        });
        const session = await getRes.json();
        // Should have: first user msg + assistant response + follow-up user msg + follow-up assistant response
        expect(session.messages.length).toBeGreaterThanOrEqual(3);
    });
});

// ─── Full Lifecycle ───

test.describe('Session API — Full Lifecycle', () => {
    let cookies;

    test.beforeAll(async ({ request }) => {
        cookies = await loginAndGetCookies(request);
    });

    test('complete session lifecycle: chat → verify → rename → list → delete', async ({ request }) => {
        // 1. Chat creates a new session
        const chatRes = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies },
            data: {
                messages: [{ role: 'user', content: 'Lifecycle test message' }],
            },
        });
        expect(chatRes.status()).toBe(200);
        const { sessionId } = JSON.parse(parseSSEData(await chatRes.text())[0]);
        expect(sessionId).toMatch(/^[a-f0-9]{24}$/);

        // Wait for async message save
        await new Promise(r => setTimeout(r, 1500));

        // 2. Verify messages were persisted
        const getRes = await request.get(`${API_BASE}/api/sessions/${sessionId}`, {
            headers: { Cookie: cookies },
        });
        expect(getRes.status()).toBe(200);
        const session = await getRes.json();
        expect(session.messages.length).toBeGreaterThanOrEqual(2);

        // 3. Rename the session
        const renameRes = await request.patch(`${API_BASE}/api/sessions/${sessionId}`, {
            headers: { Cookie: cookies },
            data: { title: 'Lifecycle Renamed' },
        });
        expect(renameRes.status()).toBe(200);
        expect((await renameRes.json()).title).toBe('Lifecycle Renamed');

        // 4. Verify it appears in the list
        const listRes = await request.get(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
        });
        const list = await listRes.json();
        const found = list.sessions.find(s => s.id === sessionId);
        expect(found).toBeDefined();
        expect(found.title).toBe('Lifecycle Renamed');

        // 5. Delete the session
        const delRes = await request.delete(`${API_BASE}/api/sessions/${sessionId}`, {
            headers: { Cookie: cookies },
        });
        expect(delRes.status()).toBe(200);

        // 6. Verify it's gone
        const verifyRes = await request.get(`${API_BASE}/api/sessions/${sessionId}`, {
            headers: { Cookie: cookies },
        });
        expect(verifyRes.status()).toBe(404);
    });
});

// ─── Security & Edge Cases ───

test.describe('Session API — Security & Edge Cases', () => {
    let cookies;

    test.beforeAll(async ({ request }) => {
        cookies = await loginAndGetCookies(request);
    });

    test('should not allow accessing another user\'s session', async ({ playwright, request }) => {
        // User 1 (testuser) creates a session
        const createRes = await request.post(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies },
            data: { title: 'Private Session' },
        });
        expect(createRes.status()).toBe(201);
        const { id: sessionId } = await createRes.json();

        // Register/login as a different user
        const user2Context = await playwright.request.newContext();
        const uniqueSuffix = Date.now();
        const registerRes = await user2Context.post(`${API_BASE}/api/auth/register`, {
            data: {
                username: `isolationtest${uniqueSuffix}`,
                email: `isolationtest${uniqueSuffix}@test.com`,
                password: TEST_PASSWORD,
            },
        });
        // May be 201 (new) or 409 (already exists), handle both
        if (registerRes.status() !== 201) {
            await user2Context.post(`${API_BASE}/api/auth/login`, {
                data: { username: `isolationtest${uniqueSuffix}`, password: TEST_PASSWORD },
            });
        }

        // User 2 tries to GET user 1's session → 404
        const getRes = await user2Context.get(`${API_BASE}/api/sessions/${sessionId}`);
        expect(getRes.status()).toBe(404);

        // User 2 tries to PATCH user 1's session → 404
        const patchRes = await user2Context.patch(`${API_BASE}/api/sessions/${sessionId}`, {
            data: { title: 'Hacked!' },
        });
        expect(patchRes.status()).toBe(404);

        // User 2 tries to DELETE user 1's session → 404
        const deleteRes = await user2Context.delete(`${API_BASE}/api/sessions/${sessionId}`);
        expect(deleteRes.status()).toBe(404);

        // Verify session still exists for user 1
        const verifyRes = await request.get(`${API_BASE}/api/sessions/${sessionId}`, {
            headers: { Cookie: cookies },
        });
        expect(verifyRes.status()).toBe(200);
        const verifyBody = await verifyRes.json();
        expect(verifyBody.title).toBe('Private Session');

        // Cleanup
        await request.delete(`${API_BASE}/api/sessions/${sessionId}`, {
            headers: { Cookie: cookies },
        });
        await user2Context.dispose();
    });

    test('should return 404 when patching non-existent session', async ({ request }) => {
        const res = await request.patch(`${API_BASE}/api/sessions/000000000000000000000000`, {
            headers: { Cookie: cookies },
            data: { title: 'Ghost' },
        });
        expect(res.status()).toBe(404);
    });

    test('should return 404 when patching invalid ObjectId', async ({ request }) => {
        const res = await request.patch(`${API_BASE}/api/sessions/invalid-id`, {
            headers: { Cookie: cookies },
            data: { title: 'Ghost' },
        });
        expect(res.status()).toBe(404);
    });

    test('should return 404 when deleting invalid ObjectId', async ({ request }) => {
        const res = await request.delete(`${API_BASE}/api/sessions/invalid-id`, {
            headers: { Cookie: cookies },
        });
        expect(res.status()).toBe(404);
    });

    test('should return empty sessions for page beyond range', async ({ request }) => {
        const res = await request.get(`${API_BASE}/api/sessions?page=999&limit=10`, {
            headers: { Cookie: cookies },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.sessions).toEqual([]);
        expect(body.pagination.page).toBe(999);
        expect(body.pagination.total).toBeGreaterThanOrEqual(0);
    });
});

