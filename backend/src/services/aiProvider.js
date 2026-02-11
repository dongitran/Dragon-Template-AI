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
const { downloadFileToBuffer } = require('./storageService');

/**
 * Build multimodal parts array for a message.
 * For the latest user message with attachments: download files from GCS and send as inlineData.
 * For historical messages: include a text note about attachments but don't re-send binary data.
 *
 * @param {object} msg - Message object { role, content, attachments }
 * @param {boolean} isLatestUserMessage - Whether this is the newest user message
 * @returns {Promise<Array>} - Gemini parts array
 */
async function buildParts(msg, isLatestUserMessage) {
    const parts = [];

    // Only download and send file data for the latest user message
    if (isLatestUserMessage && msg.attachments && msg.attachments.length > 0) {
        for (const attachment of msg.attachments) {
            try {
                const buffer = await downloadFileToBuffer(attachment.fileId);
                const base64Data = buffer.toString('base64');
                parts.push({
                    inlineData: {
                        mimeType: attachment.fileType,
                        data: base64Data,
                    },
                });
            } catch (err) {
                console.error(`[AI Provider] Failed to download attachment ${attachment.fileId}:`, err.message);
                parts.push({ text: `[File: ${attachment.fileName} — could not be loaded]` });
            }
        }
    } else if (msg.attachments && msg.attachments.length > 0) {
        // Historical message with attachments — add text context
        const fileNames = msg.attachments.map(a => a.fileName).join(', ');
        parts.push({ text: `[Previously attached files: ${fileNames}]` });
    }

    // Add text content
    const text = msg.content || '';
    if (text) {
        parts.push({ text });
    } else if (parts.length === 0) {
        // No text and no attachments — shouldn't happen, but fallback
        parts.push({ text: '(empty message)' });
    } else if (!text && isLatestUserMessage && msg.attachments && msg.attachments.length > 0) {
        // File-only message — add a default prompt
        parts.push({ text: 'Please analyze and describe the content of the attached file(s).' });
    }

    return parts;
}

async function* streamChat(providerId, modelId, messages) {
    if (providerId !== 'google') {
        throw new Error(`Unsupported provider: ${providerId}. Currently only 'google' is supported.`);
    }

    const apiKey = getNextApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Convert messages to Gemini format
    // Gemini expects: { role: 'user'|'model', parts: [{ text }] or [{ inlineData }, { text }] }
    const systemInstruction = 'You are Dragon AI, a helpful, friendly, and knowledgeable assistant. Respond in markdown format when appropriate. Be concise but thorough.';

    // Find the last user message index for multimodal handling
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
            lastUserIdx = i;
            break;
        }
    }

    const contents = [];
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const isLatestUser = (i === lastUserIdx);
        const parts = await buildParts(msg, isLatestUser);
        contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts,
        });
    }

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
