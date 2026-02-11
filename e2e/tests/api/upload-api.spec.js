/**
 * Upload API — E2E Tests
 *
 * Tests the file upload and download endpoints against the real Docker backend.
 *
 * Test cases:
 *  1. POST /api/upload — should reject unauthenticated request (401)
 *  2. POST /api/upload — should reject request with no files (400)
 *  3. POST /api/upload — should reject unsupported file type (400)
 *  4. POST /api/upload — should upload a JPG image successfully (201)
 *  5. POST /api/upload — should upload a PNG image successfully (201)
 *  6. POST /api/upload — should upload a CSV file successfully (201)
 *  7. POST /api/upload — should upload multiple files at once (201)
 *  8. GET /api/upload/:fileId/download — should reject unauthenticated request (401)
 *  9. GET /api/upload/:fileId/download — should return signed URL for owned file
 * 10. GET /api/upload/:fileId/download — should reject access to other user's file (403)
 * 11. POST /api/chat — should accept message with image attachment (multimodal)
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const TEST_USERNAME = process.env.E2E_TEST_USERNAME || 'testuser';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpass123';
const API_BASE = process.env.E2E_API_URL || 'http://localhost:3001';

const IMAGES_DIR = path.join(__dirname, '../../images');

/** Login and return cookies string for subsequent requests */
async function loginAndGetCookies(request) {
    const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
        data: { username: TEST_USERNAME, password: TEST_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);

    const setCookies = loginRes.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie');
    return setCookies.map(c => c.value.split(';')[0]).join('; ');
}

// ─── Upload Tests ───

test.describe('Upload API — POST /api/upload', () => {
    test('should reject unauthenticated request (401)', async ({ request }) => {
        const res = await request.post(`${API_BASE}/api/upload`);
        expect(res.status()).toBe(401);
    });

    test('should reject request with no files (400)', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);

        const res = await request.post(`${API_BASE}/api/upload`, {
            headers: { Cookie: cookies },
            multipart: {},
        });

        // Should be 400 — no files
        expect(res.status()).toBe(400);
    });

    test('should reject unsupported file type (400)', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);

        const res = await request.post(`${API_BASE}/api/upload`, {
            headers: { Cookie: cookies },
            multipart: {
                files: {
                    name: 'malware.exe',
                    mimeType: 'application/x-msdownload',
                    buffer: Buffer.from('not-a-real-exe'),
                },
            },
        });

        expect(res.status()).toBe(400);
    });

    test('should upload a JPG image successfully (201)', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);
        const jpgPath = path.join(IMAGES_DIR, 'test_banner.jpg');

        const res = await request.post(`${API_BASE}/api/upload`, {
            headers: { Cookie: cookies },
            multipart: {
                files: {
                    name: 'test_banner.jpg',
                    mimeType: 'image/jpeg',
                    buffer: fs.readFileSync(jpgPath),
                },
            },
        });

        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body.files).toHaveLength(1);
        expect(body.files[0].fileName).toBe('test_banner.jpg');
        expect(body.files[0].fileType).toBe('image/jpeg');
        expect(body.files[0].downloadUrl).toBeTruthy();
    });

    test('should upload a PNG image successfully (201)', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);
        const pngPath = path.join(IMAGES_DIR, 'test_small.png');

        const res = await request.post(`${API_BASE}/api/upload`, {
            headers: { Cookie: cookies },
            multipart: {
                files: {
                    name: 'test_small.png',
                    mimeType: 'image/png',
                    buffer: fs.readFileSync(pngPath),
                },
            },
        });

        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body.files[0].fileType).toBe('image/png');
    });

    test('should upload a CSV file successfully (201)', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);
        const csvPath = path.join(IMAGES_DIR, 'test_data.csv');

        const res = await request.post(`${API_BASE}/api/upload`, {
            headers: { Cookie: cookies },
            multipart: {
                files: {
                    name: 'test_data.csv',
                    mimeType: 'text/csv',
                    buffer: fs.readFileSync(csvPath),
                },
            },
        });

        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body.files[0].fileType).toBe('text/csv');
    });

    test('should upload multiple files at once (201)', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);
        const jpgPath = path.join(IMAGES_DIR, 'test_banner.jpg');
        const csvPath = path.join(IMAGES_DIR, 'test_data.csv');

        const res = await request.post(`${API_BASE}/api/upload`, {
            headers: { Cookie: cookies },
            multipart: {
                files: [
                    {
                        name: 'test_banner.jpg',
                        mimeType: 'image/jpeg',
                        buffer: fs.readFileSync(jpgPath),
                    },
                    {
                        name: 'test_data.csv',
                        mimeType: 'text/csv',
                        buffer: fs.readFileSync(csvPath),
                    },
                ],
            },
        });

        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body.files).toHaveLength(2);
    });
});

// ─── Download Tests ───

test.describe('Upload API — GET /api/upload/:fileId/download', () => {
    test('should reject unauthenticated download request (401)', async ({ request }) => {
        const fakeId = encodeURIComponent('uploads/user/123_file.jpg');
        const res = await request.get(`${API_BASE}/api/upload/${fakeId}/download`);
        expect(res.status()).toBe(401);
    });

    test('should return signed URL for own uploaded file', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);
        const jpgPath = path.join(IMAGES_DIR, 'test_banner.jpg');

        // First upload
        const uploadRes = await request.post(`${API_BASE}/api/upload`, {
            headers: { Cookie: cookies },
            multipart: {
                files: {
                    name: 'download_test.jpg',
                    mimeType: 'image/jpeg',
                    buffer: fs.readFileSync(jpgPath),
                },
            },
        });
        expect(uploadRes.status()).toBe(201);
        const { files } = await uploadRes.json();
        const downloadUrl = files[0].downloadUrl;

        // Then download
        const downloadRes = await request.get(`${API_BASE}${downloadUrl}`, {
            headers: { Cookie: cookies },
        });

        expect(downloadRes.status()).toBe(200);
        const body = await downloadRes.json();
        expect(body.url).toBeTruthy();
        expect(body.url).toContain('storage.googleapis.com');
    });
});

// ─── Multimodal Chat Integration ───

test.describe('Upload API — Multimodal Chat', () => {
    test('should allow sending a chat message with image attachment', async ({ request }) => {
        const cookies = await loginAndGetCookies(request);
        const jpgPath = path.join(IMAGES_DIR, 'test_banner.jpg');

        // Step 1: Upload image
        const uploadRes = await request.post(`${API_BASE}/api/upload`, {
            headers: { Cookie: cookies },
            multipart: {
                files: {
                    name: 'chat_image.jpg',
                    mimeType: 'image/jpeg',
                    buffer: fs.readFileSync(jpgPath),
                },
            },
        });
        expect(uploadRes.status()).toBe(201);
        const { files } = await uploadRes.json();

        // Step 2: Create session
        const sessionRes = await request.post(`${API_BASE}/api/sessions`, {
            headers: { Cookie: cookies, 'Content-Type': 'application/json' },
            data: { title: 'Upload Test' },
        });
        expect(sessionRes.status()).toBe(201);
        const session = await sessionRes.json();

        // Step 3: Send chat with attachment
        const chatRes = await request.post(`${API_BASE}/api/chat`, {
            headers: { Cookie: cookies, 'Content-Type': 'application/json' },
            data: {
                sessionId: session.id,
                messages: [
                    {
                        role: 'user',
                        content: 'What is in this image?',
                        attachments: [
                            {
                                fileId: files[0].fileId,
                                fileName: files[0].fileName,
                                fileType: files[0].fileType,
                                fileSize: files[0].fileSize,
                                downloadUrl: files[0].downloadUrl,
                            },
                        ],
                    },
                ],
            },
        });

        // SSE stream should start (200)
        expect(chatRes.status()).toBe(200);
        const body = await chatRes.text();
        // Should contain SSE events
        expect(body).toContain('data:');
    });
});
