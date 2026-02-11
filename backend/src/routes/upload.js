const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const {
    validateFileType,
    uploadFile,
    getSignedDownloadUrl,
    verifyFileOwnership,
    getMaxUploadBytes,
} = require('../services/storageService');

const router = express.Router();

// --- Multer Configuration ---
// Use memory storage: file stays in buffer, then we pipe it to GCS
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: getMaxUploadBytes(),
        files: 5, // Max 5 files per request
    },
    fileFilter: (req, file, cb) => {
        const { valid, error } = validateFileType(file.mimetype, file.originalname);
        if (!valid) {
            cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', error));
        } else {
            cb(null, true);
        }
    },
});

/**
 * POST /api/upload
 * Upload one or more files to GCS.
 * Requires authentication. Accepts multipart/form-data with field 'files'.
 *
 * Response: { files: [{ fileId, fileName, fileType, fileSize, gcsUrl, downloadUrl }] }
 */
router.post('/', authMiddleware, (req, res, next) => {
    const uploadMiddleware = upload.array('files', 5);

    uploadMiddleware(req, res, async (err) => {
        // Handle multer errors
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    const maxMb = process.env.MAX_UPLOAD_SIZE_MB || '1';
                    return res.status(400).json({
                        error: `File too large. Maximum size is ${maxMb}MB.`,
                    });
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({
                        error: 'Too many files. Maximum 5 files per upload.',
                    });
                }
                if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return res.status(400).json({
                        error: err.field || 'Invalid file type.',
                    });
                }
                return res.status(400).json({ error: err.message });
            }
            return res.status(500).json({ error: 'Upload failed.' });
        }

        // No files uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files provided.' });
        }

        try {
            const userId = req.user.sub;
            const uploadResults = [];

            for (const file of req.files) {
                const result = await uploadFile(
                    file.buffer,
                    file.originalname,
                    file.mimetype,
                    userId
                );

                uploadResults.push({
                    ...result,
                    downloadUrl: `/api/upload/${encodeURIComponent(result.fileId)}/download`,
                });
            }

            res.status(201).json({ files: uploadResults });
        } catch (err) {
            console.error('[Upload] GCS upload error:', err.message);
            res.status(500).json({ error: 'Failed to upload file to storage.' });
        }
    });
});

/**
 * GET /api/upload/:fileId/download
 * Generate a signed download URL for a file.
 * Requires authentication. Validates user ownership.
 *
 * The fileId is the GCS object path (URL-encoded in the request).
 * Responds with a redirect to the signed URL.
 */
router.get('/:fileId/download', authMiddleware, async (req, res) => {
    try {
        const fileId = decodeURIComponent(req.params.fileId);
        const userId = req.user.sub;

        // Verify the file belongs to the requesting user
        const isOwner = await verifyFileOwnership(fileId, userId);
        if (!isOwner) {
            return res.status(403).json({ error: 'Access denied. You do not own this file.' });
        }

        const signedUrl = await getSignedDownloadUrl(fileId);
        res.json({ url: signedUrl });
    } catch (err) {
        console.error('[Upload] Download error:', err.message);

        if (err.code === 404 || err.message.includes('No such object')) {
            return res.status(404).json({ error: 'File not found.' });
        }

        res.status(500).json({ error: 'Failed to generate download URL.' });
    }
});

module.exports = router;
