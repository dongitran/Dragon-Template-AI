const User = require('../models/User');

/**
 * Sync user from Keycloak token to MongoDB.
 * Creates user on first login, updates lastLoginAt on subsequent logins.
 */
async function syncUser(decodedToken) {
    const keycloakId = decodedToken.sub;
    const email = decodedToken.email || '';
    const displayName = [decodedToken.given_name, decodedToken.family_name]
        .filter(Boolean)
        .join(' ') || decodedToken.preferred_username || '';

    const user = await User.findOneAndUpdate(
        { keycloakId },
        {
            $set: {
                email,
                displayName,
                lastLoginAt: new Date(),
            },
            $setOnInsert: {
                keycloakId,
                avatar: '',
                preferences: { theme: 'dark', language: 'en' },
            },
        },
        { upsert: true, returnDocument: 'after', runValidators: true }
    );

    return user;
}

module.exports = { syncUser };
