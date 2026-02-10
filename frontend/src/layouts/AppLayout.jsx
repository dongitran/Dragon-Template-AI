import { useState } from 'react';
import { Layout, Menu, Typography, Avatar, Space, Dropdown } from 'antd';
import {
    MessageOutlined,
    FileTextOutlined,
    ApartmentOutlined,
    ProjectOutlined,
    SettingOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    LogoutOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ChatSidebar from '../components/ChatSidebar';
import './AppLayout.css';

const { Header, Sider, Content } = Layout;

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
    const { user, logout } = useAuth();

    // Extract sessionId from URL if on chat page
    const isChatPage = location.pathname === '/' || location.pathname.startsWith('/chat/');
    const currentSessionId = location.pathname.startsWith('/chat/')
        ? location.pathname.split('/chat/')[1]
        : null;

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const userMenuItems = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: user?.displayName || user?.email || 'User',
            disabled: true,
        },
        { type: 'divider' },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Logout',
            danger: true,
            onClick: handleLogout,
        },
    ];

    const avatarLetter = user?.displayName?.[0] || user?.email?.[0] || 'U';

    // Determine active menu key — chat pages map to '/'
    const selectedKey = isChatPage ? '/' : location.pathname;

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
                    {!collapsed && <span className="app-logo-text">Dragon Template</span>}
                </div>

                {!collapsed && (
                    <ChatSidebar
                        currentSessionId={currentSessionId}
                    />
                )}

                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[selectedKey]}
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
                    <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                        <Avatar
                            style={{ backgroundColor: '#6C5CE7', cursor: 'pointer' }}
                        >
                            {avatarLetter.toUpperCase()}
                        </Avatar>
                    </Dropdown>
                </Header>

                <Content className="app-content">
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
}

export default AppLayout;

