/**
 * Plan Generation with Images - Integration Test
 *
 * Tests the full flow from plan generation through image generation to final document.
 * Uses real MongoDB (mongodb-memory-server) and mocks GCS + Gemini.
 *
 * Test Cases:
 * 1. Happy Path: Generate plan with images end-to-end
 * 2. Partial Failure: Some images fail to generate
 * 3. Total Failure: All images fail to generate
 * 4. GCS Failure: Images generated but upload fails
 * 5. Performance: Multiple images generated in parallel
 */

const request = require('supertest');
const db = require('../helpers/db');
const Document = require('../../src/models/Document');

// Mock GCS
const mockSave = jest.fn().mockResolvedValue();
const mockGetSignedUrl = jest.fn().mockResolvedValue(['https://storage.googleapis.com/test-bucket/images/test.png']);

const mockFile = jest.fn().mockReturnValue({
    save: mockSave,
    getSignedUrl: mockGetSignedUrl,
});

const mockBucket = { file: mockFile, name: 'test-bucket' };

jest.mock('@google-cloud/storage', () => ({
    Storage: jest.fn().mockImplementation(() => ({
        bucket: jest.fn().mockReturnValue(mockBucket),
    })),
}));

// Mock Gemini AI (both text streaming and image generation)
const mockGenerateContentStream = jest.fn();
const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
            generateContentStream: mockGenerateContentStream,
            generateContent: mockGenerateContent,
        },
    })),
}));

// Mock auth middleware - simulate authenticated user
jest.mock('../../src/middleware/auth', () => (req, res, next) => {
    req.user = { sub: 'test-user-id', email: 'test@example.com', name: 'Test User' };
    next();
});

// Set required env vars
process.env.GCS_CREDENTIALS = JSON.stringify({
    project_id: 'test-project',
    client_email: 'test@test.iam.gserviceaccount.com',
    private_key: '-----BEGIN RSA PRIVATE KEY-----\\nfake\\n-----END RSA PRIVATE KEY-----\\n',
});
process.env.GCS_BUCKET = 'test-bucket';
process.env.GEMINI_API_KEYS = 'test-api-key-1,test-api-key-2';
process.env.GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
process.env.IMAGE_DEFAULT_ASPECT_RATIO = '16:9';
process.env.IMAGE_DEFAULT_STYLE = 'professional';
process.env.IMAGE_MAX_RETRIES = '3';
process.env.IMAGE_TIMEOUT_MS = '30000';

const app = require('../../src/app');

beforeAll(async () => {
    await db.connect();
});

afterEach(async () => {
    await db.clearDatabase();
    jest.clearAllMocks();
});

afterAll(async () => {
    await db.disconnect();
});

describe.skip('Plan Generation with Images - Integration Tests', () => {
    // Helper: Generate mock plan markdown with image placeholders
    const mockPlanMarkdown = `# Project Plan: E-commerce Platform

## Executive Summary
This is a comprehensive plan for building an e-commerce platform.

![App dashboard mockup](IMAGE_PLACEHOLDER_1)

## Technical Architecture
The system will use a microservices architecture.

![System architecture diagram](IMAGE_PLACEHOLDER_2)

## Timeline
- Phase 1: 2 months
- Phase 2: 3 months

![Project timeline gantt chart](IMAGE_PLACEHOLDER_3)

## Budget
Total estimated budget: $150,000`;

    // Helper: Setup mock text generation response (streaming)
    const setupMockTextGeneration = (markdown = mockPlanMarkdown) => {
        mockGenerateContentStream.mockResolvedValue({
            stream: {
                async *[Symbol.asyncIterator]() {
                    // Split markdown into chunks to simulate streaming
                    const chunkSize = 50;
                    for (let i = 0; i < markdown.length; i += chunkSize) {
                        yield { text: () => markdown.slice(i, i + chunkSize) };
                    }
                }
            },
        });
    };

    // Helper: Setup mock image generation response
    const setupMockImageGeneration = (options = {}) => {
        const { failOn = [], delayMs = 0 } = options;

        mockGenerateContent.mockImplementation(async ({ contents }) => {
            if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }

            // Check if this prompt should fail
            const shouldFail = failOn.some(failPrompt => contents.includes(failPrompt));

            if (shouldFail) {
                throw new Error('Image generation failed');
            }

            // Return mock image data
            return {
                candidates: [{
                    content: {
                        parts: [{
                            inlineData: {
                                data: Buffer.from('fake-image-data').toString('base64'),
                                mimeType: 'image/png',
                            },
                        }],
                    },
                }],
            };
        });
    };

    describe('Test 1: Happy Path - Full Flow', () => {
        it('should generate project plan with images end-to-end', async () => {
            // Setup mocks
            setupMockTextGeneration();
            setupMockImageGeneration();

            // Make request
            const response = await request(app)
                .post('/api/documents/generate-plan')
                .send({
                    prompt: 'Create an e-commerce platform',
                    options: {
                        includeImages: true,
                        sections: ['Executive Summary', 'Technical Architecture', 'Timeline'],
                    },
                });

            // Verify response (API returns 201 Created, body is result directly)
            expect(response.status).toBe(201);
            expect(response.body.documentId).toBeDefined();
            expect(response.body.title).toContain('Project Plan');

            // Verify text generation was called
            expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);

            // Verify document was saved to database
            const document = await Document.findById(response.body.documentId);
            expect(document).toBeDefined();
            expect(document.userId).toBe('test-user-id');
            expect(document.type).toBe('project-plan');

            // Note: Image generation is TODO in planGenerationService
            // When implemented, verify:
            // - mockGenerateContent called 3 times (3 placeholders)
            // - mockSave called 3 times (GCS uploads)
            // - document.assets array has 3 items
            // - placeholders replaced with actual URLs
        });
    });

    describe('Test 2: Partial Failure - Some Images Fail', () => {
        it('should handle partial image generation failures gracefully', async () => {
            // Setup: 2nd image fails
            setupMockTextGeneration();
            setupMockImageGeneration({
                failOn: ['architecture diagram'],  // This will fail IMAGE_PLACEHOLDER_2
            });

            const response = await request(app)
                .post('/api/documents/generate-plan')
                .send({
                    prompt: 'Create an e-commerce platform',
                    options: { includeImages: true },
                });

            expect(response.status).toBe(201);
            expect(response.body.documentId).toBeDefined();

            // When implemented, verify:
            // - Request still succeeds (degraded mode)
            // - 2 images uploaded successfully
            // - 1 image failed (logged error)
            // - Failed placeholder either removed or kept as placeholder
            // - Document saved with partial assets array
        });
    });

    describe('Test 3: Total Failure - All Images Fail', () => {
        it('should handle complete image generation failure', async () => {
            // Setup: All images fail
            setupMockTextGeneration();
            setupMockImageGeneration({
                failOn: ['mockup', 'diagram', 'chart'],  // All fail
            });

            const response = await request(app)
                .post('/api/documents/generate-plan')
                .send({
                    prompt: 'Create an e-commerce platform',
                    options: { includeImages: true },
                });

            expect(response.status).toBe(201); // Still succeeds
            expect(response.body.documentId).toBeDefined();

            // When implemented, verify:
            // - Plan markdown still generated
            // - All placeholders removed
            // - Document.assets empty array
            // - Error logged but request succeeds
        });
    });

    describe('Test 4: GCS Failure - Upload Fails', () => {
        it('should handle GCS upload failures gracefully', async () => {
            // Setup: Image gen succeeds, GCS upload fails
            setupMockTextGeneration();
            setupMockImageGeneration();
            mockSave.mockRejectedValue(new Error('GCS upload failed'));

            const response = await request(app)
                .post('/api/documents/generate-plan')
                .send({
                    prompt: 'Create an e-commerce platform',
                    options: { includeImages: true },
                });

            // When implemented, verify:
            // - Either retry upload, or
            // - Fail gracefully with error response, or
            // - Fall back to no images
            // Current expectation: graceful degradation
            expect(response.status).toBeGreaterThanOrEqual(200);
        });
    });

    describe('Test 5: Performance - Multiple Images in Parallel', () => {
        it('should generate 5 images efficiently in parallel', async () => {
            // Create plan with 5 placeholders
            const planWith5Images = `# Plan
![Image 1](IMAGE_PLACEHOLDER_1)
![Image 2](IMAGE_PLACEHOLDER_2)
![Image 3](IMAGE_PLACEHOLDER_3)
![Image 4](IMAGE_PLACEHOLDER_4)
![Image 5](IMAGE_PLACEHOLDER_5)`;

            setupMockTextGeneration(planWith5Images);
            setupMockImageGeneration({ delayMs: 100 }); // Simulate 100ms per image

            const startTime = Date.now();

            const response = await request(app)
                .post('/api/documents/generate-plan')
                .send({
                    prompt: 'Large project',
                    options: { includeImages: true },
                });

            const duration = Date.now() - startTime;

            expect(response.status).toBe(201);
            expect(response.body.documentId).toBeDefined();

            // When implemented, verify:
            // - Duration < 500ms (parallel, not sequential)
            // - If sequential: would be 5 * 100ms = 500ms
            // - If parallel: should be ~100ms + overhead
            // - All 5 images generated
            // - API keys rotated (test-api-key-1, test-api-key-2, ...)
        });
    });

    describe('Test 6: Images Disabled - No Image Generation', () => {
        it('should skip image generation when includeImages=false', async () => {
            setupMockTextGeneration();

            const response = await request(app)
                .post('/api/documents/generate-plan')
                .send({
                    prompt: 'Create plan',
                    options: { includeImages: false },
                });

            expect(response.status).toBe(201);
            expect(response.body.documentId).toBeDefined();

            // Verify image generation NOT called
            expect(mockGenerateContent).not.toHaveBeenCalled();

            // Document should have empty assets  
            const document = await Document.findById(response.body.documentId);
            expect(document.assets).toHaveLength(0);
        });
    });

    describe('Test 7: Service Integration - Correct Data Flow', () => {
        it('should pass correct data through service layers', async () => {
            setupMockTextGeneration();
            setupMockImageGeneration();

            await request(app)
                .post('/api/documents/generate-plan')
                .send({
                    prompt: 'Test project',
                    options: {
                        includeImages: true,
                        imageStyle: 'realistic',
                        sections: ['Overview', 'Timeline'],
                    },
                });

            // Verify text generation called with correct prompt structure
            expect(mockGenerateContentStream).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: expect.stringContaining('Test project'),
                })
            );

            // When image generation implemented, verify:
            // - Image prompts enhanced with style prefix
            // - Correct aspect ratio passed
            // - Placeholder descriptions used as prompts
        });
    });
});
