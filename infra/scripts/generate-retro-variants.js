import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyB3pNlo-lb48YfvXzIWOPzgxv5aG42dXiA';

const PROMPT = `Create a 21:9 ultra-wide infrastructure diagram as a retro tech poster.
Dragon Template AI infrastructure:
- GKE Cluster (Google Kubernetes Engine) with 2 worker nodes
- Frontend: React SPA served by nginx (port 8080)
- Backend: Node.js + Express API (port 3001)
- Keycloak: SSO Authentication (port 8080)
- MongoDB: Database (port 27017)
- GCS: Google Cloud Storage for file uploads
- AI Engines: Google Gemini, OpenAI (GPT), Anthropic Claude
- Load Balancer: GCP HTTP(S) LB with SSL (3 domains)
- CI/CD: GitHub Actions → Docker → Artifact Registry → GKE
- Domains: dragon-template.xyz, api.dragon-template.xyz, keycloak.dragon-template.xyz

Style: Retro color palette - warm oranges, teals, mustard yellow, cream background with subtle paper texture. Services shown as vintage badge/stamp designs. Bold retro typography for title "Dragon Template AI". Halftone dot patterns. Rounded corners on everything. 1960s-70s tech poster aesthetic. Connections as dotted lines with arrow heads. Fun, nostalgic, unique.`;

const TOTAL = 10;

async function main() {
  console.log('🐉 Dragon Template AI - Retro Poster Variants (same style, 10 runs)');
  console.log('='.repeat(60));

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const outputDir = path.resolve('../../images/retro-variants');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let success = 0;

  for (let i = 0; i < TOTAL; i++) {
    const name = `retro-${String(i + 1).padStart(2, '0')}`;
    console.log(`\n🎨 [${i + 1}/${TOTAL}] Generating: ${name}...`);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: PROMPT,
        config: {
          responseModalities: ['Text', 'Image'],
          imageConfig: { aspectRatio: '21:9' },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      let saved = false;
      for (const part of parts) {
        if (part.text) console.log(`   📝 ${part.text.substring(0, 100)}`);
        if (part.inlineData) {
          fs.writeFileSync(
            path.join(outputDir, `${name}.png`),
            Buffer.from(part.inlineData.data, 'base64')
          );
          console.log(`   ✅ Saved: images/retro-variants/${name}.png`);
          saved = true;
        }
      }
      if (saved) success++;
      else console.log(`   ⚠️  No image returned`);
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }

    if (i < TOTAL - 1) await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n' + '='.repeat(60));
  console.log(`🏁 Done! Success: ${success}/${TOTAL}`);
  console.log(`📁 Images saved to: images/retro-variants/`);
}

main();
