const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
    fileId: { type: String, required: true },      // GCS object path
    fileName: { type: String, required: true },     // original filename
    fileType: { type: String, required: true },     // MIME type
    fileSize: { type: Number, required: true },     // bytes
    gcsUrl: { type: String, required: true },       // gs:// URL for backend
    downloadUrl: { type: String, required: true },  // API URL for frontend
}, { _id: false });

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        required: true,
        enum: ['user', 'assistant'],
    },
    content: {
        type: String,
        default: '',
    },
    attachments: {
        type: [attachmentSchema],
        default: [],
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
    _id: true,
});

const sessionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true,
    },
    title: {
        type: String,
        default: 'New Chat',
    },
    model: {
        type: String,
        default: '',
    },
    messages: {
        type: [messageSchema],
        default: [],
    },
}, {
    timestamps: true,
});

// Compound index for listing user's sessions by most recent
sessionSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('Session', sessionSchema);
