/**
 * Backend Auth API E2E tests.
 * Tests the REST API endpoints directly (no browser UI).
 *
 * Test cases:
 *  1. GET /api/health — should return health status with MongoDB connected
 *  2. POST /api/auth/login — should reject missing credentials (400)
 *  3. POST /api/auth/login — should reject invalid credentials (401)
 *  4. POST /api/auth/login — should login and return user + set cookies
 *  5. GET /api/auth/me — should reject unauthenticated requests (401)
 *  6. GET /api/auth/me — should return user profile with valid cookie
 *  7. GET /api/auth/me — should auto-refresh when only refresh_token cookie remains
 *  8. POST /api/auth/refresh — should reject without refresh token (401)
 *  9. POST /api/auth/refresh — should refresh tokens with valid cookie
 * 10. POST /api/auth/logout — should clear auth cookies
 * 11. POST /api/auth/register — should reject missing fields (400)
 * 12. POST /api/auth/register — should reject duplicate username (409)
 * 13. Rate limiting — should include rate limit headers on responses
 * 14. Rate limiting — should reject oversized request body (413)
 */
import { test, expect } from '@playwright/test';

const TEST_USERNAME = process.env.E2E_TEST_USERNAME || 'testuser';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpass123';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:3001';

test.describe('Health Check API', () => {
    test('should return health status with MongoDB connected', async ({ request }) => {
        const res = await request.get(`${API_BASE}/api/health`);

        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('ok');
        expect(body.service).toBe('dragon-backend');
        expect(body.mongodb).toBe('connected');
        expect(body.timestamp).toBeTruthy();
    });
});

test.describe('Auth API — Login', () => {
    test('should reject missing credentials', async ({ request }) => {
        const res = await request.post(`${API_BASE}/api/auth/login`, {
            data: {},
        });

        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('required');
    });

    test('should reject invalid credentials', async ({ request }) => {
        const res = await request.post(`${API_BASE}/api/auth/login`, {
            data: { username: 'nonexistent', password: 'wrongpassword' },
        });

        expect(res.status()).toBe(401);
        const body = await res.json();
        expect(body.error).toContain('Invalid');
    });

    test('should login and return user with cookies', async ({ request }) => {
        const res = await request.post(`${API_BASE}/api/auth/login`, {
            data: { username: TEST_USERNAME, password: TEST_PASSWORD },
        });

        expect(res.status()).toBe(200);
        const body = await res.json();

        // Verify user data
        expect(body.user).toBeTruthy();
        expect(body.user.email).toBe('test@dragon.ai');
        expect(body.user.displayName).toBe('Test User');
        expect(body.user.id).toBeTruthy();
        expect(body.expiresIn).toBeGreaterThan(0);

        // Verify cookies are set
        const cookies = res.headers()['set-cookie'];
        expect(cookies).toBeTruthy();
        expect(cookies).toContain('access_token');
        expect(cookies).toContain('refresh_token');
        expect(cookies).toContain('HttpOnly');
    });
});

test.describe('Auth API — Me', () => {
    test('should reject unauthenticated requests', async ({ request }) => {
        const res = await request.get(`${API_BASE}/api/auth/me`);

        expect(res.status()).toBe(401);
        const body = await res.json();
        expect(body.error).toBeTruthy();
    });

    test('should return user profile with valid cookie', async ({ request }) => {
        // Login first to get cookies
        const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
            data: { username: TEST_USERNAME, password: TEST_PASSWORD },
        });
        expect(loginRes.status()).toBe(200);

        // /me should work because Playwright request context persists cookies
        const meRes = await request.get(`${API_BASE}/api/auth/me`);

        expect(meRes.status()).toBe(200);
        const body = await meRes.json();
        expect(body.email).toBe('test@dragon.ai');
        expect(body.displayName).toBe('Test User');
        expect(body.lastLoginAt).toBeTruthy();
        expect(body.createdAt).toBeTruthy();
    });

    test('should return user profile when only refresh_token cookie remains', async ({ playwright }) => {
        // Login to get cookies
        const context1 = await playwright.request.newContext();
        const loginRes = await context1.post(`${API_BASE}/api/auth/login`, {
            data: { username: TEST_USERNAME, password: TEST_PASSWORD },
        });
        expect(loginRes.status()).toBe(200);

        // Extract refresh_token from Set-Cookie header
        const cookies = loginRes.headers()['set-cookie'];
        const refreshMatch = cookies.match(/refresh_token=([^;]+)/);
        expect(refreshMatch).toBeTruthy();
        const refreshToken = refreshMatch[1];

        // Create a new request context with ONLY refresh_token (no access_token)
        // This simulates a browser after access_token cookie has expired and been removed
        const context2 = await playwright.request.newContext({
            extraHTTPHeaders: {
                'Cookie': `refresh_token=${refreshToken}`,
            },
        });

        const meRes = await context2.get(`${API_BASE}/api/auth/me`);

        expect(meRes.status()).toBe(200);
        const body = await meRes.json();
        expect(body.email).toBe('test@dragon.ai');
        expect(body.displayName).toBe('Test User');

        await context1.dispose();
        await context2.dispose();
    });
});

test.describe('Auth API — Refresh', () => {
    test('should reject without refresh token', async ({ request }) => {
        const res = await request.post(`${API_BASE}/api/auth/refresh`);

        expect(res.status()).toBe(401);
        const body = await res.json();
        expect(body.error).toContain('refresh token');
    });

    test('should refresh tokens with valid cookie', async ({ request }) => {
        // Login first
        const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
            data: { username: TEST_USERNAME, password: TEST_PASSWORD },
        });
        expect(loginRes.status()).toBe(200);

        // Refresh
        const refreshRes = await request.post(`${API_BASE}/api/auth/refresh`);

        expect(refreshRes.status()).toBe(200);
        const body = await refreshRes.json();
        expect(body.expiresIn).toBeGreaterThan(0);

        // New cookies should be set
        const cookies = refreshRes.headers()['set-cookie'];
        expect(cookies).toContain('access_token');
        expect(cookies).toContain('refresh_token');
    });
});

test.describe('Auth API — Logout', () => {
    test('should clear auth cookies', async ({ request }) => {
        // Login first
        await request.post(`${API_BASE}/api/auth/login`, {
            data: { username: TEST_USERNAME, password: TEST_PASSWORD },
        });

        // Logout
        const logoutRes = await request.post(`${API_BASE}/api/auth/logout`);

        expect(logoutRes.status()).toBe(200);
        const body = await logoutRes.json();
        expect(body.message).toContain('Logged out');

        // /me should now fail
        const meRes = await request.get(`${API_BASE}/api/auth/me`);
        expect(meRes.status()).toBe(401);
    });
});

test.describe('Auth API — Register', () => {
    test('should reject missing fields', async ({ request }) => {
        const res = await request.post(`${API_BASE}/api/auth/register`, {
            data: { username: 'newuser' },
        });

        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('required');
    });

    test('should reject duplicate username', async ({ request }) => {
        const res = await request.post(`${API_BASE}/api/auth/register`, {
            data: {
                username: TEST_USERNAME,
                email: 'duplicate@dragon.ai',
                password: TEST_PASSWORD,
            },
        });

        expect(res.status()).toBe(409);
        const body = await res.json();
        expect(body.error).toContain('already exists');
    });
});

test.describe('Rate Limiting', () => {
    test('should include rate limit headers on responses', async ({ request }) => {
        const res = await request.get(`${API_BASE}/api/health`);

        expect(res.status()).toBe(200);
        const headers = res.headers();
        expect(headers['ratelimit-limit']).toBeTruthy();
        expect(headers['ratelimit-remaining']).toBeTruthy();
        expect(headers['ratelimit-reset']).toBeTruthy();
    });

    test('should reject oversized request body', async ({ request }) => {
        // express.json limit is 5MB, send 6MB to trigger 413
        const largePayload = { data: 'x'.repeat(6 * 1024 * 1024) };

        const res = await request.post(`${API_BASE}/api/auth/login`, {
            data: largePayload,
        });

        expect(res.status()).toBe(413);
    });
});
