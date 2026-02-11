/**
 * StorageService — Unit Tests
 *
 * Tests:
 *  validateFileType:
 *   1. should accept image/png with .png extension
 *   2. should accept image/jpeg with .jpg extension
 *   3. should accept image/jpeg with .jpeg extension
 *   4. should accept application/pdf with .pdf extension
 *   5. should accept text/csv with .csv extension
 *   6. should reject unsupported MIME type (text/html)
 *   7. should reject unsupported extension (.exe)
 *   8. should reject mismatched MIME type and extension
 *
 *  getMaxUploadBytes:
 *   9. should default to 5MB when env var is not set
 *  10. should use MAX_UPLOAD_SIZE_MB env var
 *
 *  verifyFileOwnership:
 *  11. should return true when fileId belongs to user
 *  12. should return false when fileId belongs to different user
 *  13. should return false for malformed fileId
 *
 *  uploadFile:
 *  14. should upload file to GCS and return metadata
 *  15. should sanitize filenames (remove special chars)
 *
 *  getSignedDownloadUrl:
 *  16. should return a signed URL string
 *
 *  downloadFileToBuffer:
 *  17. should return file contents as Buffer
 */

// Mock @google-cloud/storage
const mockSave = jest.fn().mockResolvedValue();
const mockGetSignedUrl = jest.fn().mockResolvedValue(['https://storage.googleapis.com/signed-url']);
const mockDownload = jest.fn().mockResolvedValue([Buffer.from('file-data')]);

const mockFile = jest.fn().mockReturnValue({
    save: mockSave,
    getSignedUrl: mockGetSignedUrl,
    download: mockDownload,
});

const mockBucket = { file: mockFile, name: 'test-bucket' };

jest.mock('@google-cloud/storage', () => ({
    Storage: jest.fn().mockImplementation(() => ({
        bucket: jest.fn().mockReturnValue(mockBucket),
    })),
}));

// Set env vars before requiring the module
process.env.GCS_CREDENTIALS = JSON.stringify({
    project_id: 'test-project',
    client_email: 'test@test.iam.gserviceaccount.com',
    private_key: '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n',
});
process.env.GCS_BUCKET = 'test-bucket';

const {
    validateFileType,
    getMaxUploadBytes,
    verifyFileOwnership,
    uploadFile,
    getSignedDownloadUrl,
    downloadFileToBuffer,
} = require('../../src/services/storageService');

describe('StorageService', () => {
    // ─── validateFileType ───

    describe('validateFileType', () => {
        it('should accept image/png with .png extension', () => {
            const result = validateFileType('image/png', 'photo.png');
            expect(result).toEqual({ valid: true });
        });

        it('should accept image/jpeg with .jpg extension', () => {
            const result = validateFileType('image/jpeg', 'photo.jpg');
            expect(result).toEqual({ valid: true });
        });

        it('should accept image/jpeg with .jpeg extension', () => {
            const result = validateFileType('image/jpeg', 'photo.jpeg');
            expect(result).toEqual({ valid: true });
        });

        it('should accept application/pdf with .pdf extension', () => {
            const result = validateFileType('application/pdf', 'document.pdf');
            expect(result).toEqual({ valid: true });
        });

        it('should accept text/csv with .csv extension', () => {
            const result = validateFileType('text/csv', 'data.csv');
            expect(result).toEqual({ valid: true });
        });

        it('should reject unsupported MIME type', () => {
            const result = validateFileType('text/html', 'page.html');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not allowed');
        });

        it('should reject unsupported extension', () => {
            const result = validateFileType('image/png', 'virus.exe');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not allowed');
        });

        it('should reject mismatched MIME type and extension', () => {
            // Valid MIME but invalid extension
            const result = validateFileType('image/png', 'file.txt');
            expect(result.valid).toBe(false);
        });
    });

    // ─── getMaxUploadBytes ───

    describe('getMaxUploadBytes', () => {
        const originalEnv = process.env.MAX_UPLOAD_SIZE_MB;

        afterEach(() => {
            if (originalEnv === undefined) {
                delete process.env.MAX_UPLOAD_SIZE_MB;
            } else {
                process.env.MAX_UPLOAD_SIZE_MB = originalEnv;
            }
        });

        it('should default to 5MB when env var is not set', () => {
            delete process.env.MAX_UPLOAD_SIZE_MB;
            expect(getMaxUploadBytes()).toBe(5 * 1024 * 1024);
        });

        it('should use MAX_UPLOAD_SIZE_MB env var', () => {
            process.env.MAX_UPLOAD_SIZE_MB = '10';
            expect(getMaxUploadBytes()).toBe(10 * 1024 * 1024);
        });
    });

    // ─── verifyFileOwnership ───

    describe('verifyFileOwnership', () => {
        it('should return true when fileId belongs to user', async () => {
            const result = await verifyFileOwnership('uploads/user123/file.jpg', 'user123');
            expect(result).toBe(true);
        });

        it('should return false when fileId belongs to different user', async () => {
            const result = await verifyFileOwnership('uploads/user123/file.jpg', 'otheruser');
            expect(result).toBe(false);
        });

        it('should return false for malformed fileId', async () => {
            const result = await verifyFileOwnership('random/path/file.jpg', 'user123');
            expect(result).toBe(false);
        });
    });

    // ─── uploadFile ───

    describe('uploadFile', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should upload file to GCS and return metadata', async () => {
            const buffer = Buffer.from('test-image-data');
            const result = await uploadFile(buffer, 'photo.jpg', 'image/jpeg', 'user123');

            expect(result.fileName).toBe('photo.jpg');
            expect(result.fileType).toBe('image/jpeg');
            expect(result.fileSize).toBe(buffer.length);
            expect(result.fileId).toContain('uploads/user123/');
            expect(result.gcsUrl).toContain('gs://test-bucket/');
            expect(mockSave).toHaveBeenCalledTimes(1);
        });

        it('should sanitize filenames', async () => {
            const buffer = Buffer.from('data');
            const result = await uploadFile(buffer, 'my file (1).jpg', 'image/jpeg', 'user1');

            // Special chars should be replaced with underscores
            expect(result.fileId).toMatch(/uploads\/user1\/\d+_my_file__1_.jpg/);
        });
    });

    // ─── getSignedDownloadUrl ───

    describe('getSignedDownloadUrl', () => {
        it('should return a signed URL string', async () => {
            const url = await getSignedDownloadUrl('uploads/user1/file.jpg');
            expect(url).toBe('https://storage.googleapis.com/signed-url');
            expect(mockGetSignedUrl).toHaveBeenCalled();
        });
    });

    // ─── downloadFileToBuffer ───

    describe('downloadFileToBuffer', () => {
        it('should return file contents as Buffer', async () => {
            const buffer = await downloadFileToBuffer('uploads/user1/file.jpg');
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.toString()).toBe('file-data');
        });
    });
});
