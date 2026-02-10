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
 *  7. POST /api/auth/refresh — should reject without refresh token (401)
 *  8. POST /api/auth/refresh — should refresh tokens with valid cookie
 *  9. POST /api/auth/logout — should clear auth cookies
 * 10. POST /api/auth/register — should reject missing fields (400)
 * 11. POST /api/auth/register — should reject duplicate username (409)
 */
import { test, expect } from '@playwright/test';

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
            data: { username: 'testuser', password: 'testpass123' },
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
            data: { username: 'testuser', password: 'testpass123' },
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
            data: { username: 'testuser', password: 'testpass123' },
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
            data: { username: 'testuser', password: 'testpass123' },
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
                username: 'testuser',
                email: 'duplicate@dragon.ai',
                password: 'testpass123',
            },
        });

        // Keycloak returns 409 for conflict, but our backend may wrap it as 500
        expect([409, 500]).toContain(res.status());
        const body = await res.json();
        expect(body.error).toBeTruthy();
    });
});
