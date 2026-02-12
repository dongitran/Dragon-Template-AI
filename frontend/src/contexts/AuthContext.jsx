import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { mapErrorMessage } from '../utils/errorMessages';

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL;

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const refreshTimerRef = useRef(null);
    const lastRefreshRef = useRef(Date.now());
    // Ref to break circular dependency: tryTokenRefresh → scheduleRefresh → tryTokenRefresh
    const scheduleRefreshRef = useRef(null);

    // Clear auth state without calling backend (for expired token scenarios)
    const handleSessionExpired = useCallback(() => {
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
        }
        setUser(null);
    }, []);

    const tryTokenRefresh = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                lastRefreshRef.current = Date.now();
                scheduleRefreshRef.current?.(data.expiresIn);
                return true;
            } else {
                handleSessionExpired();
                return false;
            }
        } catch {
            handleSessionExpired();
            return false;
        }
    }, [handleSessionExpired]);

    const scheduleRefresh = useCallback((expiresIn) => {
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
        }

        const refreshTime = (expiresIn - 30) * 1000;
        if (refreshTime <= 0) return;

        lastRefreshRef.current = Date.now();

        refreshTimerRef.current = setTimeout(async () => {
            await tryTokenRefresh();
        }, refreshTime);
    }, [tryTokenRefresh]);

    // Keep ref in sync so tryTokenRefresh can call scheduleRefresh without circular deps
    scheduleRefreshRef.current = scheduleRefresh;

    // Check if user is already logged in on mount
    useEffect(() => {
        checkAuth();

        return () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
            }
        };
    }, []);

    // Refresh token when tab becomes visible again (setTimeout is throttled in background tabs)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && user) {
                const elapsed = Date.now() - lastRefreshRef.current;
                if (elapsed > 4 * 60 * 1000) {
                    tryTokenRefresh();
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [user, tryTokenRefresh]);

    // Listen for global 401 events from authFetch utility
    useEffect(() => {
        const onSessionExpired = () => handleSessionExpired();
        window.addEventListener('auth:sessionExpired', onSessionExpired);
        return () => window.removeEventListener('auth:sessionExpired', onSessionExpired);
    }, [handleSessionExpired]);

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
