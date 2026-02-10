const mongoose = require('mongoose');
require('dotenv').config();

const app = require('./app');

const PORT = process.env.BACKEND_PORT;
const MONGO_URI = process.env.MONGO_URI;

if (!PORT || !MONGO_URI) {
    console.error('❌ Missing required environment variables: BACKEND_PORT, MONGO_URI');
    process.exit(1);
}

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
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Backend server running on port ${PORT} (MongoDB disconnected)`);
        });
    }
}

start();
