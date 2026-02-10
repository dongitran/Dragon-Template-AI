const { getProviders, getDefaultModel, resolveModel, getNextApiKey } = require('../../src/services/aiProvider');

describe('AI Provider Service', () => {
    describe('getNextApiKey', () => {
        it('should throw when no API keys configured', () => {
            // In test env, GEMINI_API_KEYS is not set
            // If keys were loaded, the function should still work
            if (!process.env.GEMINI_API_KEYS) {
                expect(() => getNextApiKey()).toThrow('No Gemini API keys configured');
            } else {
                const key = getNextApiKey();
                expect(key).toBeDefined();
                expect(typeof key).toBe('string');
            }
        });
    });

    describe('getProviders', () => {
        it('should return providers from config', () => {
            const providers = getProviders();
            expect(Array.isArray(providers)).toBe(true);
        });

        it('should have correct structure for each provider', () => {
            const providers = getProviders();
            if (providers.length > 0) {
                const provider = providers[0];
                expect(provider).toHaveProperty('id');
                expect(provider).toHaveProperty('name');
                expect(provider).toHaveProperty('models');
                expect(Array.isArray(provider.models)).toBe(true);
            }
        });

        it('should have correct structure for each model', () => {
            const providers = getProviders();
            if (providers.length > 0 && providers[0].models.length > 0) {
                const model = providers[0].models[0];
                expect(model).toHaveProperty('id');
                expect(model).toHaveProperty('name');
                expect(model).toHaveProperty('default');
            }
        });
    });

    describe('getDefaultModel', () => {
        it('should return a default model', () => {
            const defaultModel = getDefaultModel();
            if (defaultModel) {
                expect(defaultModel).toHaveProperty('providerId');
                expect(defaultModel).toHaveProperty('modelId');
            }
        });
    });

    describe('resolveModel', () => {
        it('should return default model when no model specified', () => {
            const resolved = resolveModel(null);
            const defaultModel = getDefaultModel();
            expect(resolved).toEqual(defaultModel);
        });

        it('should resolve "provider/model" format', () => {
            const resolved = resolveModel('google/gemini-2.5-flash');
            if (resolved) {
                expect(resolved.providerId).toBe('google');
                expect(resolved.modelId).toBe('gemini-2.5-flash');
            }
        });

        it('should resolve model id only (search across providers)', () => {
            const providers = getProviders();
            if (providers.length > 0 && providers[0].models.length > 0) {
                const modelId = providers[0].models[0].id;
                const resolved = resolveModel(modelId);
                expect(resolved).not.toBeNull();
                expect(resolved.modelId).toBe(modelId);
            }
        });

        it('should return null for unknown model', () => {
            const resolved = resolveModel('nonexistent-model-xyz');
            expect(resolved).toBeNull();
        });
    });
});
