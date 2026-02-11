const { GoogleGenAI } = require('@google/genai');

// --- Configuration (REQUIRED from env) ---
if (!process.env.GEMINI_IMAGE_MODEL) {
    throw new Error('GEMINI_IMAGE_MODEL env variable is required. Set it to the image generation model name (e.g., gemini-2.5-flash-image)');
}

if (!process.env.IMAGE_DEFAULT_ASPECT_RATIO) {
    throw new Error('IMAGE_DEFAULT_ASPECT_RATIO env variable is required. Set it to a valid aspect ratio (e.g., 16:9)');
}

if (!process.env.IMAGE_DEFAULT_STYLE) {
    throw new Error('IMAGE_DEFAULT_STYLE env variable is required. Set it to the default image style (e.g., professional)');
}

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL;
const DEFAULT_ASPECT_RATIO = process.env.IMAGE_DEFAULT_ASPECT_RATIO;
const DEFAULT_STYLE = process.env.IMAGE_DEFAULT_STYLE;
const MAX_RETRIES = parseInt(process.env.IMAGE_MAX_RETRIES || '3', 10);
const TIMEOUT_MS = parseInt(process.env.IMAGE_TIMEOUT_MS || '30000', 10);


// Valid aspect ratios
const VALID_ASPECT_RATIOS = ['1:1', '16:9', '21:9', '9:16', '4:3'];

// --- Key Rotation (shared pattern from aiProvider.js) ---
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

/**
 * Validate image generation prompt
 * @param {string} prompt - Image description
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateImagePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') {
        return { valid: false, error: 'Prompt must be a non-empty string' };
    }

    if (prompt.trim().length === 0) {
        return { valid: false, error: 'Prompt cannot be empty or whitespace only' };
    }

    if (prompt.length > 5000) {
        return { valid: false, error: 'Prompt too long (max 5000 characters)' };
    }

    return { valid: true };
}

/**
 * Validate aspect ratio
 * @param {string} aspectRatio -  Aspect ratio (e.g., '16:9')
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateAspectRatio(aspectRatio) {
    if (!VALID_ASPECT_RATIOS.includes(aspectRatio)) {
        return {
            valid: false,
            error: `Invalid aspect ratio '${aspectRatio}'. Valid options: ${VALID_ASPECT_RATIOS.join(', ')}`,
        };
    }
    return { valid: true };
}

/**
 * Generate a single image using Gemini 2.5 Flash Image model
 * @param {string} prompt - Description of desired image
 * @param {Object} options - Generation options
 * @param {string} options.aspectRatio - Image aspect ratio (default: '16:9')
 * @param {string} options.style - Style prefix (default: 'professional')
 * @param {boolean} options.includeText - Whether to request text response (default: false)
 * @returns {Promise<Object>} { buffer: Buffer, mimeType: string, text?: string }
 */
async function generateImage(prompt, options = {}) {
    const startTime = Date.now();

    // Validate prompt
    const promptValidation = validateImagePrompt(prompt);
    if (!promptValidation.valid) {
        throw new Error(`Invalid prompt: ${promptValidation.error}`);
    }

    // Extract and validate options
    const aspectRatio = options.aspectRatio || DEFAULT_ASPECT_RATIO;
    const style = options.style || DEFAULT_STYLE;
    const includeText = options.includeText !== undefined ? options.includeText : false;

    const aspectRatioValidation = validateAspectRatio(aspectRatio);
    if (!aspectRatioValidation.valid) {
        throw new Error(aspectRatioValidation.error);
    }

    // Enhance prompt with style
    const enhancedPrompt = `${style} style: ${prompt}`;

    console.log(`[ImageGen] Generating image: "${prompt.substring(0, 50)}..." (${aspectRatio})`);

    // Get API key (with rotation)
    const apiKey = getNextApiKey();
    const ai = new GoogleGenAI({ apiKey });

    try {
        // Generate image with timeout
        const response = await Promise.race([
            ai.models.generateContent({
                model: IMAGE_MODEL,
                contents: enhancedPrompt,
                config: {
                    responseModalities: includeText ? ['Text', 'Image'] : ['Image'],
                    imageConfig: {
                        aspectRatio,
                    },
                },
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Image generation timeout')), TIMEOUT_MS)
            ),
        ]);

        // Parse response
        const parts = response.candidates?.[0]?.content?.parts || [];

        let imageBuffer = null;
        let mimeType = null;
        let text = null;

        for (const part of parts) {
            if (part.inlineData) {
                imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                mimeType = part.inlineData.mimeType || 'image/png';
            }
            if (part.text) {
                text = part.text;
            }
        }

        if (!imageBuffer) {
            throw new Error('No image data in API response');
        }

        const duration = Date.now() - startTime;
        console.log(`[ImageGen] ✓ Generated image in ${duration}ms (${Math.round(imageBuffer.length / 1024)}KB)`);

        return {
            buffer: imageBuffer,
            mimeType,
            text,
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[ImageGen] ✗ Failed after ${duration}ms:`, error.message);
        throw error;
    }
}

/**
 * Generate image with retry logic for transient errors
 * @param {string} prompt - Image description
 * @param {Object} options - Generation options
 * @param {number} maxRetries - Maximum retry attempts (default: from env)
 * @returns {Promise<Object>} { buffer, mimeType, text? }
 */
async function generateImageWithRetry(prompt, options = {}, maxRetries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await generateImage(prompt, options);
        } catch (error) {
            // Don't retry on validation errors
            if (error.message.includes('Invalid prompt') || error.message.includes('Invalid aspect ratio')) {
                throw error;
            }

            // Last attempt - throw error
            if (attempt === maxRetries) {
                throw new Error(`Image generation failed after ${maxRetries} attempts: ${error.message}`);
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempt - 1) * 1000;
            console.warn(`[ImageGen] Attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Generate multiple images in parallel
 * @param {Array<Object>} prompts - Array of {id, description, ...options}
 * @param {Object} globalOptions - Options to apply to all images
 * @returns {Promise<Array<Object>>} Array of {id, buffer, mimeType, text?, error?}
 */
async function generateMultipleImages(prompts, globalOptions = {}) {
    console.log(`[ImageGen] Generating ${prompts.length} images in parallel...`);
    const startTime = Date.now();

    const imagePromises = prompts.map(async (promptObj) => {
        try {
            const { id, description, ...specificOptions } = promptObj;
            const options = { ...globalOptions, ...specificOptions };

            const result = await generateImageWithRetry(description, options);

            return {
                id,
                description,
                buffer: result.buffer,
                mimeType: result.mimeType,
                text: result.text,
            };
        } catch (error) {
            console.error(`[ImageGen] Failed to generate image ${promptObj.id}:`, error.message);
            return {
                id: promptObj.id,
                description: promptObj.description,
                error: error.message,
            };
        }
    });

    const results = await Promise.all(imagePromises);

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => !r.error).length;
    const failureCount = results.length - successCount;

    console.log(`[ImageGen] ✓ Completed ${successCount}/${results.length} images in ${duration}ms (${failureCount} failures)`);

    return results;
}

module.exports = {
    generateImage,
    generateImageWithRetry,
    generateMultipleImages,
    validateImagePrompt,
    validateAspectRatio,
    VALID_ASPECT_RATIOS,
};
