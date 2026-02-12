import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'dragon-theme';

function getInitialTheme() {
    try {
        return localStorage.getItem(STORAGE_KEY) || 'dark';
    } catch {
        return 'dark';
    }
}

export function ThemeProvider({ children }) {
    const [themeMode, setThemeModeState] = useState(getInitialTheme);

    const setThemeMode = (mode) => {
        setThemeModeState(mode);
        try {
            localStorage.setItem(STORAGE_KEY, mode);
        } catch {
            // ignore
        }
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', themeMode);
    }, [themeMode]);

    return (
        <ThemeContext.Provider value={{ themeMode, setThemeMode }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}

export default ThemeContext;
