const { GoogleGenAI } = require('@google/genai');
const Document = require('../models/Document');

/**
 * Generate a project plan via AI
 * @param {string} prompt - User's project description
 * @param {Object} options - Generation options (includeImages, imageStyle, sections)
 * @param {string} userId - User ID
 * @param {string} sessionId - Optional session ID to link document
 * @returns {Promise<Object>} Generated document
 */
async function generateProjectPlan(prompt, options = {}, userId, sessionId = null) {
    if (!prompt) {
        throw new Error('Prompt is required');
    }

    if (!userId) {
        throw new Error('userId is required');
    }

    // Step 1: Generate plan structure + content via Gemini
    console.log('[planGeneration] Step 1: Generating plan content');
    const planMarkdown = await generatePlanContent(prompt, options);

    // Step 2: Parse markdown to identify image placeholders
    console.log('[planGeneration] Step 2: Extracting image placeholders');
    const imagePlaceholders = extractImagePlaceholders(planMarkdown);
    console.log(`[planGeneration] Found ${imagePlaceholders.length} image placeholders`);

    // Step 3: Generate images for each placeholder (if images enabled)
    let uploadedImages = [];
    if (options.includeImages !== false && imagePlaceholders.length > 0) {
        console.log('[planGeneration] Step 3: Generating images via Gemini');
        // TODO: Phase 8.2 - Implement image generation
        // const generatedImages = await generatePlanImages(imagePlaceholders);

        // Step 4: Upload images to GCS
        console.log('[planGeneration] Step 4: Uploading images to GCS');
        // TODO: Phase 8.2 - Implement GCS upload
        // uploadedImages = await uploadImagesToGCS(generatedImages, userId);
    }

    // Step 5: Replace placeholders with actual image URLs
    console.log('[planGeneration] Step 5: Replacing placeholders');
    const finalMarkdown = replacePlaceholders(planMarkdown, uploadedImages);

    // Step 6: Convert markdown to BlockNote JSON
    console.log('[planGeneration] Step 6: Converting to BlockNote JSON');
    const blockNoteContent = markdownToBlockNote(finalMarkdown);

    // Step 7: Extract title from plan
    const title = extractTitle(planMarkdown) || `Project Plan: ${prompt.slice(0, 50)}`;

    // Step 8: Save document to database
    console.log('[planGeneration] Step 7: Saving document to database');
    const document = new Document({
        userId,
        sessionId,
        title,
        type: 'project-plan',
        content: blockNoteContent,
        metadata: {
            generatedBy: 'ai',
            prompt,
            model: 'gemini-2.0-flash-exp',
            generatedAt: new Date(),
        },
        assets: uploadedImages,
    });

    await document.save();

    console.log(`[planGeneration] Document created: ${document._id}`);

    return {
        documentId: document._id,
        title: document.title,
        content: document.content,
        assets: document.assets,
    };
}

/**
 * Generate plan content via Gemini AI
 * @param {string} prompt - User's project description
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Generated markdown content
 */
async function generatePlanContent(prompt, options = {}) {
    const { sections } = options;

    // Build prompt template
    const systemPrompt = `You are a project planning expert. Generate a comprehensive, detailed project plan.

Structure the plan with the following sections:
${sections && sections.length > 0 ? sections.map(s => `- ${s}`).join('\n') : `
- Executive Summary
- Project Overview
- Timeline & Milestones
- Team Structure
- Budget Estimate
- Risk Analysis
`}

Use markdown formatting with proper headings (# ## ###), bullet points, and tables where appropriate.

For images, use placeholders in this exact format:
![Description of image](IMAGE_PLACEHOLDER_<NUMBER>)

Example:
![App dashboard mockup showing main features](IMAGE_PLACEHOLDER_1)
![Team org chart](IMAGE_PLACEHOLDER_2)

Include 3-5 image placeholders for visual elements like mockups, diagrams, charts, or illustrations.

Generate realistic, detailed, professional content for each section. Be specific and actionable.`;

    const userPrompt = `Create a project plan for: ${prompt}`;

    // Call Gemini API
    const apiKey = process.env.GEMINI_API_KEYS?.split(',')[0];
    if (!apiKey) {
        throw new Error('GEMINI_API_KEYS not configured');
    }

    const genai = new GoogleGenAI({ apiKey });
    const model = genai.models.get('gemini-2.0-flash-exp');

    const result = await model.generateText({
        prompt: `${systemPrompt}\n\n${userPrompt}`,
    });

    return result.text;
}

/**
 * Extract image placeholders from markdown
 * @param {string} markdown - Markdown content
 * @returns {Array<Object>} Array of {id, description}
 */
function extractImagePlaceholders(markdown) {
    const placeholders = [];
    const regex = /!\[([^\]]+)\]\(IMAGE_PLACEHOLDER_(\d+)\)/g;
    let match;

    while ((match = regex.exec(markdown)) !== null) {
        placeholders.push({
            id: match[2],
            description: match[1],
            placeholder: match[0],
        });
    }

    return placeholders;
}

/**
 * Replace image placeholders with actual URLs
 * @param {string} markdown - Original markdown
 * @param {Array<Object>} images - Array of {id, assetUrl}
 * @returns {string} Markdown with replaced URLs
 */
function replacePlaceholders(markdown, images) {
    if (images.length === 0) {
        // Remove all placeholders if no images
        return markdown.replace(/!\[([^\]]+)\]\(IMAGE_PLACEHOLDER_\d+\)/g, '');
    }

    let result = markdown;
    images.forEach(img => {
        const placeholderRegex = new RegExp(`!\\[([^\\]]+)\\]\\(IMAGE_PLACEHOLDER_${img.id}\\)`, 'g');
        result = result.replace(placeholderRegex, `![$1](${img.assetUrl})`);
    });

    return result;
}

/**
 * Convert markdown to BlockNote JSON format
 * @param {string} markdown - Markdown content
 * @returns {Array<Object>} BlockNote blocks
 */
function markdownToBlockNote(markdown) {
    // TODO: Phase 8.1 - Implement proper markdown to BlockNote conversion
    // For now, return a simple format
    const lines = markdown.split('\n');
    const blocks = [];

    lines.forEach(line => {
        if (line.startsWith('# ')) {
            blocks.push({
                type: 'heading',
                props: { level: 1 },
                content: [{ type: 'text', text: line.slice(2) }],
            });
        } else if (line.startsWith('## ')) {
            blocks.push({
                type: 'heading',
                props: { level: 2 },
                content: [{ type: 'text', text: line.slice(3) }],
            });
        } else if (line.startsWith('### ')) {
            blocks.push({
                type: 'heading',
                props: { level: 3 },
                content: [{ type: 'text', text: line.slice(4) }],
            });
        } else if (line.trim() !== '') {
            blocks.push({
                type: 'paragraph',
                content: [{ type: 'text', text: line }],
            });
        }
    });

    return blocks;
}

/**
 * Extract title from markdown (first H1)
 * @param {string} markdown - Markdown content
 * @returns {string|null} Title or null
 */
function extractTitle(markdown) {
    const match = markdown.match(/^#\s+(.+)$/m);
    return match ? match[1] : null;
}

module.exports = {
    generateProjectPlan,
    generatePlanContent,
    extractImagePlaceholders,
    replacePlaceholders,
    markdownToBlockNote,
    extractTitle,
};
