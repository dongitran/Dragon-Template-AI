import { Typography, Empty } from 'antd';

function SettingsPage() {
    return (
        <div>
            <Typography.Title level={3} style={{ color: '#fff' }}>Settings</Typography.Title>
            <Empty description="Settings coming soon" />
        </div>
    );
}

export default SettingsPage;
