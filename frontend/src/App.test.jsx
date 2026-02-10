import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

describe('App', () => {
    it('should render without crashing', () => {
        render(<App />);
    });

    it('should render the Dragon AI logo text', () => {
        render(<App />);
        expect(screen.getByText('Dragon AI')).toBeInTheDocument();
    });
});
