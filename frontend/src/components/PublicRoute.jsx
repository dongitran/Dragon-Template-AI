import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../contexts/AuthContext';

/**
 * PublicRoute — opposite of ProtectedRoute.
 * Redirects authenticated users away from public-only pages (login, register).
 * If the user is already logged in, redirect them to home.
 */
export default function PublicRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
            }}>
                <Spin size="large" />
            </div>
        );
    }

    if (user) {
        return <Navigate to="/" replace />;
    }

    return children;
}
