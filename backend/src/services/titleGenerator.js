const { GoogleGenAI } = require('@google/genai');
const { getNextApiKey } = require('./aiProvider');

/**
 * Generate a short title (5-7 words) for a chat session
 * based on the conversation messages.
 *
 * Uses the cheapest Gemini model for efficiency.
 * Falls back to truncating the first user message if AI fails.
 */
async function generateTitle(messages) {
    // Need at least one user message
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (!firstUserMsg) {
        return 'New Chat';
    }

    const fallbackTitle = firstUserMsg.content.slice(0, 50).trim() +
        (firstUserMsg.content.length > 50 ? '...' : '');

    try {
        const apiKey = getNextApiKey();
        const ai = new GoogleGenAI({ apiKey });

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                role: 'user',
                parts: [{
                    text: `Generate a very short title (3-6 words, no quotes, no punctuation at the end) that summarizes this conversation. Only output the title, nothing else.\n\nConversation:\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`,
                }],
            }],
        });

        const title = result.text?.trim();
        if (title && title.length > 0 && title.length < 100) {
            return title;
        }

        return fallbackTitle;
    } catch (err) {
        console.error('[TitleGenerator] Failed to generate title:', err.message);
        return fallbackTitle;
    }
}

module.exports = { generateTitle };
