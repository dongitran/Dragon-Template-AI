import { useState } from 'react';
import { Input, Button, message, Avatar } from 'antd';
import { UserOutlined, CheckOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import authFetch from '../utils/authFetch';
import './settings.css';

const API_BASE = import.meta.env.VITE_API_URL;

function SettingsPage() {
    const { user, setUser } = useAuth();
    const { themeMode, setThemeMode } = useTheme();

    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [saving, setSaving] = useState(false);

    const hasNameChanged = displayName.trim() !== (user?.displayName || '');

    const handleSaveProfile = async () => {
        if (!hasNameChanged) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/api/auth/profile`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName: displayName.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setUser(prev => ({ ...prev, ...data }));
                message.success('Profile updated');
            } else {
                const err = await res.json();
                message.error(err.error || 'Failed to update profile');
            }
        } catch {
            message.error('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleThemeChange = async (newTheme) => {
        setThemeMode(newTheme);
        try {
            await authFetch(`${API_BASE}/api/auth/profile`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preferences: { theme: newTheme } }),
            });
            setUser(prev => ({
                ...prev,
                preferences: { ...prev?.preferences, theme: newTheme },
            }));
        } catch {
            // Theme already applied locally, silent fail on persist
        }
    };

    const avatarLetter = user?.displayName?.[0] || user?.email?.[0] || 'U';

    return (
        <div className="settings-page">
            <h2 className="settings-title">Settings</h2>

            {/* Profile Section */}
            <section className="settings-section">
                <h3 className="settings-section-title">Profile</h3>
                <div className="settings-card">
                    <div className="settings-profile-header">
                        <Avatar size={56} style={{ backgroundColor: '#6C5CE7', fontSize: 22 }}>
                            {avatarLetter.toUpperCase()}
                        </Avatar>
                        <div className="settings-profile-info">
                            <span className="settings-profile-name">
                                {user?.displayName || 'No name set'}
                            </span>
                            <span className="settings-profile-email">{user?.email}</span>
                        </div>
                    </div>

                    <div className="settings-field">
                        <label className="settings-label">Display Name</label>
                        <div className="settings-input-row">
                            <Input
                                prefix={<UserOutlined />}
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                onPressEnter={handleSaveProfile}
                                placeholder="Your display name"
                                maxLength={100}
                            />
                            <Button
                                type="primary"
                                icon={<CheckOutlined />}
                                onClick={handleSaveProfile}
                                loading={saving}
                                disabled={!hasNameChanged}
                            >
                                Save
                            </Button>
                        </div>
                    </div>

                    <div className="settings-field">
                        <label className="settings-label">Email</label>
                        <Input value={user?.email || ''} disabled />
                    </div>
                </div>
            </section>

            {/* Theme Section */}
            <section className="settings-section">
                <h3 className="settings-section-title">Appearance</h3>
                <div className="settings-card">
                    <div className="settings-field">
                        <label className="settings-label">Theme</label>
                        <div className="settings-theme-options">
                            <button
                                className={`settings-theme-btn ${themeMode === 'dark' ? 'active' : ''}`}
                                onClick={() => handleThemeChange('dark')}
                            >
                                <div className="settings-theme-preview dark">
                                    <div className="stp-sidebar" />
                                    <div className="stp-content">
                                        <div className="stp-line" />
                                        <div className="stp-line short" />
                                    </div>
                                </div>
                                <span>Dark</span>
                            </button>
                            <button
                                className={`settings-theme-btn ${themeMode === 'light' ? 'active' : ''}`}
                                onClick={() => handleThemeChange('light')}
                            >
                                <div className="settings-theme-preview light">
                                    <div className="stp-sidebar" />
                                    <div className="stp-content">
                                        <div className="stp-line" />
                                        <div className="stp-line short" />
                                    </div>
                                </div>
                                <span>Light</span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default SettingsPage;
