const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const sessionRoutes = require('./routes/sessions');
const uploadRoutes = require('./routes/upload');

const app = express();

// Security headers
app.use(helmet());

// Request logging (skip in test to keep output clean)
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
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
app.use('/api/chat', chatRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'dragon-backend',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
});

// Global error handler — always returns JSON, hides details in production
app.use((err, req, res, next) => {
    const status = err.status || 500;
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    if (!isProduction) console.error(err.stack);

    res.status(status).json({
        error: isProduction ? 'Internal server error' : err.message,
    });
});

module.exports = app;
