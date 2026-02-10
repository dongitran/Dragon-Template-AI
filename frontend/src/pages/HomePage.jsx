import { Typography } from 'antd';
import { MessageOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

function HomePage() {
    return (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <MessageOutlined style={{ fontSize: 64, color: '#6C5CE7', marginBottom: 24 }} />
            <Title level={2} style={{ color: '#fff' }}>Welcome to Dragon AI</Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16 }}>
                Start a conversation or generate content using AI-powered commands.
            </Paragraph>
        </div>
    );
}

export default HomePage;
