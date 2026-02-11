import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const prompt = `Generate a 21:9 ultra-wide infrastructure architecture diagram. Dark navy background with neon glow effects.

Three horizontal layers:

TOP: Three padlock icons for SSL domains, connected to a cloud-shaped "Load Balancer" icon.

MIDDLE (largest): A large rounded rectangle with glowing cyan border labeled "GKE Cluster". 
Two server rack icons on left and right (worker nodes).
Inside, four service pods as colored icon cards in a row:
  * Blue card: React atom logo, text below must say exactly "React"
  * Green card: Node.js hexagon logo, text below must say exactly "Node.js"
  * Orange card: Shield/key logo, text below must say exactly "Keycloak" (K-e-y-c-l-o-a-k)
  * Green card: Leaf database logo, text below must say exactly "MongoDB" (M-o-n-g-o-D-B)
A small storage cylinder icon below for persistent volumes.

BOTTOM: CI/CD pipeline as icons with arrows:
  GitHub octocat → Docker whale → Google Cloud icon → Kubernetes wheel

CRITICAL: The exact text labels must be spelled correctly:
- "React" not "Recat"
- "Node.js" not "Nodejs"  
- "Keycloak" not "Keyclock" or "Keycloack"
- "MongoDB" not "Mongoba" or "Motabasa"

Style: sleek dark theme, neon glow borders, recognizable tech logos, minimal text.`;

async function generateImage() {
    console.log('🎨 Generating with gemini-2.5-flash-image...');
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: prompt,
            config: {
                responseModalities: ['Text', 'Image'],
                imageConfig: {
                    aspectRatio: '21:9',
                },
            },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        const outputDir = path.resolve('../../images');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        for (const part of parts) {
            if (part.text) {
                console.log('📝 Model says:', part.text.substring(0, 200));
            }
            if (part.inlineData) {
                const outputPath = path.join(outputDir, 'infrastructure.png');
                fs.writeFileSync(outputPath, Buffer.from(part.inlineData.data, 'base64'));
                console.log(`✅ Image saved: ${outputPath}`);
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

generateImage();
