import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL;

/**
 * Map backend error messages to user-friendly messages.
 * Prevents leaking internal details (e.g. Keycloak errors) to the UI.
 */
function mapErrorMessage(backendError, fallback) {
    if (!backendError) return fallback;
    const msg = backendError.toLowerCase();

    if (msg.includes('invalid') || msg.includes('credentials')) return 'Invalid username or password';
    if (msg.includes('already exists') || msg.includes('duplicate')) return 'An account with this username or email already exists';
    if (msg.includes('required')) return 'Please fill in all required fields';
    if (msg.includes('too many')) return 'Too many attempts. Please try again later';
    if (msg.includes('network') || msg.includes('econnrefused')) return 'Unable to connect to the server. Please try again later';

    return fallback;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const refreshTimerRef = useRef(null);

    // Check if user is already logged in on mount
    useEffect(() => {
        checkAuth();

        return () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
            }
        };
    }, []);

    const checkAuth = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/auth/me`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
            }
        } catch {
            // Not authenticated
        } finally {
            setLoading(false);
        }
    };

    const scheduleRefresh = useCallback((expiresIn) => {
        // Clear any existing timer
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
        }

        // Refresh 30 seconds before expiry
        const refreshTime = (expiresIn - 30) * 1000;
        if (refreshTime <= 0) return;

        refreshTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`${API_BASE}/api/auth/refresh`, {
                    method: 'POST',
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    scheduleRefresh(data.expiresIn);
                } else {
                    setUser(null);
                }
            } catch {
                setUser(null);
            }
        }, refreshTime);
    }, []);

    const login = async (username, password) => {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(mapErrorMessage(data.error, 'Login failed'));
        }

        const data = await res.json();
        setUser(data.user);
        scheduleRefresh(data.expiresIn);

        return data.user;
    };

    const register = async (username, email, password, firstName, lastName) => {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, email, password, firstName, lastName }),
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(mapErrorMessage(data.error, 'Registration failed'));
        }

        const data = await res.json();
        setUser(data.user);
        scheduleRefresh(data.expiresIn);

        return data.user;
    };

    const logout = async () => {
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
        }

        await fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        });
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

export default AuthContext;
