import { useState } from 'react';
import { Layout, Avatar, Dropdown } from 'antd';
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
    PlusOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ChatSidebar from '../components/ChatSidebar';
import './AppLayout.css';

const { Sider, Content } = Layout;

const navItems = [
    { key: '/documents', icon: <FileTextOutlined />, label: 'Documents' },
    { key: '/workflows', icon: <ApartmentOutlined />, label: 'Workflows' },
    { key: '/projects', icon: <ProjectOutlined />, label: 'Projects' },
];

function AppLayout({ children }) {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const isChatPage = location.pathname === '/' || location.pathname.startsWith('/chat/');
    const currentSessionId = location.pathname.startsWith('/chat/')
        ? location.pathname.split('/chat/')[1]
        : null;

    const selectedKey = isChatPage ? '/' : location.pathname;

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
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Settings',
            onClick: () => navigate('/settings'),
        },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Logout',
            danger: true,
            onClick: handleLogout,
        },
    ];

    const avatarLetter = user?.displayName?.[0] || user?.email?.[0] || 'U';

    return (
        <Layout className="app-layout">
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                className="app-sider"
                width={260}
                collapsedWidth={0}
            >
                {/* Header: Logo */}
                <div className="sidebar-header">
                    <span className="sidebar-logo-text">Dragon Template</span>
                </div>

                {/* New Chat Button */}
                <div className="sidebar-new-chat-wrapper">
                    <button className="sidebar-new-chat-btn" onClick={() => navigate('/')}>
                        <span className="sidebar-new-chat-icon">
                            <PlusOutlined />
                        </span>
                        <span>New Chat</span>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <button
                            key={item.key}
                            className={`sidebar-nav-item ${selectedKey === item.key ? 'active' : ''}`}
                            onClick={() => navigate(item.key)}
                        >
                            <span className="sidebar-nav-icon">{item.icon}</span>
                            <span className="sidebar-nav-label">{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* Chat list - only on chat pages */}
                {isChatPage && (
                    <ChatSidebar currentSessionId={currentSessionId} />
                )}

                {/* Bottom: User profile */}
                <div className="sidebar-footer">
                    <Dropdown menu={{ items: userMenuItems }} placement="topRight" trigger={['click']}>
                        <button className="sidebar-user-btn">
                            <Avatar size={28} style={{ backgroundColor: '#6C5CE7', flexShrink: 0 }}>
                                {avatarLetter.toUpperCase()}
                            </Avatar>
                            <span className="sidebar-user-name">
                                {user?.displayName || user?.email || 'User'}
                            </span>
                        </button>
                    </Dropdown>
                </div>
            </Sider>

            <Layout>
                <div className="app-topbar">
                    <button
                        className="topbar-toggle-btn"
                        onClick={() => setCollapsed(!collapsed)}
                        title={collapsed ? 'Open sidebar' : 'Close sidebar'}
                    >
                        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    </button>
                </div>

                <Content className="app-content">
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
}

export default AppLayout;
