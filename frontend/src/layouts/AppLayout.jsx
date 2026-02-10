import { useState } from 'react';
import { Layout, Menu, Typography, Avatar, Space } from 'antd';
import {
    MessageOutlined,
    FileTextOutlined,
    ApartmentOutlined,
    ProjectOutlined,
    SettingOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import './AppLayout.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
    { key: '/', icon: <MessageOutlined />, label: 'Chat' },
    { key: '/documents', icon: <FileTextOutlined />, label: 'Documents' },
    { key: '/workflows', icon: <ApartmentOutlined />, label: 'Workflows' },
    { key: '/projects', icon: <ProjectOutlined />, label: 'Projects' },
    { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
];

function AppLayout({ children }) {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <Layout className="app-layout">
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                className="app-sider"
                width={220}
            >
                <div className="app-logo">
                    <span className="app-logo-icon">🐉</span>
                    {!collapsed && <span className="app-logo-text">Dragon AI</span>}
                </div>

                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={({ key }) => navigate(key)}
                    className="app-menu"
                />
            </Sider>

            <Layout>
                <Header className="app-header">
                    <Space>
                        {collapsed ? (
                            <MenuUnfoldOutlined className="app-trigger" onClick={() => setCollapsed(false)} />
                        ) : (
                            <MenuFoldOutlined className="app-trigger" onClick={() => setCollapsed(true)} />
                        )}
                    </Space>
                    <Space>
                        <Avatar style={{ backgroundColor: '#6C5CE7' }}>U</Avatar>
                    </Space>
                </Header>

                <Content className="app-content">
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
}

export default AppLayout;
