/**
 * Session UI E2E Tests
 *
 * Comprehensive tests for the chat session management UI in the browser.
 *
 * Test cases:
 *  Sidebar basics:
 *   1. should show "New Chat" button in sidebar
 *   2. should show empty state initially
 *
 *  Session creation:
 *   3. should create session when sending first message
 *   4. should update URL to /chat/:sessionId after first message
 *   5. should show session in sidebar after sending message
 *
 *  Session navigation:
 *   6. should navigate to new chat when clicking "New Chat" button
 *   7. should load session when clicking sidebar item
 *   8. should show messages after loading session
 *
 *  Session actions:
 *   9. should show rename and delete buttons on hover
 *  10. should rename session via inline edit
 *  11. should delete session from sidebar
 *
 *  Session persistence:
 *  12. should persist messages after page reload
 *
 *  Multi-session:
 *  13. should create and switch between multiple sessions
 */
import { test, expect } from '@playwright/test';

test.describe('Session UI', () => {
    test.beforeEach(async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.getByPlaceholder('Username').fill('testuser');
        await page.getByPlaceholder('Password').fill('testpass123');
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL('/', { timeout: 10000 });
    });

    // ─── Sidebar Basics ───

    test('should show New Chat button in sidebar', async ({ page }) => {
        const newChatBtn = page.locator('.chat-sidebar-new-btn');
        await expect(newChatBtn).toBeVisible();
        await expect(newChatBtn).toContainText('New Chat');
    });

    test('should show chat sidebar section', async ({ page }) => {
        // The sidebar should be visible with a new chat button
        const sidebar = page.locator('.chat-sidebar');
        await expect(sidebar).toBeVisible();
    });

    // ─── Session Creation ───

    test('should create session when sending first message', async ({ page }) => {
        // Type and send a message
        const textarea = page.locator('.chat-input-textarea');
        await textarea.fill('Hello from E2E test');
        await page.locator('.chat-send-btn').click();

        // Wait for URL to change to /chat/:sessionId
        await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}/, { timeout: 15000 });
    });

    test('should show session in sidebar after sending message', async ({ page }) => {
        const textarea = page.locator('.chat-input-textarea');
        await textarea.fill('Session sidebar test');
        await page.locator('.chat-send-btn').click();

        // Wait for response
        await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}/, { timeout: 15000 });

        // Session should appear in sidebar list
        const sidebarItems = page.locator('.chat-sidebar-item');
        await expect(sidebarItems.first()).toBeVisible({ timeout: 10000 });
    });

    // ─── Session Navigation ───

    test('should navigate to new chat when clicking New Chat', async ({ page }) => {
        // Send a message first to create a session
        const textarea = page.locator('.chat-input-textarea');
        await textarea.fill('Navigate away test');
        await page.locator('.chat-send-btn').click();
        await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}/, { timeout: 15000 });

        // Click "New Chat"
        await page.locator('.chat-sidebar-new-btn').click();

        // Should be back to root
        await expect(page).toHaveURL('/');

        // Welcome screen should be visible
        await expect(page.locator('.chat-empty')).toBeVisible();
    });

    test('should load session when clicking sidebar item', async ({ page }) => {
        // Send a message
        const textarea = page.locator('.chat-input-textarea');
        await textarea.fill('Load session test');
        await page.locator('.chat-send-btn').click();
        await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}/, { timeout: 15000 });

        // Wait for response to complete
        await page.waitForTimeout(3000);

        // Navigate to new chat
        await page.locator('.chat-sidebar-new-btn').click();
        await expect(page).toHaveURL('/');

        // Click the sidebar item to load the session back
        const firstItem = page.locator('.chat-sidebar-item').first();
        await firstItem.click();

        // Should have navigated back to the session
        await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}/);

        // Messages should be loaded
        const messages = page.locator('.chat-message');
        await expect(messages.first()).toBeVisible({ timeout: 5000 });
    });

    // ─── Session Actions ───

    test('should show rename and delete buttons on hover', async ({ page }) => {
        // Send a message first
        const textarea = page.locator('.chat-input-textarea');
        await textarea.fill('Hover test');
        await page.locator('.chat-send-btn').click();
        await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}/, { timeout: 15000 });

        // Hover over sidebar item
        const firstItem = page.locator('.chat-sidebar-item').first();
        await firstItem.hover();

        // Action buttons should be visible
        const actionBtns = firstItem.locator('.chat-sidebar-action-btn');
        await expect(actionBtns.first()).toBeVisible();
    });

    test('should rename session via inline edit', async ({ page }) => {
        // Send a message
        const textarea = page.locator('.chat-input-textarea');
        await textarea.fill('Rename me test');
        await page.locator('.chat-send-btn').click();
        await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}/, { timeout: 15000 });

        // Wait for sidebar to show the session
        const firstItem = page.locator('.chat-sidebar-item').first();
        await expect(firstItem).toBeVisible({ timeout: 10000 });

        // Hover and click the Edit (rename) button
        await firstItem.hover();
        const editBtn = firstItem.locator('.chat-sidebar-action-btn').first();
        await expect(editBtn).toBeVisible();
        await editBtn.click();

        // An input should appear for inline editing
        const editInput = firstItem.locator('input');
        await expect(editInput).toBeVisible({ timeout: 3000 });

        // Clear and type new name
        await editInput.fill('Renamed Session');
        await editInput.press('Enter');

        // Verify the title changed
        await expect(firstItem).toContainText('Renamed Session', { timeout: 5000 });
    });

    test('should delete session from sidebar', async ({ page }) => {
        // Send a message
        const textarea = page.locator('.chat-input-textarea');
        await textarea.fill('Delete me test');
        await page.locator('.chat-send-btn').click();
        await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}/, { timeout: 15000 });

        // Wait for sidebar item to appear
        const firstItem = page.locator('.chat-sidebar-item').first();
        await expect(firstItem).toBeVisible({ timeout: 10000 });

        // Get the current URL (session ID)
        const currentUrl = page.url();

        // Hover and click the Delete button (second action button)
        await firstItem.hover();
        const actionBtns = firstItem.locator('.chat-sidebar-action-btn');
        // Delete is typically the second button (after edit)
        const deleteBtn = actionBtns.last();
        await expect(deleteBtn).toBeVisible();
        await deleteBtn.click();

        // Wait a bit for delete to process
        await page.waitForTimeout(1000);

        // The session should be removed from sidebar or we should navigate away
        // Either the item disappears or we're redirected
        const itemCount = await page.locator('.chat-sidebar-item').filter({ hasText: 'Delete me test' }).count();
        expect(itemCount).toBe(0);
    });

    // ─── Session Persistence ───

    test('should persist messages after page reload', async ({ page }) => {
        // Send a message
        const textarea = page.locator('.chat-input-textarea');
        const uniqueMsg = `Persist test ${Date.now()}`;
        await textarea.fill(uniqueMsg);
        await page.locator('.chat-send-btn').click();

        // Wait for session and response
        await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}/, { timeout: 15000 });

        // Wait for assistant response to appear
        const assistantMsg = page.locator('.chat-message.assistant');
        await expect(assistantMsg).toBeVisible({ timeout: 30000 });

        // Get current URL
        const sessionUrl = page.url();

        // Reload the page
        await page.reload();

        // Should still be on the same session URL
        await expect(page).toHaveURL(sessionUrl, { timeout: 10000 });

        // Messages should be loaded from the server
        const userMsg = page.locator('.chat-message.user');
        await expect(userMsg).toBeVisible({ timeout: 10000 });
        await expect(userMsg).toContainText(uniqueMsg);
    });

    // ─── Multi-Session ───

    test('should create and switch between multiple sessions', async ({ page }) => {
        // Create first session
        const textarea = page.locator('.chat-input-textarea');
        await textarea.fill('First session message');
        await page.locator('.chat-send-btn').click();
        await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}/, { timeout: 15000 });

        // Wait for response
        await page.waitForTimeout(3000);

        // Capture first session URL
        const firstSessionUrl = page.url();

        // Create second session via "New Chat"
        await page.locator('.chat-sidebar-new-btn').click();
        await expect(page).toHaveURL('/');

        // Send message in new session
        await textarea.fill('Second session message');
        await page.locator('.chat-send-btn').click();
        await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}/, { timeout: 15000 });

        // Wait for response
        await page.waitForTimeout(3000);

        const secondSessionUrl = page.url();
        expect(secondSessionUrl).not.toBe(firstSessionUrl);

        // Should have at least 2 items in sidebar
        const sidebarItems = page.locator('.chat-sidebar-item');
        await expect(sidebarItems.nth(1)).toBeVisible({ timeout: 5000 });
        const itemCount = await sidebarItems.count();
        expect(itemCount).toBeGreaterThanOrEqual(2);

        // Click first session in sidebar (it may be the second item since newest first)
        // Navigate to first session by clicking
        const items = page.locator('.chat-sidebar-item');
        // Find the non-active item and click it
        for (let i = 0; i < itemCount; i++) {
            const item = items.nth(i);
            const isActive = await item.evaluate(el => el.classList.contains('active'));
            if (!isActive) {
                await item.click();
                break;
            }
        }

        // Should navigate to former session
        await expect(page).not.toHaveURL(secondSessionUrl, { timeout: 5000 });

        // Messages should load
        const messages = page.locator('.chat-message');
        await expect(messages.first()).toBeVisible({ timeout: 5000 });
    });
});
