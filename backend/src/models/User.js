const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    keycloakId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    displayName: {
        type: String,
        default: '',
    },
    avatar: {
        type: String,
        default: '',
    },
    preferences: {
        theme: { type: String, default: 'dark' },
        language: { type: String, default: 'en' },
    },
    lastLoginAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
