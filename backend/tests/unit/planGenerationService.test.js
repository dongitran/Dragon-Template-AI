const {
    generatePlanContent,
    extractImagePlaceholders,
    replacePlaceholders,
    markdownToBlockNote,
    extractTitle,
} = require('../../src/services/planGenerationService');

// Mock Google GenAI
jest.mock('@google/genai');
const { GoogleGenAI } = require('@google/genai');

describe('planGenerationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('extractImagePlaceholders', () => {
        it('should extract image placeholders from markdown', () => {
            const markdown = `
# Project Plan
![App mockup](IMAGE_PLACEHOLDER_1)
Some text here
![Dashboard screenshot](IMAGE_PLACEHOLDER_2)
![Team chart](IMAGE_PLACEHOLDER_3)
`;

            const placeholders = extractImagePlaceholders(markdown);

            expect(placeholders).toHaveLength(3);
            expect(placeholders[0]).toEqual({
                id: '1',
                description: 'App mockup',
                placeholder: '![App mockup](IMAGE_PLACEHOLDER_1)',
            });
            expect(placeholders[1].id).toBe('2');
            expect(placeholders[2].id).toBe('3');
        });

        it('should return empty array if no placeholders found', () => {
            const markdown = '# No images\nJust text';
            const placeholders = extractImagePlaceholders(markdown);
            expect(placeholders).toEqual([]);
        });

        it('should handle malformed placeholders', () => {
            const markdown = '![Missing placeholder](no-placeholder-here)';
            const placeholders = extractImagePlaceholders(markdown);
            expect(placeholders).toEqual([]);
        });
    });

    describe('replacePlaceholders', () => {
        it('should replace placeholders with actual URLs', () => {
            const markdown = `
# Plan
![Mockup](IMAGE_PLACEHOLDER_1)
Text
![Chart](IMAGE_PLACEHOLDER_2)
`;
            const images = [
                { id: '1', assetUrl: 'https://storage.com/mockup.png' },
                { id: '2', assetUrl: 'https://storage.com/chart.png' },
            ];

            const result = replacePlaceholders(markdown, images);

            expect(result).toContain('![Mockup](https://storage.com/mockup.png)');
            expect(result).toContain('![Chart](https://storage.com/chart.png)');
            expect(result).not.toContain('IMAGE_PLACEHOLDER');
        });

        it('should remove placeholders if no images provided', () => {
            const markdown = '![Image](IMAGE_PLACEHOLDER_1)\nText';
            const result = replacePlaceholders(markdown, []);
            expect(result).not.toContain('IMAGE_PLACEHOLDER');
            expect(result).not.toContain('![Image]');
        });

        it('should handle partial replacements', () => {
            const markdown = `
![Image1](IMAGE_PLACEHOLDER_1)
![Image2](IMAGE_PLACEHOLDER_2)
![Image3](IMAGE_PLACEHOLDER_3)
`;
            const images = [{ id: '2', assetUrl: 'https://url.com/img.png' }];

            const result = replacePlaceholders(markdown, images);

            expect(result).toContain('https://url.com/img.png');
            expect(result).toContain('IMAGE_PLACEHOLDER_1');
            expect(result).toContain('IMAGE_PLACEHOLDER_3');
        });
    });

    describe('markdownToBlockNote', () => {
        it('should convert markdown to BlockNote format', () => {
            const markdown = `# Main Heading
## Subheading
### Third Level
Regular paragraph`;

            const blocks = markdownToBlockNote(markdown);

            expect(blocks).toHaveLength(4);
            expect(blocks[0]).toEqual({
                type: 'heading',
                props: { level: 1 },
                content: [{ type: 'text', text: 'Main Heading' }],
            });
            expect(blocks[1]).toEqual({
                type: 'heading',
                props: { level: 2 },
                content: [{ type: 'text', text: 'Subheading' }],
            });
            expect(blocks[2].props.level).toBe(3);
            expect(blocks[3].type).toBe('paragraph');
        });

        it('should skip empty lines', () => {
            const markdown = `# Heading

Paragraph`;

            const blocks = markdownToBlockNote(markdown);

            expect(blocks).toHaveLength(2);
            expect(blocks[0].type).toBe('heading');
            expect(blocks[1].type).toBe('paragraph');
        });

        it('should handle plain text without markdown', () => {
            const markdown = 'Just plain text\nAnother line';

            const blocks = markdownToBlockNote(markdown);

            expect(blocks).toHaveLength(2);
            expect(blocks.every(b => b.type === 'paragraph')).toBe(true);
        });
    });

    describe('extractTitle', () => {
        it('should extract title from first H1', () => {
            const markdown = `# Project Plan Title
## Another heading
# Not this one`;

            const title = extractTitle(markdown);
            expect(title).toBe('Project Plan Title');
        });

        it('should return null if no H1 found', () => {
            const markdown = '## Only H2\nNo H1 here';
            const title = extractTitle(markdown);
            expect(title).toBeNull();
        });

        it('should handle H1 with extra spaces', () => {
            const markdown = '#    Title with spaces   ';
            const title = extractTitle(markdown);
            expect(title).toBe('Title with spaces   ');
        });
    });

    describe('generatePlanContent', () => {
        it('should call Gemini API and return markdown', async () => {
            // Mock Gemini API
            const mockGenerateText = jest.fn().mockResolvedValue({
                text: '# Generated Plan\n## Section 1\nContent here\n![Mockup](IMAGE_PLACEHOLDER_1)',
            });

            GoogleGenAI.mockImplementation(() => ({
                models: {
                    get: jest.fn().mockReturnValue({
                        generateText: mockGenerateText,
                    }),
                },
            }));

            // Set env var
            process.env.GEMINI_API_KEYS = 'test-api-key';

            const result = await generatePlanContent('Build a fitness app', {});

            expect(mockGenerateText).toHaveBeenCalled();
            expect(result).toContain('# Generated Plan');
            expect(result).toContain('IMAGE_PLACEHOLDER_1');
        });

        it('should throw error if GEMINI_API_KEYS not configured', async () => {
            delete process.env.GEMINI_API_KEYS;

            await expect(generatePlanContent('Test prompt', {})).rejects.toThrow(
                'GEMINI_API_KEYS not configured'
            );
        });

        it('should use custom sections if provided', async () => {
            const mockGenerateText = jest.fn().mockResolvedValue({ text: '# Plan' });

            GoogleGenAI.mockImplementation(() => ({
                models: {
                    get: jest.fn().mockReturnValue({
                        generateText: mockGenerateText,
                    }),
                },
            }));

            process.env.GEMINI_API_KEYS = 'test-key';

            const options = {
                sections: ['Overview', 'Budget', 'Timeline'],
            };

            await generatePlanContent('Test', options);

            const callArgs = mockGenerateText.mock.calls[0][0];
            expect(callArgs.prompt).toContain('Overview');
            expect(callArgs.prompt).toContain('Budget');
            expect(callArgs.prompt).toContain('Timeline');
        });

        it('should handle Gemini API errors', async () => {
            GoogleGenAI.mockImplementation(() => ({
                models: {
                    get: jest.fn().mockReturnValue({
                        generateText: jest.fn().mockRejectedValue(new Error('API Error')),
                    }),
                },
            }));

            process.env.GEMINI_API_KEYS = 'test-key';

            await expect(generatePlanContent('Test', {})).rejects.toThrow('API Error');
        });
    });
});
