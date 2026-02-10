import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
    it('should render without crashing', () => {
        render(<App />);
    });

    it('should render the Vite and React logos', () => {
        render(<App />);
        const viteLogo = screen.getByAltText('Vite logo');
        const reactLogo = screen.getByAltText('React logo');
        expect(viteLogo).toBeInTheDocument();
        expect(reactLogo).toBeInTheDocument();
    });
});
