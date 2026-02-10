import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mock fetch for AuthContext (no auth session)
global.fetch = vi.fn(() =>
    Promise.resolve({ ok: false, status: 401 })
);

describe('App', () => {
    it('should render without crashing', () => {
        render(<App />);
    });

    it('should show login page when not authenticated', async () => {
        render(<App />);
        // Unauthenticated users should see the login page
        const signInText = await screen.findByText('Sign in to your account');
        expect(signInText).toBeInTheDocument();
    });

    it('should show Dragon AI branding on login page', async () => {
        render(<App />);
        const dragonText = await screen.findByText('Dragon AI');
        expect(dragonText).toBeInTheDocument();
    });
});
