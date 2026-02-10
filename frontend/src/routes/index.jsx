import { Routes, Route, Outlet } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import HomePage from '../pages/HomePage';
import DocumentsPage from '../pages/DocumentsPage';
import WorkflowsPage from '../pages/WorkflowsPage';
import ProjectsPage from '../pages/ProjectsPage';
import SettingsPage from '../pages/SettingsPage';

function ProtectedLayout() {
    return (
        <ProtectedRoute>
            <AppLayout>
                <Outlet />
            </AppLayout>
        </ProtectedRoute>
    );
}

function AppRoutes() {
    return (
        <Routes>
            {/* Public routes — no layout */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes — with shared layout */}
            <Route element={<ProtectedLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/workflows" element={<WorkflowsPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
            </Route>
        </Routes>
    );
}

export default AppRoutes;
