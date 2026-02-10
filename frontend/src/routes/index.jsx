import { Routes, Route } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import DocumentsPage from '../pages/DocumentsPage';
import WorkflowsPage from '../pages/WorkflowsPage';
import ProjectsPage from '../pages/ProjectsPage';
import SettingsPage from '../pages/SettingsPage';

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/workflows" element={<WorkflowsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
        </Routes>
    );
}

export default AppRoutes;
