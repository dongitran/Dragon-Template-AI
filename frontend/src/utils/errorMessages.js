/**
 * Map backend error messages to user-friendly messages.
 * Prevents leaking internal details (e.g. Keycloak errors) to the UI.
 */
export function mapErrorMessage(backendError, fallback) {
    if (!backendError) return fallback;
    const msg = backendError.toLowerCase();

    if (msg.includes('invalid') || msg.includes('credentials')) return 'Invalid username or password';
    if (msg.includes('already exists') || msg.includes('duplicate')) return 'An account with this username or email already exists';
    if (msg.includes('required')) return 'Please fill in all required fields';
    if (msg.includes('too many')) return 'Too many attempts. Please try again later';
    if (msg.includes('network') || msg.includes('econnrefused')) return 'Unable to connect to the server. Please try again later';

    return fallback;
}
