const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');

const app = express();

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Rate limiting — stricter in production, relaxed in development
const isProduction = process.env.NODE_ENV === 'production';

// Global: 100 req/15min (prod) or 1000 req/15min (dev)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 100 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
});
app.use('/api', globalLimiter);

// Login: 10 req/15min (prod) or 100 req/15min (dev)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 10 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later' },
});
app.use('/api/auth/login', loginLimiter);

// Register: 5 req/hr (prod) or 50 req/hr (dev)
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 5 : 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many registration attempts, please try again later' },
});
app.use('/api/auth/register', registerLimiter);


// Routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'dragon-backend',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
});

module.exports = app;
