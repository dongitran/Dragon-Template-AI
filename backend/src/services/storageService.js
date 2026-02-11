const { Storage } = require('@google-cloud/storage');

// --- GCS Configuration ---
let storage;
let bucket;

function getStorage() {
    if (!storage) {
        const credentials = process.env.GCS_CREDENTIALS;
        if (!credentials) {
            throw new Error('GCS_CREDENTIALS env var is required. Set it to the full JSON service account key.');
        }

        storage = new Storage({
            projectId: JSON.parse(credentials).project_id,
            credentials: JSON.parse(credentials),
        });

        const bucketName = process.env.GCS_BUCKET || 'dragon-template-storage';
        bucket = storage.bucket(bucketName);
    }
    return { storage, bucket };
}

// --- Allowed file types ---
const ALLOWED_MIME_TYPES = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'application/pdf': 'pdf',
    'text/csv': 'csv',
};

const ALLOWED_EXTENSIONS = ['pdf', 'csv', 'png', 'jpg', 'jpeg'];

function getMaxUploadBytes() {
    const mb = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '5', 10);
    return mb * 1024 * 1024;
}

/**
 * Validate file type by MIME type and extension.
 */
function validateFileType(mimetype, originalname) {
    const ext = originalname.split('.').pop().toLowerCase();

    if (!ALLOWED_MIME_TYPES[mimetype]) {
        return { valid: false, error: `File type '${mimetype}' is not allowed. Accepted: PNG, JPG, JPEG, PDF, CSV.` };
    }

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return { valid: false, error: `File extension '.${ext}' is not allowed. Accepted: .png, .jpg, .jpeg, .pdf, .csv` };
    }

    return { valid: true };
}

/**
 * Upload a file buffer to GCS.
 */
async function uploadFile(fileBuffer, originalName, mimeType, userId) {
    const { bucket } = getStorage();

    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const gcsPath = `uploads/${userId}/${timestamp}_${safeName}`;

    const file = bucket.file(gcsPath);

    await file.save(fileBuffer, {
        metadata: {
            contentType: mimeType,
            metadata: {
                originalName: originalName,
                uploadedBy: userId,
                uploadedAt: new Date().toISOString(),
            },
        },
        resumable: false,
    });

    return {
        fileId: gcsPath,
        fileName: originalName,
        fileType: mimeType,
        fileSize: fileBuffer.length,
        gcsUrl: `gs://${bucket.name}/${gcsPath}`,
    };
}

/**
 * Generate a signed download URL for a GCS file.
 * @param {string} fileId - The GCS object path (fileId)
 * @param {number} expiresInMs - Expiry duration in milliseconds (default: 1 hour)
 * @returns {Promise<string>} - The signed URL
 */
async function getSignedDownloadUrl(fileId, expiresInMs = 60 * 60 * 1000) {
    const { bucket } = getStorage();
    const file = bucket.file(fileId);

    const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInMs,
    });

    return url;
}

/**
 * Download a file from GCS to a buffer.
 * Used by AI provider to send file content to Gemini.
 * @param {string} fileId - The GCS object path
 * @returns {Promise<Buffer>}
 */
async function downloadFileToBuffer(fileId) {
    const { bucket } = getStorage();
    const file = bucket.file(fileId);
    const [buffer] = await file.download();
    return buffer;
}

/**
 * Check if a file exists in GCS and belongs to a specific user.
 * @param {string} fileId - The GCS object path
 * @param {string} userId - The user ID to verify ownership
 * @returns {Promise<boolean>}
 */
async function verifyFileOwnership(fileId, userId) {
    // File path format: uploads/{userId}/{timestamp}_{filename}
    // Verify the fileId starts with the user's upload path
    return fileId.startsWith(`uploads/${userId}/`);
}

module.exports = {
    getStorage,
    validateFileType,
    uploadFile,
    getSignedDownloadUrl,
    downloadFileToBuffer,
    verifyFileOwnership,
    getMaxUploadBytes,
    ALLOWED_MIME_TYPES,
    ALLOWED_EXTENSIONS,
};
