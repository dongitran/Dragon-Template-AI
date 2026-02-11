/**
 * Sidebar navigation and route protection E2E tests.
 *
 * Test cases:
 * 1. should display sidebar with all navigation items
 * 2. should navigate to Documents page
 * 3. should navigate to Workflows page
 * 4. should navigate to Projects page
 * 5. should navigate to Settings page
 * 6. should navigate back to Chat (home)
 * 7. should collapse and expand sidebar
 * 8. should protect routes when not authenticated
 */
import { test, expect } from '@playwright/test';

const TEST_USERNAME = process.env.E2E_TEST_USERNAME || 'testuser';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpass123';

test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.getByPlaceholder('Username').fill(TEST_USERNAME);
        await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL('/', { timeout: 10000 });
    });

    test('should display sidebar with all navigation items', async ({ page }) => {
        const sidebar = page.locator('.ant-layout-sider');
        await expect(sidebar).toBeVisible();

        await expect(page.getByText('Chat')).toBeVisible();
        await expect(page.getByText('Documents')).toBeVisible();
        await expect(page.getByText('Workflows')).toBeVisible();
        await expect(page.getByText('Projects')).toBeVisible();
        await expect(page.getByText('Settings')).toBeVisible();
    });

    test('should navigate to Documents page', async ({ page }) => {
        await page.getByText('Documents').click();
        await expect(page).toHaveURL('/documents');
    });

    test('should navigate to Workflows page', async ({ page }) => {
        await page.getByText('Workflows').click();
        await expect(page).toHaveURL('/workflows');
    });

    test('should navigate to Projects page', async ({ page }) => {
        await page.getByText('Projects').click();
        await expect(page).toHaveURL('/projects');
    });

    test('should navigate to Settings page', async ({ page }) => {
        await page.getByText('Settings').click();
        await expect(page).toHaveURL('/settings');
    });

    test('should navigate back to Chat (home)', async ({ page }) => {
        // Go to documents first
        await page.getByText('Documents').click();
        await expect(page).toHaveURL('/documents');

        // Navigate back to Chat
        await page.getByText('Chat').click();
        await expect(page).toHaveURL('/');
    });

    test('should collapse and expand sidebar', async ({ page }) => {
        const sider = page.locator('.ant-layout-sider');

        // Sidebar should start expanded
        await expect(sider).not.toHaveClass(/ant-layout-sider-collapsed/);

        // Click collapse trigger
        await page.locator('.app-trigger').click();
        await expect(sider).toHaveClass(/ant-layout-sider-collapsed/);

        // Click expand trigger
        await page.locator('.app-trigger').click();
        await expect(sider).not.toHaveClass(/ant-layout-sider-collapsed/);
    });

    test('should protect routes when not authenticated', async ({ page }) => {
        // Logout first
        const avatar = page.locator('.ant-avatar');
        await avatar.click();
        await page.getByText('Logout').click();
        await expect(page).toHaveURL('/login', { timeout: 5000 });

        // Try to access protected routes
        await page.goto('/documents');
        await expect(page).toHaveURL('/login');

        await page.goto('/settings');
        await expect(page).toHaveURL('/login');
    });
});
