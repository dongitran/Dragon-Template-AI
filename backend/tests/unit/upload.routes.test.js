/**
 * Upload Routes — Unit Tests
 *
 * Tests:
 *  POST /api/upload:
 *   1. should reject unauthenticated request (401)
 *   2. should reject request with no files (400)
 *   3. should reject unsupported file type (400)
 *   4. should upload a valid image file (201)
 *   5. should upload multiple files (201)
 *   6. should return file metadata with downloadUrl
 *   7. should handle GCS upload error (500)
 *
 *  GET /api/upload/:fileId/download:
 *   8. should reject unauthenticated request (401)
 *   9. should reject access to another user's file (403)
 *  10. should return signed URL for owned file (200)
 *  11. should return 404 for non-existent file
 */
const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');

// Mock auth middleware
jest.mock('../../src/middleware/auth', () => (req, res, next) => {
    if (req.headers['x-skip-auth']) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { sub: req.headers['x-test-user'] || 'test-user-id' };
    next();
});

// Mock storage service
const mockUploadFile = jest.fn();
const mockGetSignedDownloadUrl = jest.fn();
const mockVerifyFileOwnership = jest.fn();

jest.mock('../../src/services/storageService', () => ({
    validateFileType: jest.requireActual('../../src/services/storageService').validateFileType,
    uploadFile: (...args) => mockUploadFile(...args),
    getSignedDownloadUrl: (...args) => mockGetSignedDownloadUrl(...args),
    verifyFileOwnership: (...args) => mockVerifyFileOwnership(...args),
    getMaxUploadBytes: () => 5 * 1024 * 1024,
}));

const uploadRoutes = require('../../src/routes/upload');

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/upload', uploadRoutes);
    return app;
}

describe('Upload Routes', () => {
    let app;

    beforeEach(() => {
        app = createApp();
        jest.clearAllMocks();
    });

    // ─── POST /api/upload ───

    describe('POST /api/upload', () => {
        it('should reject unauthenticated request (401)', async () => {
            const res = await request(app)
                .post('/api/upload')
                .set('x-skip-auth', 'true');

            expect(res.status).toBe(401);
        });

        it('should reject request with no files (400)', async () => {
            const res = await request(app)
                .post('/api/upload')
                .set('x-test-user', 'test-user-id');

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('No files');
        });

        it('should reject unsupported file type (400)', async () => {
            const res = await request(app)
                .post('/api/upload')
                .set('x-test-user', 'test-user-id')
                .attach('files', Buffer.from('<html></html>'), {
                    filename: 'page.html',
                    contentType: 'text/html',
                });

            expect(res.status).toBe(400);
        });

        it('should upload a valid image file (201)', async () => {
            mockUploadFile.mockResolvedValueOnce({
                fileId: 'uploads/test-user-id/123_test.jpg',
                fileName: 'test.jpg',
                fileType: 'image/jpeg',
                fileSize: 1024,
                gcsUrl: 'gs://test-bucket/uploads/test-user-id/123_test.jpg',
            });

            const imgPath = path.join(__dirname, '../../../e2e/images/test_banner.jpg');
            const imgBuf = fs.existsSync(imgPath)
                ? fs.readFileSync(imgPath)
                : Buffer.from('fake-jpeg-data');

            const res = await request(app)
                .post('/api/upload')
                .set('x-test-user', 'test-user-id')
                .attach('files', imgBuf, {
                    filename: 'test.jpg',
                    contentType: 'image/jpeg',
                });

            expect(res.status).toBe(201);
            expect(res.body.files).toHaveLength(1);
            expect(res.body.files[0].fileId).toContain('uploads/test-user-id/');
            expect(res.body.files[0].downloadUrl).toContain('/api/upload/');
        });

        it('should upload multiple files (201)', async () => {
            mockUploadFile
                .mockResolvedValueOnce({
                    fileId: 'uploads/test-user-id/1_a.jpg',
                    fileName: 'a.jpg',
                    fileType: 'image/jpeg',
                    fileSize: 100,
                    gcsUrl: 'gs://b/uploads/test-user-id/1_a.jpg',
                })
                .mockResolvedValueOnce({
                    fileId: 'uploads/test-user-id/2_b.csv',
                    fileName: 'b.csv',
                    fileType: 'text/csv',
                    fileSize: 50,
                    gcsUrl: 'gs://b/uploads/test-user-id/2_b.csv',
                });

            const res = await request(app)
                .post('/api/upload')
                .set('x-test-user', 'test-user-id')
                .attach('files', Buffer.from('jpeg'), { filename: 'a.jpg', contentType: 'image/jpeg' })
                .attach('files', Buffer.from('csv'), { filename: 'b.csv', contentType: 'text/csv' });

            expect(res.status).toBe(201);
            expect(res.body.files).toHaveLength(2);
        });

        it('should return file metadata with downloadUrl', async () => {
            mockUploadFile.mockResolvedValueOnce({
                fileId: 'uploads/test-user-id/123_file.png',
                fileName: 'file.png',
                fileType: 'image/png',
                fileSize: 512,
                gcsUrl: 'gs://bucket/uploads/test-user-id/123_file.png',
            });

            const res = await request(app)
                .post('/api/upload')
                .set('x-test-user', 'test-user-id')
                .attach('files', Buffer.from('png-data'), { filename: 'file.png', contentType: 'image/png' });

            const file = res.body.files[0];
            expect(file).toHaveProperty('fileId');
            expect(file).toHaveProperty('fileName', 'file.png');
            expect(file).toHaveProperty('fileType', 'image/png');
            expect(file).toHaveProperty('fileSize', 512);
            expect(file).toHaveProperty('downloadUrl');
            expect(file.downloadUrl).toContain('/download');
        });

        it('should handle GCS upload error (500)', async () => {
            mockUploadFile.mockRejectedValueOnce(new Error('GCS unavailable'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const res = await request(app)
                .post('/api/upload')
                .set('x-test-user', 'test-user-id')
                .attach('files', Buffer.from('data'), { filename: 'test.jpg', contentType: 'image/jpeg' });

            expect(res.status).toBe(500);
            expect(res.body.error).toContain('Failed to upload');

            consoleSpy.mockRestore();
        });
    });

    // ─── GET /api/upload/:fileId/download ───

    describe('GET /api/upload/:fileId/download', () => {
        it('should reject unauthenticated request (401)', async () => {
            const res = await request(app)
                .get('/api/upload/uploads%2Fuser%2Ffile.jpg/download')
                .set('x-skip-auth', 'true');

            expect(res.status).toBe(401);
        });

        it('should reject access to another user\'s file (403)', async () => {
            mockVerifyFileOwnership.mockResolvedValueOnce(false);

            const res = await request(app)
                .get('/api/upload/uploads%2Fother-user%2Ffile.jpg/download')
                .set('x-test-user', 'test-user-id');

            expect(res.status).toBe(403);
            expect(res.body.error).toContain('Access denied');
        });

        it('should return signed URL for owned file (200)', async () => {
            mockVerifyFileOwnership.mockResolvedValueOnce(true);
            mockGetSignedDownloadUrl.mockResolvedValueOnce('https://storage.googleapis.com/signed');

            const res = await request(app)
                .get('/api/upload/uploads%2Ftest-user-id%2Ffile.jpg/download')
                .set('x-test-user', 'test-user-id');

            expect(res.status).toBe(200);
            expect(res.body.url).toBe('https://storage.googleapis.com/signed');
        });

        it('should return 404 for non-existent file', async () => {
            mockVerifyFileOwnership.mockResolvedValueOnce(true);
            const err = new Error('No such object');
            err.code = 404;
            mockGetSignedDownloadUrl.mockRejectedValueOnce(err);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const res = await request(app)
                .get('/api/upload/uploads%2Ftest-user-id%2Fmissing.jpg/download')
                .set('x-test-user', 'test-user-id');

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('not found');

            consoleSpy.mockRestore();
        });
    });
});
