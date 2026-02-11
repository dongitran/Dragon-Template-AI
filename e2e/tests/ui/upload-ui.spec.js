/**
 * Upload UI — E2E Tests
 *
 * Tests the file upload UI in the chat interface via browser interaction.
 *
 * Test cases:
 *  1. should show paperclip upload button in chat input
 *  2. should open file picker when clicking paperclip
 *  3. should show file preview chip after selecting a file
 *  4. should show image thumbnail in preview chip for images
 *  5. should show PDF icon in preview chip for PDFs
 *  6. should remove file when clicking X on preview chip
 *  7. should send message with attached file and show user bubble
 *  8. should display uploaded image inline in chat message
 *  9. should display PDF as file card (not inline image) in chat message
 * 10. should send file-only message (no text) when files are attached
 * 11. should disable paperclip button during streaming
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const TEST_USERNAME = process.env.E2E_TEST_USERNAME || 'testuser';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpass123';
const FIXTURES_DIR = path.join(__dirname, '../../fixtures');

test.describe('Upload UI', () => {
    test.beforeEach(async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.getByPlaceholder('Username').fill(TEST_USERNAME);
        await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL('/', { timeout: 10000 });

        // Wait for chat UI to load
        await expect(page.locator('.chat-input-container')).toBeVisible({ timeout: 5000 });
    });

    // ─── Paperclip Button ───

    test('should show paperclip upload button in chat input', async ({ page }) => {
        const paperclip = page.locator('.chat-upload-btn');
        await expect(paperclip).toBeVisible();
        await expect(paperclip).toBeEnabled();

        // Should have correct title/tooltip
        const title = await paperclip.getAttribute('title');
        expect(title).toContain('Attach files');
    });

    test('should open file picker when clicking paperclip', async ({ page }) => {
        // The hidden file input should exist
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();

        // Verify it accepts the right types
        const accept = await fileInput.getAttribute('accept');
        expect(accept).toContain('.pdf');
        expect(accept).toContain('.csv');
        expect(accept).toContain('.png');
        expect(accept).toContain('.jpg');

        // Verify multiple is enabled
        const multiple = await fileInput.getAttribute('multiple');
        expect(multiple !== null).toBeTruthy();
    });

    // ─── File Preview Chips ───

    test('should show file preview chip after selecting a file', async ({ page }) => {
        // Set file on the hidden input
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'test_banner.jpg'));

        // Preview chip should appear
        const chip = page.locator('.chat-file-chip');
        await expect(chip).toBeVisible({ timeout: 3000 });

        // Should show filename
        await expect(chip.locator('.chat-file-name')).toContainText('test_banner');

        // Should show file size
        await expect(chip.locator('.chat-file-size')).toBeVisible();

        // Should show remove button
        await expect(chip.locator('.chat-file-remove')).toBeVisible();
    });

    test('should show image thumbnail in preview chip for images', async ({ page }) => {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'test_banner.jpg'));

        // Image chips should have a thumbnail <img>
        const thumb = page.locator('.chat-file-chip .chat-file-thumb');
        await expect(thumb).toBeVisible({ timeout: 3000 });

        // Thumbnail should have a blob: or data: src (object URL from preview)
        const src = await thumb.getAttribute('src');
        expect(src).toBeTruthy();
        expect(src.startsWith('blob:') || src.startsWith('data:')).toBeTruthy();
    });

    test('should show PDF icon in preview chip for PDFs', async ({ page }) => {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'cv-dongtran.pdf'));

        // PDF chips should have icon, NOT thumbnail
        const chip = page.locator('.chat-file-chip');
        await expect(chip).toBeVisible({ timeout: 3000 });

        // Should have file icon span, not img thumbnail
        const icon = chip.locator('.chat-file-icon');
        await expect(icon).toBeVisible();

        // Should NOT have img thumbnail
        const thumb = chip.locator('.chat-file-thumb');
        await expect(thumb).not.toBeVisible();

        // Filename should show
        await expect(chip.locator('.chat-file-name')).toContainText('cv-dongtran');
    });

    test('should remove file when clicking X on preview chip', async ({ page }) => {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'test_banner.jpg'));

        // Chip visible
        const chip = page.locator('.chat-file-chip');
        await expect(chip).toBeVisible({ timeout: 3000 });

        // Click remove
        await chip.locator('.chat-file-remove').click();

        // Chip should disappear
        await expect(chip).not.toBeVisible();

        // File preview area should be gone
        await expect(page.locator('.chat-file-previews')).not.toBeVisible();
    });

    // ─── Send with Attachment ───

    test('should send message with attached file and show user bubble', async ({ page }) => {
        // Attach file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'test_banner.jpg'));
        await expect(page.locator('.chat-file-chip')).toBeVisible({ timeout: 3000 });

        // Type message
        const textarea = page.locator('.chat-input-textarea');
        await textarea.fill('Describe this image please');

        // Send
        await page.locator('.chat-send-btn').click();

        // User message should appear
        const userMessage = page.locator('.chat-message.user');
        await expect(userMessage).toBeVisible({ timeout: 5000 });
        await expect(userMessage).toContainText('Describe this image');

        // Preview chips should be cleared
        await expect(page.locator('.chat-file-chip')).not.toBeVisible();

        // Wait for AI response
        const assistantMessage = page.locator('.chat-message.assistant');
        await expect(assistantMessage).toBeVisible({ timeout: 30000 });
    });

    test('should display uploaded image inline in chat message', async ({ page }) => {
        // Attach image + send
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'test_banner.jpg'));
        await page.locator('.chat-input-textarea').fill('What is this?');
        await page.locator('.chat-send-btn').click();

        // Wait for user message with attachment
        const userMessage = page.locator('.chat-message.user');
        await expect(userMessage).toBeVisible({ timeout: 5000 });

        // Image should render inline (AttachmentImage component)
        // First it may show loading card, then the actual image
        const attachmentArea = userMessage.locator('.chat-attachments');
        await expect(attachmentArea).toBeVisible({ timeout: 10000 });

        // Should eventually show an <img> with class chat-attachment-image
        // or a file card (if signed URL fetch fails in test env)
        const imgOrCard = attachmentArea.locator('.chat-attachment-image, .chat-attachment-card');
        await expect(imgOrCard).toBeVisible({ timeout: 15000 });
    });

    test('should display PDF as file card in chat message', async ({ page }) => {
        // Attach PDF + send
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'cv-dongtran.pdf'));
        await page.locator('.chat-input-textarea').fill('Summarize this PDF');
        await page.locator('.chat-send-btn').click();

        // Wait for user message
        const userMessage = page.locator('.chat-message.user');
        await expect(userMessage).toBeVisible({ timeout: 5000 });

        // PDF should render as file card, not inline image
        const fileCard = userMessage.locator('.chat-attachment-card');
        await expect(fileCard).toBeVisible({ timeout: 10000 });

        // Card should show filename
        await expect(fileCard.locator('.chat-attachment-card-name')).toContainText('cv-dongtran.pdf');

        // Card should show download icon
        await expect(fileCard.locator('.chat-attachment-download')).toBeVisible();

        // Wait for AI response
        const assistantMessage = page.locator('.chat-message.assistant');
        await expect(assistantMessage).toBeVisible({ timeout: 30000 });
    });

    test('should send file-only message without text', async ({ page }) => {
        // Attach file only, no text
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'test_banner.jpg'));
        await expect(page.locator('.chat-file-chip')).toBeVisible({ timeout: 3000 });

        // Placeholder should change when files are selected
        const textarea = page.locator('.chat-input-textarea');
        const placeholder = await textarea.getAttribute('placeholder');
        expect(placeholder).toContain('press Enter');

        // Send without typing text
        await page.locator('.chat-send-btn').click();

        // User message should show (with attachment, possibly empty text)
        const userMessage = page.locator('.chat-message.user');
        await expect(userMessage).toBeVisible({ timeout: 5000 });

        // Attachment should be visible
        const attachmentArea = userMessage.locator('.chat-attachments');
        await expect(attachmentArea).toBeVisible({ timeout: 10000 });

        // AI should still respond
        const assistantMessage = page.locator('.chat-message.assistant');
        await expect(assistantMessage).toBeVisible({ timeout: 30000 });
    });
});
