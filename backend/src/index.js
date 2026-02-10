const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.BACKEND_PORT;
const MONGO_URI = process.env.MONGO_URI;

if (!PORT || !MONGO_URI) {
    console.error('❌ Missing required environment variables: BACKEND_PORT, MONGO_URI');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'dragon-backend',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
});

// Connect to MongoDB and start server
async function start() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Backend server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('❌ Failed to connect to MongoDB:', err.message);
        // Start server anyway so health check can report DB status
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Backend server running on port ${PORT} (MongoDB disconnected)`);
        });
    }
}

start();
