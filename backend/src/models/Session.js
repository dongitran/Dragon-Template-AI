const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        required: true,
        enum: ['user', 'assistant'],
    },
    content: {
        type: String,
        required: true,
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
