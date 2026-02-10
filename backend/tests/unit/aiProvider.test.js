/**
 * AI Provider Service — Unit Tests
 *
 * Tests key rotation, provider config parsing, model resolution, and streaming chat.
 * Uses jest.isolateModules to test module-level env var parsing.
 */

// --- Helper to load aiProvider with custom env vars ---
function loadModuleWithEnv(envOverrides = {}) {
    let mod;
    const originalEnv = { ...process.env };

    // Set env vars BEFORE requiring the module
    Object.assign(process.env, envOverrides);

    jest.isolateModules(() => {
        mod = require('../../src/services/aiProvider');
    });

    // Restore original env
    Object.keys(envOverrides).forEach(key => {
        if (originalEnv[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = originalEnv[key];
        }
    });

    return mod;
}

const SAMPLE_CONFIG = JSON.stringify({
    providers: [
        {
            id: 'google',
            name: 'Google Gemini',
            models: [
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', default: true },
                { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
            ],
        },
    ],
});

const MULTI_PROVIDER_CONFIG = JSON.stringify({
    providers: [
        {
            id: 'google',
            name: 'Google Gemini',
            models: [
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', default: true },
            ],
        },
        {
            id: 'openai',
            name: 'OpenAI',
            models: [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            ],
        },
    ],
});

// =============================================
// KEY ROTATION
// =============================================
describe('AI Provider Service', () => {
    describe('getNextApiKey — key rotation', () => {
        it('should throw when no API keys configured', () => {
            const { getNextApiKey } = loadModuleWithEnv({ GEMINI_API_KEYS: '' });
            expect(() => getNextApiKey()).toThrow('No Gemini API keys configured');
        });

        it('should return single key repeatedly', () => {
            const { getNextApiKey } = loadModuleWithEnv({ GEMINI_API_KEYS: 'key-alpha' });
            expect(getNextApiKey()).toBe('key-alpha');
            expect(getNextApiKey()).toBe('key-alpha');
            expect(getNextApiKey()).toBe('key-alpha');
        });

        it('should round-robin across multiple keys', () => {
            const { getNextApiKey } = loadModuleWithEnv({
                GEMINI_API_KEYS: 'key-a,key-b,key-c',
            });
            expect(getNextApiKey()).toBe('key-a');
            expect(getNextApiKey()).toBe('key-b');
            expect(getNextApiKey()).toBe('key-c');
            expect(getNextApiKey()).toBe('key-a'); // wraps around
        });

        it('should trim whitespace from keys', () => {
            const { getNextApiKey } = loadModuleWithEnv({
                GEMINI_API_KEYS: '  key-1 , key-2 , key-3  ',
            });
            expect(getNextApiKey()).toBe('key-1');
            expect(getNextApiKey()).toBe('key-2');
            expect(getNextApiKey()).toBe('key-3');
        });

        it('should filter out empty keys from trailing commas', () => {
            const { getNextApiKey } = loadModuleWithEnv({
                GEMINI_API_KEYS: 'key-x,,key-y,',
            });
            expect(getNextApiKey()).toBe('key-x');
            expect(getNextApiKey()).toBe('key-y');
            expect(getNextApiKey()).toBe('key-x'); // only 2 valid keys
        });
    });

    // =============================================
    // PROVIDER CONFIG PARSING
    // =============================================
    describe('Provider config parsing', () => {
        it('should return empty providers when AI_PROVIDERS_CONFIG is not set', () => {
            const { getProviders } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: undefined,
            });
            expect(getProviders()).toEqual([]);
        });

        it('should handle invalid JSON in AI_PROVIDERS_CONFIG gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const { getProviders } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: '{invalid-json',
            });
            expect(getProviders()).toEqual([]);
            consoleSpy.mockRestore();
        });

        it('should parse valid config and return providers', () => {
            const { getProviders } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });
            const providers = getProviders();
            expect(providers).toHaveLength(1);
            expect(providers[0].id).toBe('google');
            expect(providers[0].name).toBe('Google Gemini');
            expect(providers[0].models).toHaveLength(2);
        });

        it('should map model fields correctly (id, name, default)', () => {
            const { getProviders } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });
            const model = getProviders()[0].models[0];
            expect(model).toEqual({
                id: 'gemini-2.5-flash',
                name: 'Gemini 2.5 Flash',
                default: true,
            });
        });

        it('should default "default" to false when not specified', () => {
            const { getProviders } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });
            const secondModel = getProviders()[0].models[1];
            expect(secondModel.default).toBe(false);
        });

        it('should support multiple providers with multiple models', () => {
            const { getProviders } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: MULTI_PROVIDER_CONFIG,
            });
            const providers = getProviders();
            expect(providers).toHaveLength(2);
            expect(providers[0].id).toBe('google');
            expect(providers[1].id).toBe('openai');
            expect(providers[1].models).toHaveLength(2);
        });
    });

    // =============================================
    // getDefaultModel
    // =============================================
    describe('getDefaultModel', () => {
        it('should return null when no providers are configured', () => {
            const { getDefaultModel } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: JSON.stringify({ providers: [] }),
            });
            expect(getDefaultModel()).toBeNull();
        });

        it('should return model marked as default', () => {
            const { getDefaultModel } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });
            expect(getDefaultModel()).toEqual({
                providerId: 'google',
                modelId: 'gemini-2.5-flash',
            });
        });

        it('should fallback to first model when no model is marked default', () => {
            const config = JSON.stringify({
                providers: [{
                    id: 'test',
                    name: 'Test',
                    models: [
                        { id: 'model-a', name: 'Model A' },
                        { id: 'model-b', name: 'Model B' },
                    ],
                }],
            });
            const { getDefaultModel } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: config,
            });
            expect(getDefaultModel()).toEqual({
                providerId: 'test',
                modelId: 'model-a',
            });
        });
    });

    // =============================================
    // resolveModel
    // =============================================
    describe('resolveModel', () => {
        it('should return default model when null is passed', () => {
            const { resolveModel, getDefaultModel } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });
            expect(resolveModel(null)).toEqual(getDefaultModel());
        });

        it('should return default model when undefined is passed', () => {
            const { resolveModel, getDefaultModel } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });
            expect(resolveModel(undefined)).toEqual(getDefaultModel());
        });

        it('should resolve "provider/model" format', () => {
            const { resolveModel } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });
            expect(resolveModel('google/gemini-2.5-pro')).toEqual({
                providerId: 'google',
                modelId: 'gemini-2.5-pro',
            });
        });

        it('should resolve model ID by searching across providers', () => {
            const { resolveModel } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: MULTI_PROVIDER_CONFIG,
            });
            const resolved = resolveModel('gpt-4o');
            expect(resolved).toEqual({
                providerId: 'openai',
                modelId: 'gpt-4o',
            });
        });

        it('should return null for unknown model ID', () => {
            const { resolveModel } = loadModuleWithEnv({
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });
            expect(resolveModel('nonexistent-model')).toBeNull();
        });
    });

    // =============================================
    // streamChat
    // =============================================
    describe('streamChat', () => {
        it('should throw for unsupported provider', async () => {
            const { streamChat } = loadModuleWithEnv({
                GEMINI_API_KEYS: 'test-key',
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });

            const stream = streamChat('openai', 'gpt-4o', [
                { role: 'user', content: 'hello' },
            ]);

            await expect(stream.next()).rejects.toThrow('Unsupported provider: openai');
        });

        it('should throw when no API keys configured', async () => {
            const { streamChat } = loadModuleWithEnv({
                GEMINI_API_KEYS: '',
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });

            const stream = streamChat('google', 'gemini-2.5-flash', [
                { role: 'user', content: 'hello' },
            ]);

            await expect(stream.next()).rejects.toThrow('No Gemini API keys configured');
        });

        it('should create GoogleGenAI with correct API key and yield chunks', async () => {
            // Mock @google/genai
            const mockStream = (async function* () {
                yield { text: 'Hello ' };
                yield { text: 'world!' };
            })();

            jest.doMock('@google/genai', () => ({
                GoogleGenAI: jest.fn().mockImplementation(() => ({
                    models: {
                        generateContentStream: jest.fn().mockResolvedValue(mockStream),
                    },
                })),
            }));

            const { streamChat } = loadModuleWithEnv({
                GEMINI_API_KEYS: 'test-api-key',
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });

            const chunks = [];
            for await (const chunk of streamChat('google', 'gemini-2.5-flash', [
                { role: 'user', content: 'hello' },
            ])) {
                chunks.push(chunk);
            }

            expect(chunks).toEqual(['Hello ', 'world!']);

            jest.dontMock('@google/genai');
        });

        it('should convert "assistant" role to "model" for Gemini format', async () => {
            let capturedContents;

            jest.doMock('@google/genai', () => ({
                GoogleGenAI: jest.fn().mockImplementation(() => ({
                    models: {
                        generateContentStream: jest.fn().mockImplementation(({ contents }) => {
                            capturedContents = contents;
                            return (async function* () {
                                yield { text: 'ok' };
                            })();
                        }),
                    },
                })),
            }));

            const { streamChat } = loadModuleWithEnv({
                GEMINI_API_KEYS: 'test-key',
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });

            const messages = [
                { role: 'user', content: 'Hi' },
                { role: 'assistant', content: 'Hello!' },
                { role: 'user', content: 'How are you?' },
            ];

            // Consume the stream
            for await (const _ of streamChat('google', 'gemini-2.5-flash', messages)) { /* drain */ }

            expect(capturedContents).toEqual([
                { role: 'user', parts: [{ text: 'Hi' }] },
                { role: 'model', parts: [{ text: 'Hello!' }] },
                { role: 'user', parts: [{ text: 'How are you?' }] },
            ]);

            jest.dontMock('@google/genai');
        });

        it('should skip chunks with no text', async () => {
            jest.doMock('@google/genai', () => ({
                GoogleGenAI: jest.fn().mockImplementation(() => ({
                    models: {
                        generateContentStream: jest.fn().mockResolvedValue(
                            (async function* () {
                                yield { text: 'Hello' };
                                yield { text: null };
                                yield { text: undefined };
                                yield { text: '' };
                                yield { text: 'World' };
                            })()
                        ),
                    },
                })),
            }));

            const { streamChat } = loadModuleWithEnv({
                GEMINI_API_KEYS: 'test-key',
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });

            const chunks = [];
            for await (const chunk of streamChat('google', 'gemini-2.5-flash', [
                { role: 'user', content: 'test' },
            ])) {
                chunks.push(chunk);
            }

            expect(chunks).toEqual(['Hello', 'World']);

            jest.dontMock('@google/genai');
        });

        it('should use round-robin key rotation across calls', async () => {
            const capturedKeys = [];

            jest.doMock('@google/genai', () => ({
                GoogleGenAI: jest.fn().mockImplementation(({ apiKey }) => {
                    capturedKeys.push(apiKey);
                    return {
                        models: {
                            generateContentStream: jest.fn().mockResolvedValue(
                                (async function* () { yield { text: 'ok' }; })()
                            ),
                        },
                    };
                }),
            }));

            const { streamChat } = loadModuleWithEnv({
                GEMINI_API_KEYS: 'key-1,key-2',
                AI_PROVIDERS_CONFIG: SAMPLE_CONFIG,
            });

            const msg = [{ role: 'user', content: 'hi' }];

            for await (const _ of streamChat('google', 'gemini-2.5-flash', msg)) { /* drain */ }
            for await (const _ of streamChat('google', 'gemini-2.5-flash', msg)) { /* drain */ }
            for await (const _ of streamChat('google', 'gemini-2.5-flash', msg)) { /* drain */ }

            expect(capturedKeys).toEqual(['key-1', 'key-2', 'key-1']);

            jest.dontMock('@google/genai');
        });
    });
});
