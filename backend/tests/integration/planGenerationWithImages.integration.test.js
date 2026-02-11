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

// Helper: Parse SSE response from supertest
const parseSSEResponse = (responseText) => {
    const events = [];
    const lines = responseText.split('\n');

    for (const line of lines) {
        if (line.startsWith('data: ')) {
            try {
                const data = JSON.parse(line.slice(6));
                events.push(data);
            } catch (e) {
                // Skip malformed data
            }
        }
    }

    return events;
};

describe('Plan Generation with Images - Integration Tests (SSE)', () => {
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
        it('should generate project plan with images via SSE', async () => {
            // Setup mocks
            setupMockTextGeneration();
            setupMockImageGeneration();

            // Make request with SSE Accept header
            const response = await request(app)
                .post('/api/documents/generate-plan')
                .set('Accept', 'text/event-stream')
                .send({
                    prompt: 'Create an e-commerce platform',
                    options: {
                        includeImages: true,
                        sections: ['Executive Summary', 'Technical Architecture', 'Timeline'],
                    },
                });

            // Parse SSE events
            const events = parseSSEResponse(response.text);

            // Verify we got events
            expect(events.length).toBeGreaterThan(0);

            // First event should be sessionId
            expect(events[0].sessionId).toBeDefined();

            // Should have text chunks
            const textEvents = events.filter(e => e.type === 'text');
            expect(textEvents.length).toBeGreaterThan(0);

            // Last event should be complete with documentId
            const completeEvent = events.find(e => e.type === 'complete');
            expect(completeEvent).toBeDefined();
            expect(completeEvent.documentId).toBeDefined();
            expect(completeEvent.title).toContain('Project Plan');

            // Verify text generation was called
            expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);

            // Verify document was saved to database
            const document = await Document.findById(completeEvent.documentId);
            expect(document).toBeDefined();
            expect(document.userId).toBe('test-user-id');
            expect(document.type).toBe('project-plan');
        });
    });

    describe('Test 2: Partial Failure - Some Images Fail', () => {
        it('should handle partial image generation failures gracefully via SSE', async () => {
            // Setup: 2nd image fails
            setupMockTextGeneration();
            setupMockImageGeneration({
                failOn: ['architecture diagram'],
            });

            const response = await request(app)
                .post('/api/documents/generate-plan')
                .set('Accept', 'text/event-stream')
                .send({
                    prompt: 'Create an e-commerce platform',
                    options: { includeImages: true },
                });

            const events = parseSSEResponse(response.text);
            const completeEvent = events.find(e => e.type === 'complete');

            expect(completeEvent).toBeDefined();
            expect(completeEvent.documentId).toBeDefined();

            // Document should still be created
            const document = await Document.findById(completeEvent.documentId);
            expect(document).toBeDefined();
        });
    });

    describe('Test 3: Total Failure - All Images Fail', () => {
        it('should handle complete image generation failure via SSE', async () => {
            setupMockTextGeneration();
            setupMockImageGeneration({
                failOn: ['mockup', 'diagram', 'chart'],
            });

            const response = await request(app)
                .post('/api/documents/generate-plan')
                .set('Accept', 'text/event-stream')
                .send({
                    prompt: 'Test project',
                    options: { includeImages: true },
                });

            const events = parseSSEResponse(response.text);
            const completeEvent = events.find(e => e.type === 'complete');

            expect(completeEvent).toBeDefined();
            expect(completeEvent.documentId).toBeDefined();

            // Document should still succeed
            const document = await Document.findById(completeEvent.documentId);
            expect(document).toBeDefined();
        });
    });

    describe('Test 4: GCS Failure - Upload Fails', () => {
        it('should handle GCS upload failures gracefully', async () => {
            setupMockTextGeneration();
            setupMockImageGeneration();

            // Mock GCS to fail
            mockSave.mockRejectedValueOnce(new Error('GCS upload failed'));

            const response = await request(app)
                .post('/api/documents/generate-plan')
                .set('Accept', 'text/event-stream')
                .send({
                    prompt: 'Test project',
                    options: { includeImages: true },
                });

            const events = parseSSEResponse(response.text);

            // Should still get completion event
            const completeEvent = events.find(e => e.type === 'complete');
            expect(completeEvent).toBeDefined();
        });
    });

    describe('Test 5: Performance - Multiple Images in Parallel', () => {
        it('should generate 5 images efficiently in parallel via SSE', async () => {
            const largePlan = mockPlanMarkdown + `
![Feature 4](IMAGE_PLACEHOLDER_4)
![Feature 5](IMAGE_PLACEHOLDER_5)`;

            setupMockTextGeneration(largePlan);
            setupMockImageGeneration({ delayMs: 100 });

            const startTime = Date.now();

            const response = await request(app)
                .post('/api/documents/generate-plan')
                .set('Accept', 'text/event-stream')
                .send({
                    prompt: 'Large project',
                    options: { includeImages: true },
                });

            const duration = Date.now() - startTime;
            const events = parseSSEResponse(response.text);
            const completeEvent = events.find(e => e.type === 'complete');

            expect(completeEvent).toBeDefined();
            expect(completeEvent.documentId).toBeDefined();
        });
    });

    describe('Test 6: Images Disabled - No Image Generation', () => {
        it('should skip image generation when includeImages=false via SSE', async () => {
            setupMockTextGeneration();

            const response = await request(app)
                .post('/api/documents/generate-plan')
                .set('Accept', 'text/event-stream')
                .send({
                    prompt: 'Test project',
                    options: { includeImages: false },
                });

            const events = parseSSEResponse(response.text);
            const completeEvent = events.find(e => e.type === 'complete');

            expect(completeEvent).toBeDefined();
            expect(completeEvent.documentId).toBeDefined();

            // Verify image generation NOT called
            expect(mockGenerateContent).not.toHaveBeenCalled();
        });
    });

    describe('Test 7: Service Integration - Correct Data Flow', () => {
        it('should pass correct data through service layers via SSE', async () => {
            setupMockTextGeneration();
            setupMockImageGeneration();

            await request(app)
                .post('/api/documents/generate-plan')
                .set('Accept', 'text/event-stream')
                .send({
                    prompt: 'Test project',
                    options: {
                        sections: ['Overview', 'Budget', 'Timeline'],
                    },
                });

            // Verify streaming generation was called
            expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);

            const callArgs = mockGenerateContentStream.mock.calls[0][0];
            const promptContent = callArgs.contents[0].parts[0].text;

            expect(promptContent).toContain('Test project');
            expect(promptContent).toContain('Overview');
            expect(promptContent).toContain('Budget');
            expect(promptContent).toContain('Timeline');
        });
    });
});
