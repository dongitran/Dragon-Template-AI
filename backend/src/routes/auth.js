const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const { syncUser } = require('../services/userSync');
const User = require('../models/User');

const router = express.Router();

const KEYCLOAK_URL = process.env.KEYCLOAK_URL;
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM;
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET;

const TOKEN_URL = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

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

        // Get token from Keycloak using Resource Owner Password Credentials
        const tokenResponse = await axios.post(TOKEN_URL, new URLSearchParams({
            grant_type: 'password',
            client_id: KEYCLOAK_CLIENT_ID,
            client_secret: KEYCLOAK_CLIENT_SECRET,
            username,
            password,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        // Decode token to sync user
        const payload = JSON.parse(Buffer.from(access_token.split('.')[1], 'base64').toString());
        const user = await syncUser(payload);

        // Set httpOnly cookies
        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: expires_in * 1000,
        });

        res.cookie('refresh_token', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });

        res.json({
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                avatar: user.avatar,
                preferences: user.preferences,
            },
            expiresIn: expires_in,
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

        // Get admin token to create user
        const adminTokenRes = await axios.post(TOKEN_URL, new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: KEYCLOAK_CLIENT_ID,
            client_secret: KEYCLOAK_CLIENT_SECRET,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const adminToken = adminTokenRes.data.access_token;

        // Create user in Keycloak
        await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
            {
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
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`,
                },
            }
        );

        // Auto-login after registration
        const tokenResponse = await axios.post(TOKEN_URL, new URLSearchParams({
            grant_type: 'password',
            client_id: KEYCLOAK_CLIENT_ID,
            client_secret: KEYCLOAK_CLIENT_SECRET,
            username,
            password,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        const payload = JSON.parse(Buffer.from(access_token.split('.')[1], 'base64').toString());
        const user = await syncUser(payload);

        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: expires_in * 1000,
        });

        res.cookie('refresh_token', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        res.status(201).json({
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                avatar: user.avatar,
                preferences: user.preferences,
            },
            expiresIn: expires_in,
        });
    } catch (err) {
        if (err.response?.status === 409) {
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

        const tokenResponse = await axios.post(TOKEN_URL, new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: KEYCLOAK_CLIENT_ID,
            client_secret: KEYCLOAK_CLIENT_SECRET,
            refresh_token: refreshToken,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: expires_in * 1000,
        });

        res.cookie('refresh_token', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        res.json({ expiresIn: expires_in });
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
            id: user._id,
            email: user.email,
            displayName: user.displayName,
            avatar: user.avatar,
            preferences: user.preferences,
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
