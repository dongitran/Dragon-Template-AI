const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');
const { requestKeycloakToken } = require('../utils/keycloak');
const { setAuthCookies } = require('../utils/response');

const KEYCLOAK_URL = process.env.KEYCLOAK_URL;
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM;

// JWKS client to fetch Keycloak's public keys
const jwksClient = jwksRsa({
    jwksUri: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600000, // 10 minutes
});

function getKey(header, callback) {
    jwksClient.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

/**
 * Verify a JWT token against Keycloak's JWKS.
 * Returns a promise that resolves with the decoded payload.
 */
function verifyToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, getKey, {
            algorithms: ['RS256'],
            issuer: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
        }, (err, decoded) => {
            if (err) reject(err);
            else resolve(decoded);
        });
    });
}

/**
 * Try to refresh the access token using the refresh_token cookie.
 * Returns new token data or null on failure.
 */
async function tryRefresh(refreshToken) {
    try {
        const tokenData = await requestKeycloakToken({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        });
        return tokenData;
    } catch {
        return null;
    }
}

/**
 * Express middleware to validate Keycloak JWT tokens.
 * Reads token from Authorization header or httpOnly cookie.
 * If the access token is expired, automatically attempts refresh
 * using the refresh_token cookie before returning 401.
 */
async function authMiddleware(req, res, next) {
    // Try Authorization header first, then cookie
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.access_token) {
        token = req.cookies.access_token;
    }

    // No access token, but refresh token exists — try to refresh
    if (!token && req.cookies?.refresh_token) {
        const tokenData = await tryRefresh(req.cookies.refresh_token);

        if (tokenData) {
            setAuthCookies(res, tokenData);
            try {
                req.user = await verifyToken(tokenData.access_token);
                return next();
            } catch {
                // New token also invalid — fall through to 401
            }
        }

        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        // Try verifying the current token
        req.user = await verifyToken(token);
        return next();
    } catch (err) {
        // If token expired and we have a refresh token, try auto-refresh
        if (err.name === 'TokenExpiredError' && req.cookies?.refresh_token) {
            const tokenData = await tryRefresh(req.cookies.refresh_token);

            if (tokenData) {
                // Set new cookies and retry verification
                setAuthCookies(res, tokenData);
                try {
                    req.user = await verifyToken(tokenData.access_token);
                    return next();
                } catch {
                    // New token also invalid — fall through to 401
                }
            }
        }

        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = authMiddleware;

