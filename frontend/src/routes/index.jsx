import { Routes, Route } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import HomePage from '../pages/HomePage';
import DocumentsPage from '../pages/DocumentsPage';
import WorkflowsPage from '../pages/WorkflowsPage';
import ProjectsPage from '../pages/ProjectsPage';
import SettingsPage from '../pages/SettingsPage';

function AppRoutes() {
    return (
        <Routes>
            {/* Public routes — no layout */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes — with layout */}
            <Route path="/" element={
                <ProtectedRoute>
                    <AppLayout>
                        <HomePage />
                    </AppLayout>
                </ProtectedRoute>
            } />
            <Route path="/documents" element={
                <ProtectedRoute>
                    <AppLayout>
                        <DocumentsPage />
                    </AppLayout>
                </ProtectedRoute>
            } />
            <Route path="/workflows" element={
                <ProtectedRoute>
                    <AppLayout>
                        <WorkflowsPage />
                    </AppLayout>
                </ProtectedRoute>
            } />
            <Route path="/projects" element={
                <ProtectedRoute>
                    <AppLayout>
                        <ProjectsPage />
                    </AppLayout>
                </ProtectedRoute>
            } />
            <Route path="/settings" element={
                <ProtectedRoute>
                    <AppLayout>
                        <SettingsPage />
                    </AppLayout>
                </ProtectedRoute>
            } />
        </Routes>
    );
}

export default AppRoutes;
