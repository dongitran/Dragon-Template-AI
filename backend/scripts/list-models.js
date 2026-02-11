const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

async function listModels() {
    const apiKeys = process.env.GEMINI_API_KEYS?.split(',') || [];
    if (apiKeys.length === 0) {
        console.error('No API keys found');
        return;
    }

    for (const apiKey of apiKeys) {
        console.log(`\nTesting key: ${apiKey.substring(0, 10)}...`);
        const ai = new GoogleGenAI({ apiKey });
        try {
            const result = await ai.models.list();
            console.log('✅ Success! Available models:');
            for await (const model of result) {
                console.log(`- ${model.name}`);
            }
        } catch (e) {
            console.error(`❌ Failed: ${e.message}`);
        }
    }
}

listModels();
