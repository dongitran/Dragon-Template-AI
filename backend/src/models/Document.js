const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
    assetId: { type: String, required: true },      // GCS object path
    assetUrl: { type: String, required: true },     // public URL
    assetType: { type: String, required: true },    // 'image', 'file'
    description: { type: String },                  // asset description
}, { _id: false });

const documentSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true,
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        index: true,
    },
    title: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['project-plan', 'workflow', 'roadmap', 'sprint'],
        index: true,
    },
    content: {
        type: Object,
        required: true,
    },
    metadata: {
        generatedBy: {
            type: String,
            enum: ['ai', 'user'],
            default: 'ai',
        },
        prompt: String,
        model: String,
        generatedAt: Date,
    },
    assets: {
        type: [assetSchema],
        default: [],
    },
}, { timestamps: true });

// Index for efficient queries
documentSchema.index({ userId: 1, createdAt: -1 });
documentSchema.index({ sessionId: 1 });

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;
