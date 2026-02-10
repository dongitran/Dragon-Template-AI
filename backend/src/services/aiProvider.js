const { GoogleGenAI } = require('@google/genai');

// --- Key Rotation ---
const keys = (process.env.GEMINI_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
let keyIndex = 0;

function getNextApiKey() {
    if (keys.length === 0) {
        throw new Error('No Gemini API keys configured. Set GEMINI_API_KEYS in .env');
    }
    const key = keys[keyIndex % keys.length];
    keyIndex++;
    return key;
}

// --- Provider Config ---
let providersConfig = { providers: [] };

try {
    const raw = process.env.AI_PROVIDERS_CONFIG;
    if (raw) {
        providersConfig = JSON.parse(raw);
    }
} catch (err) {
    console.error('[AI Provider] Failed to parse AI_PROVIDERS_CONFIG:', err.message);
}

function getProviders() {
    return providersConfig.providers.map(p => ({
        id: p.id,
        name: p.name,
        models: p.models.map(m => ({
            id: m.id,
            name: m.name,
            default: m.default || false,
        })),
    }));
}

function getDefaultModel() {
    for (const provider of providersConfig.providers) {
        for (const model of provider.models) {
            if (model.default) {
                return { providerId: provider.id, modelId: model.id };
            }
        }
    }
    // Fallback to first model of first provider
    const p = providersConfig.providers[0];
    if (p && p.models.length > 0) {
        return { providerId: p.id, modelId: p.models[0].id };
    }
    return null;
}

function resolveModel(modelString) {
    // modelString format: "providerId/modelId" or just "modelId"
    if (!modelString) {
        return getDefaultModel();
    }

    if (modelString.includes('/')) {
        const [providerId, modelId] = modelString.split('/', 2);
        return { providerId, modelId };
    }

    // Search across providers for matching model ID
    for (const provider of providersConfig.providers) {
        const model = provider.models.find(m => m.id === modelString);
        if (model) {
            return { providerId: provider.id, modelId: model.id };
        }
    }

    return null;
}

// --- Streaming Chat ---
async function* streamChat(providerId, modelId, messages) {
    if (providerId !== 'google') {
        throw new Error(`Unsupported provider: ${providerId}. Currently only 'google' is supported.`);
    }

    const apiKey = getNextApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Convert messages to Gemini format
    // Gemini expects: { role: 'user'|'model', parts: [{ text }] }
    const systemInstruction = 'You are Dragon AI, a helpful, friendly, and knowledgeable assistant. Respond in markdown format when appropriate. Be concise but thorough.';

    const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
    }));

    const response = await ai.models.generateContentStream({
        model: modelId,
        contents,
        config: {
            systemInstruction,
        },
    });

    for await (const chunk of response) {
        const text = chunk.text;
        if (text) {
            yield text;
        }
    }
}

// --- Exports ---
module.exports = {
    getProviders,
    getDefaultModel,
    resolveModel,
    streamChat,
    getNextApiKey, // exported for testing
};
