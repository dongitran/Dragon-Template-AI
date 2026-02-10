const express = require('express');
const authMiddleware = require('../middleware/auth');
const { syncUser } = require('../services/userSync');
const User = require('../models/User');
const { decodeTokenPayload, requestKeycloakToken, createKeycloakUser } = require('../utils/keycloak');
const { setAuthCookies, serializeUser } = require('../utils/response');

const router = express.Router();

/**
 * POST /api/auth/login
 * Proxy login to Keycloak, sync user to MongoDB, set httpOnly cookie.
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const tokenData = await requestKeycloakToken({
            grant_type: 'password',
            username,
            password,
        });

        const payload = decodeTokenPayload(tokenData.access_token);
        const user = await syncUser(payload);

        setAuthCookies(res, tokenData);

        res.json({
            user: serializeUser(user),
            expiresIn: tokenData.expires_in,
        });
    } catch (err) {
        if (err.response?.status === 401) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /api/auth/register
 * Register a new user via Keycloak Admin API, then auto-login.
 */
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, firstName, lastName } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        // Get service account token to create user
        const adminTokenData = await requestKeycloakToken({
            grant_type: 'client_credentials',
        });

        // Create user in Keycloak
        await createKeycloakUser(adminTokenData.access_token, {
            username,
            email,
            firstName: firstName || '',
            lastName: lastName || '',
            enabled: true,
            emailVerified: true,
            credentials: [{
                type: 'password',
                value: password,
                temporary: false,
            }],
        });

        // Auto-login after registration
        const tokenData = await requestKeycloakToken({
            grant_type: 'password',
            username,
            password,
        });

        const payload = decodeTokenPayload(tokenData.access_token);
        const user = await syncUser(payload);

        setAuthCookies(res, tokenData);

        res.status(201).json({
            user: serializeUser(user),
            expiresIn: tokenData.expires_in,
        });
    } catch (err) {
        if (err.response?.status === 409 || err.response?.status === 403) {
            return res.status(409).json({ error: 'User already exists' });
        }
        console.error('Register error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh_token cookie.
 */
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies?.refresh_token;

        if (!refreshToken) {
            return res.status(401).json({ error: 'No refresh token' });
        }

        const tokenData = await requestKeycloakToken({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        });

        setAuthCookies(res, tokenData);

        res.json({ expiresIn: tokenData.expires_in });
    } catch (err) {
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        res.status(401).json({ error: 'Token refresh failed' });
    }
});

/**
 * GET /api/auth/me
 * Return current user profile from MongoDB.
 */
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ keycloakId: req.user.sub });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            ...serializeUser(user),
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
        });
    } catch (err) {
        console.error('Get user error:', err.message);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
});

/**
 * POST /api/auth/logout
 * Clear auth cookies.
 */
router.post('/logout', (req, res) => {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
