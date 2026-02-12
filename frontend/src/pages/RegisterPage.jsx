import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, Card, message, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, IdcardOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import './auth.css';

const { Title, Text } = Typography;

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            await register(
                values.username,
                values.email,
                values.password,
                values.firstName,
                values.lastName
            );
            message.success('Account created! Welcome!');
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
            <Card className="auth-card" variant="borderless">
                <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                    <div className="auth-header">
                        <div className="auth-logo">🐉</div>
                        <Title level={2} style={{ margin: 0, color: '#fff' }}>
                            Create Account
                        </Title>
                        <Text type="secondary">Join Dragon Template</Text>
                    </div>

                    <Form
                        name="register"
                        size="large"
                        onFinish={onFinish}
                        autoComplete="off"
                        layout="vertical"
                    >
                        <Form.Item
                            name="username"
                            rules={[
                                { required: true, message: 'Please enter a username' },
                                { min: 3, message: 'Username must be at least 3 characters' },
                            ]}
                        >
                            <Input
                                prefix={<UserOutlined />}
                                placeholder="Username"
                            />
                        </Form.Item>

                        <Form.Item
                            name="email"
                            rules={[
                                { required: true, message: 'Please enter your email' },
                                { type: 'email', message: 'Please enter a valid email' },
                            ]}
                        >
                            <Input
                                prefix={<MailOutlined />}
                                placeholder="Email"
                            />
                        </Form.Item>

                        <Space.Compact style={{ width: '100%' }}>
                            <Form.Item name="firstName" style={{ width: '50%' }}>
                                <Input
                                    prefix={<IdcardOutlined />}
                                    placeholder="First name"
                                />
                            </Form.Item>
                            <Form.Item name="lastName" style={{ width: '50%' }}>
                                <Input placeholder="Last name" />
                            </Form.Item>
                        </Space.Compact>

                        <Form.Item
                            name="password"
                            rules={[
                                { required: true, message: 'Please enter a password' },
                                { min: 6, message: 'Password must be at least 6 characters' },
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="Password"
                            />
                        </Form.Item>

                        <Form.Item
                            name="confirmPassword"
                            dependencies={['password']}
                            rules={[
                                { required: true, message: 'Please confirm your password' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('password') === value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('Passwords do not match'));
                                    },
                                }),
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="Confirm password"
                            />
                        </Form.Item>

                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                block
                            >
                                Create Account
                            </Button>
                        </Form.Item>
                    </Form>

                    <div className="auth-footer">
                        <Text type="secondary">
                            Already have an account?{' '}
                            <Link to="/login">Sign in</Link>
                        </Text>
                    </div>
                </Space>
            </Card>
        </div>
    );
}
