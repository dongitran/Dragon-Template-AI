const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

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
 * Express middleware to validate Keycloak JWT tokens.
 * Reads token from Authorization header or httpOnly cookie.
 * Sets req.user with decoded token payload.
 */
function authMiddleware(req, res, next) {
    // Try Authorization header first, then cookie
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.access_token) {
        token = req.cookies.access_token;
    }

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, getKey, {
        algorithms: ['RS256'],
        issuer: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
    }, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.user = decoded;
        next();
    });
}

module.exports = authMiddleware;
