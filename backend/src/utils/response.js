/**
 * Set httpOnly auth cookies on the response.
 */
function setAuthCookies(res, { access_token, refresh_token, expires_in }) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('access_token', access_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: expires_in * 1000,
    });

    res.cookie('refresh_token', refresh_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
}

/**
 * Serialize a MongoDB user document into a safe API response.
 */
function serializeUser(user) {
    return {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        preferences: user.preferences,
    };
}

module.exports = { setAuthCookies, serializeUser };
