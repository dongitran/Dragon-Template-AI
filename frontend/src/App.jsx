import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import AppRoutes from './routes';
import './styles/global.css';

function ThemedApp() {
  const { themeMode } = useTheme();

  const themeConfig = {
    algorithm: themeMode === 'light' ? theme.defaultAlgorithm : theme.darkAlgorithm,
    token: {
      colorPrimary: '#6C5CE7',
      borderRadius: 8,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  };

  return (
    <ConfigProvider theme={themeConfig}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ConfigProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
