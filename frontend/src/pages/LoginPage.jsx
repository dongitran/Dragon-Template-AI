import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, Card, message, Space } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import './auth.css';

const { Title, Text } = Typography;

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            await login(values.username, values.password);
            message.success('Welcome back!');
            navigate('/');
        } catch (err) {
            message.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-background" />
            <Card className="auth-card" bordered={false}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div className="auth-header">
                        <div className="auth-logo">🐉</div>
                        <Title level={2} style={{ margin: 0, color: '#fff' }}>
                            Dragon AI
                        </Title>
                        <Text type="secondary">Sign in to your account</Text>
                    </div>

                    <Form
                        name="login"
                        size="large"
                        onFinish={onFinish}
                        autoComplete="off"
                        layout="vertical"
                    >
                        <Form.Item
                            name="username"
                            rules={[{ required: true, message: 'Please enter your username' }]}
                        >
                            <Input
                                prefix={<UserOutlined />}
                                placeholder="Username"
                            />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: 'Please enter your password' }]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="Password"
                            />
                        </Form.Item>

                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                icon={<LoginOutlined />}
                                block
                            >
                                Sign In
                            </Button>
                        </Form.Item>
                    </Form>

                    <div className="auth-footer">
                        <Text type="secondary">
                            Don't have an account?{' '}
                            <Link to="/register">Create one</Link>
                        </Text>
                    </div>
                </Space>
            </Card>
        </div>
    );
}
