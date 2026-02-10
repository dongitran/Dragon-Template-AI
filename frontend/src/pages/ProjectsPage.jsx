import { Typography, Empty } from 'antd';

function ProjectsPage() {
    return (
        <div>
            <Typography.Title level={3} style={{ color: '#fff' }}>Projects</Typography.Title>
            <Empty description="No projects yet" />
        </div>
    );
}

export default ProjectsPage;
