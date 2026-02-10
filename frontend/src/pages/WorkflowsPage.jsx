import { Typography, Empty } from 'antd';

function WorkflowsPage() {
    return (
        <div>
            <Typography.Title level={3} style={{ color: '#fff' }}>Workflows</Typography.Title>
            <Empty description="No workflows yet" />
        </div>
    );
}

export default WorkflowsPage;
