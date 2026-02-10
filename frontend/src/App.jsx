import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import AppLayout from './layouts/AppLayout';
import AppRoutes from './routes';
import './styles/global.css';

const themeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#6C5CE7',
    borderRadius: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
};

function App() {
  return (
    <ConfigProvider theme={themeConfig}>
      <BrowserRouter>
        <AppLayout>
          <AppRoutes />
        </AppLayout>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
