/**
 * Authentication flow E2E tests.
 *
 * Test cases:
 *  1. should redirect unauthenticated users to login page
 *  2. should display login page with correct elements
 *  3. should show error for invalid credentials
 *  4. should show validation error for empty fields
 *  5. should login successfully with valid credentials
 *  6. should navigate from login to register page
 *  7. should display register page with correct elements
 *  8. should show validation errors on register form
 *  9. should validate password confirmation mismatch
 * 10. should validate email format on register
 * 11. should validate min-length on username and password
 * 12. should navigate from register to login page
 * 13. should show user avatar with initial in header
 * 14. should show user info in dropdown menu
 * 15. should logout and redirect to login
 * 16. should persist session on page reload
 * 17. should allow re-login after logout
 */
import { test, expect } from '@playwright/test';

const TEST_USERNAME = process.env.E2E_TEST_USERNAME || 'testuser';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpass123';

test.describe('Authentication Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Clear cookies before each test
        await page.context().clearCookies();
    });

    test('should redirect unauthenticated users to login page', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL('/login');
        await expect(page.getByText('Sign in to your account')).toBeVisible();
    });

    test('should display login page with correct elements', async ({ page }) => {
        await page.goto('/login');

        // Dragon AI branding
        await expect(page.getByText('Dragon AI')).toBeVisible();
        await expect(page.getByText('Sign in to your account')).toBeVisible();

        // Form elements
        await expect(page.getByPlaceholder('Username')).toBeVisible();
        await expect(page.getByPlaceholder('Password')).toBeVisible();
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

        // Register link
        await expect(page.getByText('Create one')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto('/login');

        await page.getByPlaceholder('Username').fill('wronguser');
        await page.getByPlaceholder('Password').fill('wrongpassword');
        await page.getByRole('button', { name: /sign in/i }).click();

        await expect(page.getByText(/invalid|failed/i)).toBeVisible({ timeout: 10000 });
    });

    test('should show validation error for empty fields', async ({ page }) => {
        await page.goto('/login');

        // Click submit without filling form
        await page.getByRole('button', { name: /sign in/i }).click();

        await expect(page.getByText('Please enter your username')).toBeVisible();
        await expect(page.getByText('Please enter your password')).toBeVisible();
    });

    test('should login successfully with valid credentials', async ({ page }) => {
        await page.goto('/login');

        await page.getByPlaceholder('Username').fill(TEST_USERNAME);
        await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();

        // Should redirect to home/dashboard (longer timeout for slow server)
        await expect(page).toHaveURL('/', { timeout: 15000 });

        // Should show the app layout with sidebar
        await expect(page.getByText('Chat', { exact: true })).toBeVisible();
        await expect(page.getByText('Documents')).toBeVisible();
    });

    test('should navigate from login to register page', async ({ page }) => {
        await page.goto('/login');
        await page.getByText('Create one').click();

        await expect(page).toHaveURL('/register');
        await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
        await expect(page.getByText('Join Dragon AI')).toBeVisible();
    });

    test('should display register page with correct elements', async ({ page }) => {
        await page.goto('/register');

        await expect(page.getByPlaceholder('Username')).toBeVisible();
        await expect(page.getByPlaceholder('Email')).toBeVisible();
        await expect(page.getByPlaceholder('First name')).toBeVisible();
        await expect(page.getByPlaceholder('Last name')).toBeVisible();
        await expect(page.getByPlaceholder('Password', { exact: true })).toBeVisible();
        await expect(page.getByPlaceholder('Confirm password')).toBeVisible();
        await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();

        // Login link
        await expect(page.getByText('Sign in')).toBeVisible();
    });

    test('should show validation errors on register form', async ({ page }) => {
        await page.goto('/register');

        await page.getByRole('button', { name: /create account/i }).click();

        await expect(page.getByText('Please enter a username')).toBeVisible();
        await expect(page.getByText('Please enter your email')).toBeVisible();
        await expect(page.getByText('Please enter a password')).toBeVisible();
    });

    test('should validate password confirmation mismatch', async ({ page }) => {
        await page.goto('/register');

        await page.getByPlaceholder('Password', { exact: true }).fill('password123');
        await page.getByPlaceholder('Confirm password').fill('differentpass');
        await page.getByPlaceholder('Confirm password').blur();

        await expect(page.getByText('Passwords do not match')).toBeVisible();
    });

    test('should validate email format on register', async ({ page }) => {
        await page.goto('/register');

        await page.getByPlaceholder('Email').fill('not-an-email');
        await page.getByPlaceholder('Email').blur();

        await expect(page.getByText('Please enter a valid email')).toBeVisible();
    });

    test('should validate min-length on username and password', async ({ page }) => {
        await page.goto('/register');

        await page.getByPlaceholder('Username').fill('ab');
        await page.getByPlaceholder('Username').blur();
        await expect(page.getByText('Username must be at least 3 characters')).toBeVisible();

        await page.getByPlaceholder('Password', { exact: true }).fill('12345');
        await page.getByPlaceholder('Password', { exact: true }).blur();
        await expect(page.getByText('Password must be at least 6 characters')).toBeVisible();
    });

    test('should navigate from register to login page', async ({ page }) => {
        await page.goto('/register');
        await page.getByText('Sign in').click();

        await expect(page).toHaveURL('/login');
    });
});

test.describe('Authenticated Session', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test — retry if server is temporarily overloaded
        for (let attempt = 0; attempt < 2; attempt++) {
            await page.goto('/login');
            await page.getByPlaceholder('Username').fill(TEST_USERNAME);
            await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
            await page.getByRole('button', { name: /sign in/i }).click();
            try {
                await expect(page).toHaveURL('/', { timeout: 15000 });
                return; // Login succeeded
            } catch {
                if (attempt === 1) throw new Error('Login failed after 2 attempts');
                await page.waitForTimeout(3000);
            }
        }
    });

    test('should show user avatar with initial in header', async ({ page }) => {
        // User avatar should show "T" for "Test User"
        const avatar = page.locator('.ant-avatar');
        await expect(avatar).toBeVisible();
        await expect(avatar).toContainText('T');
    });

    test('should show user info in dropdown menu', async ({ page }) => {
        // Click user avatar to open dropdown
        const avatar = page.locator('.ant-avatar');
        await avatar.click();

        // Should show user display name in dropdown
        await expect(page.getByText('Test User')).toBeVisible();
    });

    test('should logout and redirect to login', async ({ page }) => {
        // Click user avatar to open dropdown
        const avatar = page.locator('.ant-avatar');
        await avatar.click();

        // Click logout
        await page.getByText('Logout').click();

        // Should redirect to login
        await expect(page).toHaveURL('/login', { timeout: 5000 });
    });

    test('should persist session on page reload', async ({ page }) => {
        // Reload the page
        await page.reload();

        // Should still be authenticated, not redirected to login
        await expect(page).not.toHaveURL('/login', { timeout: 5000 });
        await expect(page.getByText('Chat', { exact: true })).toBeVisible();
    });

    test('should allow re-login after logout', async ({ page }) => {
        // Logout
        const avatar = page.locator('.ant-avatar');
        await avatar.click();
        await page.getByText('Logout').click();
        await expect(page).toHaveURL('/login', { timeout: 5000 });

        // Login again
        await page.getByPlaceholder('Username').fill(TEST_USERNAME);
        await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();

        await expect(page).not.toHaveURL('/login', { timeout: 10000 });
        await expect(page.getByText('Chat', { exact: true })).toBeVisible();
    });
});

test.describe('Auth Redirect — Authenticated Users', () => {
    test.beforeEach(async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.getByPlaceholder('Username').fill(TEST_USERNAME);
        await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).not.toHaveURL('/login', { timeout: 10000 });
    });

    test('should redirect from /login to / when already authenticated', async ({ page }) => {
        // Navigate to login page while authenticated
        await page.goto('/login');

        // Should be redirected away from login
        await expect(page).not.toHaveURL('/login', { timeout: 5000 });
    });

    test('should redirect from /register to / when already authenticated', async ({ page }) => {
        // Navigate to register page while authenticated
        await page.goto('/register');

        // Should be redirected away from register
        await expect(page).not.toHaveURL('/register', { timeout: 5000 });
    });
});
