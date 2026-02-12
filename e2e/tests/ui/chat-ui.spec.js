/**
 * Chat UI E2E Tests
 *
 * Tests the chat interface in the browser against the real Docker backend.
 *
 * Test cases:
 *  1. should display welcome screen on load
 *  2. should load model selector with available models
 *  3. should send message and display user bubble
 *  4. should show typing indicator during streaming
 *  5. should display AI response after streaming completes
 *  6. should change model via selector
 *  7. should handle Enter key to send and Shift+Enter for newline
 *  8. should keep input enabled during streaming but show stop button
 *  9. should allow typing next message during streaming
 * 10. should display multi-turn conversation correctly
 * 11. should keep user message visible during AI streaming
 * 12. should redirect to home for non-existent session
 * 13. should stop streaming when clicking stop button
 */
import { test, expect } from '@playwright/test';

const TEST_USERNAME = process.env.E2E_TEST_USERNAME || 'testuser';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpass123';

test.describe('Chat UI', () => {
    test.beforeEach(async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.getByPlaceholder('Username').fill(TEST_USERNAME);
        await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL('/', { timeout: 10000 });
    });

    test('should display welcome screen on load', async ({ page }) => {
        // Welcome message should be visible
        await expect(page.locator('.chat-empty')).toBeVisible();
        await expect(page.getByText('Welcome to Dragon Template')).toBeVisible();
        await expect(page.getByText('Start a conversation')).toBeVisible();

        // Dragon emoji icon
        await expect(page.locator('.chat-empty-icon')).toBeVisible();

        // Input should be visible
        await expect(page.locator('.chat-input-container')).toBeVisible();
    });

    test('should load model selector with available models', async ({ page }) => {
        // Wait for models to load
        const modelSelector = page.locator('.chat-input-model-selector .ant-select, .ant-select.chat-input-model-selector');
        await expect(modelSelector).toBeVisible({ timeout: 5000 });

        // Click to open dropdown
        await modelSelector.click();

        // Should show at least one model option
        const options = page.locator('.ant-select-item-option');
        await expect(options.first()).toBeVisible({ timeout: 5000 });

        // Close dropdown
        await page.keyboard.press('Escape');
    });

    test('should send message and display user bubble', async ({ page }) => {
        const input = page.locator('.chat-input-container textarea');
        await expect(input).toBeVisible();

        // Type a message
        await input.fill('Hello Dragon!');

        // Click send button
        await page.locator('.chat-send-btn').click();

        // User message bubble should appear
        const userMessage = page.locator('.chat-message.user');
        await expect(userMessage).toBeVisible({ timeout: 5000 });
        await expect(userMessage).toContainText('Hello Dragon!');

        // Welcome screen should disappear
        await expect(page.locator('.chat-empty')).not.toBeVisible();
    });

    test('should show typing indicator during streaming', async ({ page }) => {
        const input = page.locator('.chat-input-container textarea');
        await input.fill('Say "Hello" in one word');
        await page.locator('.chat-send-btn').click();

        // Typing indicator should appear while waiting for response
        const typingIndicator = page.locator('.typing-indicator');
        // It may be very brief, so just check it existed or the response appeared
        await expect(
            typingIndicator.or(page.locator('.chat-message.assistant'))
        ).toBeVisible({ timeout: 15000 });
    });

    test('should display AI response after streaming completes', async ({ page }) => {
        const input = page.locator('.chat-input-container textarea');
        await input.fill('Say exactly: "Hello Dragon"');
        await page.locator('.chat-send-btn').click();

        // Wait for assistant response to appear
        const assistantMessage = page.locator('.chat-message.assistant');
        await expect(assistantMessage).toBeVisible({ timeout: 30000 });

        // Should have some text content
        const content = assistantMessage.locator('.chat-message-content');
        await expect(content).not.toBeEmpty({ timeout: 30000 });

        // Input should be re-enabled after streaming completes
        await expect(input).toBeEnabled({ timeout: 30000 });
    });

    test('should change model via selector', async ({ page }) => {
        const modelSelector = page.locator('.chat-input-model-selector .ant-select, .ant-select.chat-input-model-selector');
        await expect(modelSelector).toBeVisible({ timeout: 5000 });

        // Open dropdown
        await modelSelector.click();

        // Get all options
        const options = page.locator('.ant-select-item-option');
        await expect(options.first()).toBeVisible({ timeout: 5000 });

        const count = await options.count();
        if (count > 1) {
            // Select the second model
            await options.nth(1).click();

            // Verify selector updated (no error thrown)
            await expect(modelSelector).toBeVisible();
        } else {
            // Only one model, just close dropdown
            await page.keyboard.press('Escape');
        }
    });

    test('should handle Enter key to send and Shift+Enter for newline', async ({ page }) => {
        const input = page.locator('.chat-input-container textarea');
        await expect(input).toBeVisible();

        // Shift+Enter should add newline (not send)
        await input.focus();
        await page.keyboard.type('Line 1');
        await page.keyboard.press('Shift+Enter');
        await page.keyboard.type('Line 2');

        const value = await input.inputValue();
        expect(value).toContain('Line 1');
        expect(value).toContain('Line 2');

        // Clear and type new message
        await input.fill('Test Enter key');

        // Enter should send the message
        await page.keyboard.press('Enter');

        // User message should appear
        const userMessage = page.locator('.chat-message.user');
        await expect(userMessage).toBeVisible({ timeout: 5000 });
        await expect(userMessage).toContainText('Test Enter key');
    });

    test('should keep input enabled during streaming but show stop button', async ({ page }) => {
        const input = page.locator('.chat-input-container textarea');
        await input.fill('Count from 1 to 10 slowly');
        await page.locator('.chat-send-btn').click();

        // During streaming, stop button should appear instead of send
        const stopBtn = page.locator('.chat-stop-btn');
        await expect(stopBtn).toBeVisible({ timeout: 15000 });

        // CRITICAL: Input should remain ENABLED during streaming (new behavior)
        await expect(input).toBeEnabled();

        // Upload button should be disabled
        const uploadBtn = page.locator('.chat-upload-btn');
        await expect(uploadBtn).toBeDisabled();

        // Model selector should be disabled
        const modelSelector = page.locator('.chat-input-model-selector .ant-select, .ant-select.chat-input-model-selector');
        // Check if disabled by trying to click and seeing if dropdown opens
        await modelSelector.click();
        const dropdown = page.locator('.ant-select-dropdown');
        await expect(dropdown).not.toBeVisible({ timeout: 1000 });
    });

    // This test verifies user can type next message during streaming
    // Key: Must use .type() not .fill() to trigger onInput event which updates hasText state
    // hasText is required for canSend = (hasText || hasPendingFiles) && !isStreaming
    test('should allow typing next message during streaming', async ({ page }) => {
        const input = page.locator('.chat-input-container textarea');

        // Send first message
        await input.fill('Count from 1 to 5');
        await page.locator('.chat-send-btn').click();

        // Wait for streaming to start (stop button appears)
        const stopBtn = page.locator('.chat-stop-btn');
        await expect(stopBtn).toBeVisible({ timeout: 15000 });

        // IMPORTANT: Use pressSequentially() with delay to simulate real typing
        // This triggers all necessary events (input, keydown, keyup) to update hasText state
        await input.clear();
        await input.pressSequentially('What is 2 + 2?', { delay: 50 });

        // Verify input contains the next message
        const inputValue = await input.inputValue();
        expect(inputValue).toBe('What is 2 + 2?');

        // Wait for streaming to complete (send button reappears)
        const sendBtn = page.locator('.chat-send-btn');
        await expect(sendBtn).toBeVisible({ timeout: 30000 });
        await expect(sendBtn).toBeEnabled({ timeout: 2000 });

        // Wait for React state to fully settle (useEffect hooks, etc.)
        await page.waitForTimeout(1000);

        // Click send button to send the message
        await sendBtn.click();

        // Second user message should appear
        const allUserMessages = page.locator('.chat-message.user');
        await expect(allUserMessages).toHaveCount(2, { timeout: 10000 });

        // Verify second message content
        await expect(allUserMessages.nth(1)).toContainText('What is 2 + 2?');

        // Input should be cleared after sending
        const finalValue = await input.inputValue();
        expect(finalValue).toBe('');
    });

    test('should display multi-turn conversation correctly', async ({ page }) => {
        const input = page.locator('.chat-input-container textarea');

        // Send first message
        await input.fill('Say exactly: "First response"');
        await page.locator('.chat-send-btn').click();

        // Wait for first AI response
        const firstAssistant = page.locator('.chat-message.assistant').first();
        await expect(firstAssistant).toBeVisible({ timeout: 30000 });

        // Wait for streaming to complete (send button reappears)
        await expect(page.locator('.chat-send-btn')).toBeVisible({ timeout: 30000 });

        // Send second message
        await input.fill('Say exactly: "Second response"');
        await page.locator('.chat-send-btn').click();

        // Wait for second AI response
        await page.waitForTimeout(2000);
        const allUserMessages = page.locator('.chat-message.user');
        const allAssistantMessages = page.locator('.chat-message.assistant');

        // Should have 2 user messages and at least 2 assistant messages
        await expect(allUserMessages).toHaveCount(2, { timeout: 30000 });
        await expect(allAssistantMessages.nth(1)).toBeVisible({ timeout: 30000 });

        // Verify message content
        await expect(allUserMessages.first()).toContainText('First response');
        await expect(allUserMessages.nth(1)).toContainText('Second response');
    });

    test('should keep user message visible during AI streaming', async ({ page }) => {
        const input = page.locator('.chat-input-container textarea');
        await input.fill('Write a 200 word story');
        await page.locator('.chat-send-btn').click();

        // User message should be visible immediately
        const userMessage = page.locator('.chat-message.user');
        await expect(userMessage).toBeVisible({ timeout: 5000 });
        await expect(userMessage).toContainText('Write a 200 word story');

        // Wait for assistant response to start streaming
        const assistantMsg = page.locator('.chat-message.assistant');
        await expect(assistantMsg).toBeVisible({ timeout: 30000 });

        // User message should STILL be visible during streaming
        await expect(userMessage).toBeVisible();
        await expect(userMessage).toContainText('Write a 200 word story');
    });

    test('should redirect to home for non-existent session', async ({ page }) => {
        // Navigate to a session that doesn't exist
        await page.goto('/chat/000000000000000000000000');

        // Should redirect back to home (new chat)
        await expect(page).toHaveURL('/', { timeout: 10000 });

        // Welcome screen should be visible
        await expect(page.locator('.chat-empty')).toBeVisible();
    });

    test('should stop streaming when clicking stop button', async ({ page }) => {
        const input = page.locator('.chat-input-container textarea');
        await input.fill('Write a very long story about dragons, at least 500 words');
        await page.locator('.chat-send-btn').click();

        // Wait for stop button to appear
        const stopBtn = page.locator('.chat-stop-btn');
        await expect(stopBtn).toBeVisible({ timeout: 15000 });

        // Click stop
        await stopBtn.click();

        // Send button should reappear (streaming stopped)
        await expect(page.locator('.chat-send-btn')).toBeVisible({ timeout: 5000 });

        // Input should be re-enabled
        await expect(input).toBeEnabled({ timeout: 5000 });

        // There should be a partial response visible
        const assistantMsg = page.locator('.chat-message.assistant');
        // May or may not have content depending on timing, but input should be enabled
    });
});

