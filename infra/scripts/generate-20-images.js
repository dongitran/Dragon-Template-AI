import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const INFRA_CONTEXT = `Dragon Template AI infrastructure:
- GKE Cluster (Google Kubernetes Engine) with 2 worker nodes
- Frontend: React SPA served by nginx (port 8080)
- Backend: Node.js + Express API (port 3001)
- Keycloak: SSO Authentication (port 8080)
- MongoDB: Database (port 27017)
- GCS: Google Cloud Storage for file uploads
- Google Gemini AI: AI chat engine
- Load Balancer: GCP HTTP(S) LB with SSL (3 domains)
- CI/CD: GitHub Actions → Docker → Artifact Registry → GKE
- Domains: dragon-template.xyz, api.dragon-template.xyz, keycloak.dragon-template.xyz`;

const prompts = [
  {
    name: '01-neon-cyberpunk',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram in cyberpunk neon style.
${INFRA_CONTEXT}

Style: Deep black/dark purple background. All borders and connections use bright neon cyan and magenta glow effects. Service icons float in glowing hexagonal cards. Thin neon lines connect services. Title "Dragon Template AI" in large neon text at top. The GKE cluster is a large transparent container with electric blue border. CI/CD pipeline flows along the bottom as a glowing pipeline with arrows. Very dark, very glowing, very cyberpunk. Professional and sleek.`
  },
  {
    name: '02-clean-white-minimal',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram in clean minimalist white style.
${INFRA_CONTEXT}

Style: Pure white background with subtle light gray grid. Services shown as clean rounded rectangle cards with soft shadows. Each service has a simple flat-color icon (React blue, Node green, Keycloak orange, MongoDB green, GCS blue). Thin gray lines connect services. Title "Dragon Template AI" in clean dark sans-serif font. Very Apple-like aesthetic. Lots of whitespace. Minimal colors. Elegant and modern.`
  },
  {
    name: '03-isometric-3d',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram in isometric 3D style.
${INFRA_CONTEXT}

Style: Light gradient background (white to soft blue). All infrastructure components rendered as colorful isometric 3D blocks/cubes sitting on an isometric grid. The GKE cluster is a large isometric platform. Each service is a colorful 3D cube with its logo on the front face. Worker nodes are server rack shapes. CI/CD pipeline shown as conveyor belt with isometric arrows. Title "Dragon Template AI" at top. Clean, colorful, playful 3D look.`
  },
  {
    name: '04-blueprint-engineering',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram in engineering blueprint style.
${INFRA_CONTEXT}

Style: Classic blueprint aesthetic - dark navy blue background with white/light blue technical line drawings. All components drawn as technical schematic symbols. Grid lines visible in background. Dashed lines for connections. Service names in monospace font. Title "Dragon Template AI - System Architecture" in upper left corner block. Looks like a real engineering technical drawing. Professional, precise, detailed.`
  },
  {
    name: '05-gradient-saas',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram in modern SaaS marketing style.
${INFRA_CONTEXT}

Style: Rich gradient background from deep indigo to purple to pink. Service components shown as frosted glass cards with blur effects, arranged in a clean layout. Each card has a white icon and label. Flowing curved lines connect services. Large "Dragon Template AI" title in bold white. Decorative gradient orbs and soft light effects in background. The style of modern tech startup landing pages. Premium, polished, marketing-ready.`
  },
  {
    name: '06-dark-glassmorphism',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram using glassmorphism design.
${INFRA_CONTEXT}

Style: Dark background with colorful gradient blobs (purple, blue, pink). All service cards use frosted glass effect (semi-transparent white with blur backdrop). Each card has a subtle white border glow. Service icons are clean white outlines. Connections are thin semi-transparent white lines. Title "Dragon Template AI" in frosted glass banner. Very trendy modern UI style. Beautiful depth and layering.`
  },
  {
    name: '07-retro-poster',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram as a retro tech poster.
${INFRA_CONTEXT}

Style: Retro color palette - warm oranges, teals, mustard yellow, cream background with subtle paper texture. Services shown as vintage badge/stamp designs. Bold retro typography for title "Dragon Template AI". Halftone dot patterns. Rounded corners on everything. 1960s-70s tech poster aesthetic. Connections as dotted lines with arrow heads. Fun, nostalgic, unique.`
  },
  {
    name: '08-illustrated-cloud',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram as a friendly cloud illustration.
${INFRA_CONTEXT}

Style: Soft pastel sky gradient background (light blue to white). The GKE cluster shown as a large friendly cloud shape. Services are cute illustrated icons floating inside/around the cloud. Small dragon mascot icon near the title. Flowing connections with small cloud puffs. Title "Dragon Template AI" in friendly rounded font. Illustrated style like a children's tech book but still professional. Warm and approachable.`
  },
  {
    name: '09-terminal-matrix',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram in terminal/matrix hacker style.
${INFRA_CONTEXT}

Style: Pure black background. Everything drawn in green monospace text and ASCII-art style borders. Service boxes made of ┌─┐│└─┘ characters. Connection lines made of arrows ──▶. Binary/hex numbers subtly rain in the background (Matrix effect). Title "DRAGON TEMPLATE AI" in large ASCII art at top. All text in green phosphor terminal color. Looks like a hacker's system monitoring screen. Raw, technical, cool.`
  },
  {
    name: '10-material-design',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram in Google Material Design style.
${INFRA_CONTEXT}

Style: Clean white background. Service cards use Material Design elevation/shadow system. Each card has a bold color header bar (React: blue #2196F3, Node: green #4CAF50, Keycloak: amber #FF9800, MongoDB: green #43A047, GCS: blue #1976D2). Material icons used throughout. Roboto-like typography. Material Design ripple/wave decorative elements. Title "Dragon Template AI" with Material-style toolbar at top. Google's design language, clean and organized.`
  },
  {
    name: '11-watercolor-tech',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram with watercolor art style.
${INFRA_CONTEXT}

Style: White/cream background with watercolor paint splashes as decorative elements. Service components shown as clean icons on watercolor color spots (blue splash for React, green for Node.js, orange for Keycloak, etc). Connections as flowing watercolor brush strokes. Title "Dragon Template AI" in elegant serif font with watercolor underline. Artistic and unique fusion of tech and art. Beautiful and gallery-worthy.`
  },
  {
    name: '12-flat-pastel',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram in flat pastel design.
${INFRA_CONTEXT}

Style: Soft pastel lavender background. Services shown as flat design cards with no shadows - just solid pastel colors (pastel blue, mint green, peach orange, sage green). Simple geometric icons for each service. Thin solid lines for connections. Title "Dragon Template AI" in clean sans-serif. Everything uses muted pastel tones. Scandinavian-inspired minimal design. Calm, elegant, modern.`
  },
  {
    name: '13-dark-mesh-gradient',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram with mesh gradient dark theme.
${INFRA_CONTEXT}

Style: Dark background with beautiful mesh gradient blending deep navy, dark purple, and dark teal. Service cards are semi-transparent dark cards with thin bright borders that glow. Each service has a small colorful gradient icon. Smooth gradient lines for connections. Title "Dragon Template AI" with gradient text (cyan to purple). Decorative mesh gradient orbs float in background. Modern, premium, editorial quality. Like a Stripe or Linear website dark mode.`
  },
  {
    name: '14-infographic-bold',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram as a bold infographic.
${INFRA_CONTEXT}

Style: White background with bold, high-contrast design. Large colorful icons for each service. Thick connection lines with directional arrows. Bold sans-serif typography. Stats callouts (e.g. "3 SSL Domains", "2 Worker Nodes", "5 Microservices"). Color-coded sections. Title "Dragon Template AI" in large bold black text. Infographic-style flow from left to right showing the full stack. Data-driven, clear, impactful.`
  },
  {
    name: '15-tech-noir',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram in tech noir cinematic style.
${INFRA_CONTEXT}

Style: Very dark background, almost black. Dramatic directional lighting from top-left creating shadows. Services shown as dark metallic cards with subtle silver/chrome edges catching light. Single accent color: electric blue for highlights, connection lines, and glowing dots. Title "Dragon Template AI" in thin elegant silver text. Film noir atmosphere meets tech. Moody, dramatic, premium. Like a movie poster for a tech thriller.`
  },
  {
    name: '16-geometric-abstract',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram using geometric abstract art.
${INFRA_CONTEXT}

Style: White background. Services represented as geometric shapes - circles, triangles, hexagons - in bold primary colors. Each shape contains a minimal service icon. Connections are clean straight lines intersecting at angles. Abstract geometric patterns fill negative space. Bauhaus/Swiss design inspired. Title "Dragon Template AI" in geometric sans-serif. Art-meets-architecture aesthetic. Bold, graphic, distinctive.`
  },
  {
    name: '17-space-galaxy',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram with a space/galaxy theme.
${INFRA_CONTEXT}

Style: Deep space background with stars, nebula colors (purple, blue, pink). The GKE cluster shown as a space station or orbital ring. Each service is a small planet/satellite with its icon. Connections are orbital paths or light beams. The Load Balancer is a central star. CI/CD pipeline shown as a rocket trail. A small dragon constellation in the corner. Title "Dragon Template AI" in glowing star-like text. Epic, cosmic, imaginative.`
  },
  {
    name: '18-circuit-board',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram in circuit board PCB style.
${INFRA_CONTEXT}

Style: Dark green PCB board background with copper/gold trace patterns. Service components shown as IC chips/components soldered onto the board. Connection lines are copper traces with right-angle routing. Solder points as small gold circles at connections. Each chip is labeled with the service name. Title "Dragon Template AI" etched into the board silkscreen (white text). LED indicator dots glow near each service. Technical, hardware-inspired, unique.`
  },
  {
    name: '19-zen-japanese',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram in Japanese zen minimalist style.
${INFRA_CONTEXT}

Style: Off-white/rice paper textured background. Services represented as simple ink brush stroke circles (enso style) with minimal kanji-inspired labels in English. Thin brush stroke lines for connections. A lot of empty space (ma concept). Subtle ink wash gradient at edges. Title "Dragon Template AI" in elegant thin serif. A small ink brush dragon motif. Zen garden-inspired arrangement. Peaceful, refined, artistic.`
  },
  {
    name: '20-holographic-iridescent',
    prompt: `Create a 21:9 ultra-wide infrastructure diagram with holographic/iridescent style.
${INFRA_CONTEXT}

Style: Dark background. All service cards and connections have iridescent/holographic rainbow sheen effect (shifting colors like a hologram). Cards have thin prismatic borders that refract light into rainbow colors. Connection lines shimmer with holographic effect. Title "Dragon Template AI" in chrome/holographic text. Subtle light leak effects and prismatic flares. Futuristic, premium, eye-catching. Like a holographic trading card.`
  },
];

async function generateImage(ai, promptObj, index) {
  const { name, prompt } = promptObj;
  console.log(`\n🎨 [${index + 1}/20] Generating: ${name}...`);

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
    const outputDir = path.resolve('../../images/infra-variants');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let saved = false;
    for (const part of parts) {
      if (part.text) {
        console.log(`   📝 ${part.text.substring(0, 100)}`);
      }
      if (part.inlineData) {
        const outputPath = path.join(outputDir, `${name}.png`);
        fs.writeFileSync(outputPath, Buffer.from(part.inlineData.data, 'base64'));
        console.log(`   ✅ Saved: images/infra-variants/${name}.png`);
        saved = true;
      }
    }

    if (!saved) {
      console.log(`   ⚠️  No image returned for ${name}`);
    }

    return saved;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🐉 Dragon Template AI - Infrastructure Image Generator');
  console.log('=' .repeat(60));
  console.log(`Generating 20 different styles...\n`);

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  let success = 0;
  let failed = 0;

  for (let i = 0; i < prompts.length; i++) {
    const ok = await generateImage(ai, prompts[i], i);
    if (ok) success++;
    else failed++;

    // Small delay between requests to avoid rate limiting
    if (i < prompts.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`🏁 Done! Success: ${success}, Failed: ${failed}`);
  console.log(`📁 Images saved to: images/infra-variants/`);
}

main();
