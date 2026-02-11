// Mock Google GenAI BEFORE requiring the module  
jest.mock('@google/genai');
const { GoogleGenAI } = require('@google/genai');

// Set required env variables BEFORE requiring the service
process.env.GEMINI_API_KEYS = 'test-key-1,test-key-2';
process.env.GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
process.env.IMAGE_DEFAULT_ASPECT_RATIO = '16:9';
process.env.IMAGE_DEFAULT_STYLE = 'professional';
process.env.IMAGE_MAX_RETRIES = '3';
process.env.IMAGE_TIMEOUT_MS = '30000';

// Now require the service after env vars are set
const {
    generateImage,
    generateImageWithRetry,
    generateMultipleImages,
    validateImagePrompt,
    validateAspectRatio,
    VALID_ASPECT_RATIOS,
} = require('../../src/services/imageGenerationService');

describe('imageGenerationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validateImagePrompt', () => {
        it('should validate correct prompt', () => {
            const result = validateImagePrompt('A beautiful sunset over mountains');
            expect(result).toEqual({ valid: true });
        });

        it('should reject empty prompt', () => {
            const result = validateImagePrompt('');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('empty');
        });

        it('should reject whitespace-only prompt', () => {
            const result = validateImagePrompt('   \n  \t  ');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('empty or whitespace');
        });

        it('should reject non-string prompt', () => {
            const result = validateImagePrompt(null);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('non-empty string');
        });

        it('should reject too long prompt', () => {
            const longPrompt = 'a'.repeat(5001);
            const result = validateImagePrompt(longPrompt);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('too long');
        });
    });

    describe('validateAspectRatio', () => {
        it('should validate all valid aspect ratios', () => {
            VALID_ASPECT_RATIOS.forEach(ratio => {
                const result = validateAspectRatio(ratio);
                expect(result).toEqual({ valid: true });
            });
        });

        it('should reject invalid aspect ratio', () => {
            const result = validateAspectRatio('5:4');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid aspect ratio');
        });

        it('should list valid options in error', () => {
            const result = validateAspectRatio('invalid');
            expect(result.error).toContain('1:1');
            expect(result.error).toContain('16:9');
        });
    });

    describe('generateImage', () => {
        it('should generate image successfully', async () => {
            const mockImageData = Buffer.from('fake-image-data').toString('base64');
            const mockGenerateContent = jest.fn().mockResolvedValue({
                candidates: [{
                    content: {
                        parts: [{
                            inlineData: {
                                data: mockImageData,
                                mimeType: 'image/png',
                            },
                        }],
                    },
                }],
            });

            GoogleGenAI.mockImplementation(() => ({
                models: {
                    generateContent: mockGenerateContent,
                },
            }));

            const result = await generateImage('A sunset over mountains');

            expect(result.buffer).toBeInstanceOf(Buffer);
            expect(result.mimeType).toBe('image/png');
            expect(result.buffer.toString()).toContain('fake-image-data');
        });

        it('should use correct model and config', async () => {
            const mockGenerateContent = jest.fn().mockResolvedValue({
                candidates: [{
                    content: {
                        parts: [{
                            inlineData: {
                                data: Buffer.from('test').toString('base64'),
                                mimeType: 'image/png',
                            },
                        }],
                    },
                }],
            });

            GoogleGenAI.mockImplementation(() => ({
                models: {
                    generateContent: mockGenerateContent,
                },
            }));

            await generateImage('Test prompt', { aspectRatio: '21:9' });

            expect(mockGenerateContent).toHaveBeenCalledWith({
                model: 'gemini-2.5-flash-image',
                contents: 'professional style: Test prompt',
                config: {
                    responseModalities: ['Image'],
                    imageConfig: {
                        aspectRatio: '21:9',
                    },
                },
            });
        });

        it('should include text modality when requested', async () => {
            const mockGenerateContent = jest.fn().mockResolvedValue({
                candidates: [{
                    content: {
                        parts: [{
                            inlineData: {
                                data: Buffer.from('test').toString('base64'),
                                mimeType: 'image/png',
                            },
                        }],
                    },
                }],
            });

            GoogleGenAI.mockImplementation(() => ({
                models: {
                    generateContent: mockGenerateContent,
                },
            }));

            await generateImage('Test', { includeText: true });

            const callConfig = mockGenerateContent.mock.calls[0][0].config;
            expect(callConfig.responseModalities).toEqual(['Text', 'Image']);
        });

        it('should parse text response when present', async () => {
            const mockGenerateContent = jest.fn().mockResolvedValue({
                candidates: [{
                    content: {
                        parts: [
                            {
                                text: 'I generated a beautiful sunset image',
                            },
                            {
                                inlineData: {
                                    data: Buffer.from('test').toString('base64'),
                                    mimeType: 'image/png',
                                },
                            },
                        ],
                    },
                }],
            });

            GoogleGenAI.mockImplementation(() => ({
                models: {
                    generateContent: mockGenerateContent,
                },
            }));

            const result = await generateImage('Sunset');

            expect(result.text).toBe('I generated a beautiful sunset image');
            expect(result.buffer).toBeInstanceOf(Buffer);
        });

        it('should throw on invalid prompt', async () => {
            await expect(generateImage('')).rejects.toThrow('Invalid prompt');
        });

        it('should throw on invalid aspect ratio', async () => {
            await expect(generateImage('Test', { aspectRatio: 'invalid' })).rejects.toThrow('Invalid aspect ratio');
        });

        it('should throw if no image data in response', async () => {
            GoogleGenAI.mockImplementation(() => ({
                models: {
                    generateContent: jest.fn().mockResolvedValue({
                        candidates: [{
                            content: {
                                parts: [{ text: 'Only text, no image' }],
                            },
                        }],
                    }),
                },
            }));

            await expect(generateImage('Test')).rejects.toThrow('No image data');
        });

        it('should timeout after configured duration', async () => {
            // Create a slow mock that will exceed the default 30s timeout
            GoogleGenAI.mockImplementation(() => ({
                models: {
                    generateContent: jest.fn().mockImplementation(() =>
                        // Return promise that never resolves (simulates infinite wait)
                        new Promise(() => { })
                    ),
                },
            }));

            // Should timeout after IMAGE_TIMEOUT_MS (30000ms from env)
            await expect(generateImage('Test')).rejects.toThrow('timeout');
        }, 35000);  // Test timeout longer than IMAGE_TIMEOUT_MS

        it('should use custom style prefix', async () => {
            const mockGenerateContent = jest.fn().mockResolvedValue({
                candidates: [{
                    content: {
                        parts: [{
                            inlineData: {
                                data: Buffer.from('test').toString('base64'),
                                mimeType: 'image/png',
                            },
                        }],
                    },
                }],
            });

            GoogleGenAI.mockImplementation(() => ({
                models: {
                    generateContent: mockGenerateContent,
                },
            }));

            await generateImage('Mountains', { style: 'realistic' });

            const callContents = mockGenerateContent.mock.calls[0][0].contents;
            expect(callContents).toBe('realistic style: Mountains');
        });

        it('should rotate API keys', async () => {
            const apiKeyInstances = [];

            GoogleGenAI.mockImplementation(({ apiKey }) => {
                apiKeyInstances.push(apiKey);
                return {
                    models: {
                        generateContent: jest.fn().mockResolvedValue({
                            candidates: [{
                                content: {
                                    parts: [{
                                        inlineData: {
                                            data: Buffer.from('test').toString('base64'),
                                            mimeType: 'image/png',
                                        },
                                    }],
                                },
                            }],
                        }),
                    },
                };
            });

            // Generate 3 images to observe key rotation pattern
            await generateImage('Test 1');
            await generateImage('Test 2');
            await generateImage('Test 3');

            // Should rotate between test-key-1 and test-key-2
            expect(apiKeyInstances).toHaveLength(3);
            // First key is test-key-1 or test-key-2
            expect(['test-key-1', 'test-key-2']).toContain(apiKeyInstances[0]);
            // Should use different keys (round-robin)
            expect(apiKeyInstances[0]).not.toBe(apiKeyInstances[1]);
        });
    });

    describe('generateImageWithRetry', () => {
        it('should succeed on first attempt', async () => {
            GoogleGenAI.mockImplementation(() => ({
                models: {
                    generateContent: jest.fn().mockResolvedValue({
                        candidates: [{
                            content: {
                                parts: [{
                                    inlineData: {
                                        data: Buffer.from('test').toString('base64'),
                                        mimeType: 'image/png',
                                    },
                                }],
                            },
                        }],
                    }),
                },
            }));

            const result = await generateImageWithRetry('Test prompt');
            expect(result.buffer).toBeInstanceOf(Buffer);
        });

        it('should retry on transient errors', async () => {
            let attemptCount = 0;

            GoogleGenAI.mockImplementation(() => ({
                models: {
                    generateContent: jest.fn().mockImplementation(() => {
                        attemptCount++;
                        if (attemptCount < 3) {
                            return Promise.reject(new Error('API temporarily unavailable'));
                        }
                        return Promise.resolve({
                            candidates: [{
                                content: {
                                    parts: [{
                                        inlineData: {
                                            data: Buffer.from('test').toString('base64'),
                                            mimeType: 'image/png',
                                        },
                                    }],
                                },
                            }],
                        });
                    }),
                },
            }));

            const result = await generateImageWithRetry('Test', {}, 3);
            expect(result.buffer).toBeInstanceOf(Buffer);
            expect(attemptCount).toBe(3);
        }, 20000);

        it('should not retry on validation errors', async () => {
            await expect(generateImageWithRetry('', {}, 3)).rejects.toThrow('Invalid prompt');
        });

        it('should throw after max retries', async () => {
            GoogleGenAI.mockImplementation(() => ({
                models: {
                    generateContent: jest.fn().mockRejectedValue(new Error('Persistent failure')),
                },
            }));

            await expect(generateImageWithRetry('Test', {}, 2)).rejects.toThrow('failed after 2 attempts');
        }, 20000);
    });

    describe('generateMultipleImages', () => {
        beforeEach(() => {
            // Ensure API keys are set for batch tests
            process.env.GEMINI_API_KEYS = 'test-batch-key-1,test-batch-key-2';
        });

        it('should generate multiple images in parallel', async () => {
            const sharedMock = {
                models: {
                    generateContent: jest.fn().mockResolvedValue({
                        candidates: [{
                            content: {
                                parts: [{
                                    inlineData: {
                                        data: Buffer.from('test').toString('base64'),
                                        mimeType: 'image/png',
                                    },
                                }],
                            },
                        }],
                    }),
                },
            };

            GoogleGenAI.mockImplementation(() => sharedMock);

            const prompts = [
                { id: '1', description: 'Sunset' },
                { id: '2', description: 'Mountains' },
                { id: '3', description: 'Ocean' },
            ];

            const results = await generateMultipleImages(prompts);

            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result.id).toBeDefined();
                expect(result.description).toBeDefined();
                expect(result.buffer).toBeInstanceOf(Buffer);
            });
        });

        it('should handle partial failures gracefully', async () => {
            // Use content-based failure detection (robust against parallel timing)
            const sharedMock = {
                models: {
                    generateContent: jest.fn().mockImplementation((config) => {
                        // Always fail for "Bad prompt" image (all retries)
                        if (config.contents && config.contents.includes('Bad prompt')) {
                            return Promise.reject(new Error('Failed for bad prompt image'));
                        }

                        // Success for other images
                        return Promise.resolve({
                            candidates: [{
                                content: {
                                    parts: [{
                                        inlineData: {
                                            data: Buffer.from('test').toString('base64'),
                                            mimeType: 'image/png',
                                        },
                                    }],
                                },
                            }],
                        });
                    }),
                },
            };

            GoogleGenAI.mockImplementation(() => sharedMock);

            const prompts = [
                { id: '1', description: 'Sunset' },
                { id: '2', description: 'Bad prompt' },  // This will always fail
                { id: '3', description: 'Ocean' },
            ];

            const results = await generateMultipleImages(prompts);

            expect(results).toHaveLength(3);

            // Check that image 1 and 3 succeeded
            const successfulResults = results.filter(r => r.buffer);
            expect(successfulResults.length).toBe(2);
            expect(successfulResults[0].id).toBe('1');
            expect(successfulResults[1].id).toBe('3');

            // Check that image 2 failed
            const failedResults = results.filter(r => r.error);
            expect(failedResults.length).toBe(1);
            expect(failedResults[0].id).toBe('2');
            expect(failedResults[0].error).toContain('failed after 3 attempts');
        }, 30000);

        it('should apply global options correctly', async () => {
            let capturedConfig = null;

            const sharedMock = {
                models: {
                    generateContent: jest.fn().mockImplementation((config) => {
                        capturedConfig = config;
                        return Promise.resolve({
                            candidates: [{
                                content: {
                                    parts: [{
                                        inlineData: {
                                            data: Buffer.from('test').toString('base64'),
                                            mimeType: 'image/png',
                                        },
                                    }],
                                },
                            }],
                        });
                    }),
                },
            };

            GoogleGenAI.mockImplementation(() => sharedMock);

            const prompts = [
                { id: '1', description: 'Sunset' },
            ];

            await generateMultipleImages(prompts, { aspectRatio: '21:9', style: 'realistic' });

            expect(capturedConfig.config.imageConfig.aspectRatio).toBe('21:9');
            expect(capturedConfig.contents).toContain('realistic style:');
        });

        it('should allow specific options to override global options', async () => {
            const capturedConfigs = [];

            const sharedMock = {
                models: {
                    generateContent: jest.fn().mockImplementation((config) => {
                        capturedConfigs.push(config);
                        return Promise.resolve({
                            candidates: [{
                                content: {
                                    parts: [{
                                        inlineData: {
                                            data: Buffer.from('test').toString('base64'),
                                            mimeType: 'image/png',
                                        },
                                    }],
                                },
                            }],
                        });
                    }),
                },
            };

            GoogleGenAI.mockImplementation(() => sharedMock);

            const prompts = [
                { id: '1', description: 'Sunset', aspectRatio: '1:1' },
                { id: '2', description: 'Mountains' }, // Should use global 16:9
            ];

            await generateMultipleImages(prompts, { aspectRatio: '16:9' });

            const aspectRatios = capturedConfigs.map(c => c.config.imageConfig.aspectRatio);
            expect(aspectRatios).toContain('1:1');
            expect(aspectRatios).toContain('16:9');
        });
    });
});
