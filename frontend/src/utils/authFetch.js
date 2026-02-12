/**
 * Drop-in replacement for fetch() that auto-handles 401 (session expired).
 * On 401, dispatches a global 'auth:sessionExpired' event so AuthContext
 * can clear the user state and ProtectedRoute redirects to /login.
 *
 * Usage: import authFetch from '../utils/authFetch';
 *        const res = await authFetch('/api/...', { method: 'POST', ... });
 */
export default async function authFetch(url, options = {}) {
    const res = await fetch(url, { credentials: 'include', ...options });

    if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('auth:sessionExpired'));
    }

    return res;
}
