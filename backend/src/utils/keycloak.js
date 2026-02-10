const axios = require('axios');

const KEYCLOAK_URL = process.env.KEYCLOAK_URL;
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM;
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET;

const TOKEN_URL = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

/**
 * Decode the payload from a JWT access token without verification.
 * Used after Keycloak has already issued the token.
 */
function decodeTokenPayload(accessToken) {
    return JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
}

/**
 * Request a token from Keycloak's OpenID Connect token endpoint.
 * Automatically includes client_id and client_secret.
 */
async function requestKeycloakToken(params) {
    const response = await axios.post(TOKEN_URL, new URLSearchParams({
        client_id: KEYCLOAK_CLIENT_ID,
        client_secret: KEYCLOAK_CLIENT_SECRET,
        ...params,
    }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
}

/**
 * Create a user in Keycloak via the Admin REST API.
 */
async function createKeycloakUser(adminAccessToken, userData) {
    await axios.post(
        `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
        userData,
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminAccessToken}`,
            },
        }
    );
}

module.exports = {
    decodeTokenPayload,
    requestKeycloakToken,
    createKeycloakUser,
    TOKEN_URL,
};
