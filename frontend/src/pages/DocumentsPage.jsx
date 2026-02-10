import { Typography, Empty } from 'antd';

function DocumentsPage() {
    return (
        <div>
            <Typography.Title level={3} style={{ color: '#fff' }}>Documents</Typography.Title>
            <Empty description="No documents yet" />
        </div>
    );
}

export default DocumentsPage;
