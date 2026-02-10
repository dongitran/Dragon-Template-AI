/**
 * Title Generator Service — Unit Tests
 *
 * Tests title generation with mocked Gemini and fallback behavior.
 */

// Mock @google/genai
jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn(),
}));

// Mock aiProvider
jest.mock('../../src/services/aiProvider', () => ({
    getNextApiKey: jest.fn(() => 'test-api-key'),
}));

const { GoogleGenAI } = require('@google/genai');
const { generateTitle } = require('../../src/services/titleGenerator');

describe('generateTitle', () => {
    let mockGenerateContent;

    beforeEach(() => {
        mockGenerateContent = jest.fn();
        GoogleGenAI.mockImplementation(() => ({
            models: {
                generateContent: mockGenerateContent,
            },
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return "New Chat" when no user message exists', async () => {
        const result = await generateTitle([]);
        expect(result).toBe('New Chat');
    });

    it('should return "New Chat" for only assistant messages', async () => {
        const result = await generateTitle([
            { role: 'assistant', content: 'Hello!' },
        ]);
        expect(result).toBe('New Chat');
    });

    it('should generate title from conversation', async () => {
        mockGenerateContent.mockResolvedValue({
            text: 'Discussing Weather Patterns',
        });

        const result = await generateTitle([
            { role: 'user', content: 'What is the weather like today?' },
            { role: 'assistant', content: 'The weather is sunny...' },
        ]);

        expect(result).toBe('Discussing Weather Patterns');
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should use gemini-2.5-flash model', async () => {
        mockGenerateContent.mockResolvedValue({
            text: 'Test Title',
        });

        await generateTitle([
            { role: 'user', content: 'Hello' },
        ]);

        expect(mockGenerateContent).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'gemini-2.5-flash',
            })
        );
    });

    it('should fallback to truncated first user message on AI failure', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API Error'));

        const result = await generateTitle([
            { role: 'user', content: 'Tell me about the history of the Roman Empire and its impact on modern civilization' },
        ]);

        expect(result).toBe('Tell me about the history of the Roman Empire and...');
    });

    it('should fallback when AI returns empty text', async () => {
        mockGenerateContent.mockResolvedValue({
            text: '',
        });

        const result = await generateTitle([
            { role: 'user', content: 'Short message' },
        ]);

        expect(result).toBe('Short message');
    });

    it('should fallback when AI returns undefined text', async () => {
        mockGenerateContent.mockResolvedValue({});

        const result = await generateTitle([
            { role: 'user', content: 'Short message' },
        ]);

        expect(result).toBe('Short message');
    });

    it('should fallback when AI returns too long title', async () => {
        mockGenerateContent.mockResolvedValue({
            text: 'A'.repeat(101),
        });

        const result = await generateTitle([
            { role: 'user', content: 'Short message' },
        ]);

        expect(result).toBe('Short message');
    });

    it('should not truncate short first messages', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API error'));

        const result = await generateTitle([
            { role: 'user', content: 'Hello' },
        ]);

        expect(result).toBe('Hello');
    });
});
