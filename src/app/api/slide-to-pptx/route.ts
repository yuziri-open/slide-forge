import { exec } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CLAUDE_BIN = process.env.CLAUDE_BIN_PATH || 'claude';
const BASH_PATH = process.env.GIT_BASH_PATH || '';

export async function POST(req: Request) {
  try {
    const { html, headHtml, slideIndex, totalSlides } = await req.json();

    const srcDoc = buildSrcDoc(headHtml, html);

    const prompt = `You are converting an HTML presentation slide to PowerPoint format (pptxgenjs JSON).

Slide ${slideIndex + 1} of ${totalSlides}:

\`\`\`html
${srcDoc}
\`\`\`

Analyze every visual element and return a JSON array of pptxgenjs "operations".
The slide canvas is 1280×720 px = 10" × 5.625" (LAYOUT_16x9).
Convert px → inches using: inches = px * (10/1280)
Convert px font sizes → pt using: pt = px * 0.75

Each operation is one of:

Shape:
{ "op": "shape", "shape": "rect"|"roundRect", "x": number, "y": number, "w": number, "h": number, "fill": { "color": "RRGGBB" } | { "type": "gradient", "stops": [{"position": 0, "color": "RRGGBB"}, {"position": 100, "color": "RRGGBB"}] }, "line": { "type": "none" } | { "color": "RRGGBB", "width": number }, "rectRadius": number (0-0.5, only for roundRect) }

Text:
{ "op": "text", "x": number, "y": number, "w": number, "h": number, "runs": [{ "text": "content", "fontSize": number, "fontFace": "Arial", "color": "RRGGBB", "bold": boolean, "italic": boolean }], "align": "left"|"center"|"right", "valign": "top"|"middle"|"bottom", "fill": { "type": "none" } | { "color": "RRGGBB" } }

Image (data URL or absolute URL):
{ "op": "image", "x": number, "y": number, "w": number, "h": number, "src": "data:..." or "https://..." }

Slide background:
{ "op": "background", "color": "RRGGBB" }

Rules:
- List operations back-to-front (background first, foreground last)
- Use exact pixel positions from the HTML/CSS (getBoundingClientRect equivalent)
- Preserve ALL text content, font families, sizes, weights, colors
- Colors must be 6-digit hex without #
- Return ONLY a valid JSON array, no markdown, no explanation, no code fences`;

    // Write prompt to temp file
    const tmpFile = join(tmpdir(), `slide-prompt-${slideIndex}-${Date.now()}.txt`);
    writeFileSync(tmpFile, prompt, 'utf8');

    try {
      const { stdout, stderr } = await execAsync(
        `"${CLAUDE_BIN}" --print < "${tmpFile.replace(/\//g, '\\')}"`,
        {
          env: {
            ...process.env,
            ...(BASH_PATH ? { CLAUDE_CODE_GIT_BASH_PATH: BASH_PATH } : {}),
          },
          maxBuffer: 1024 * 1024 * 20,
          timeout: 120000,
          ...(BASH_PATH ? { shell: BASH_PATH } : {}),
        }
      );

      unlinkSync(tmpFile);

      // Parse JSON from response (strip any markdown fences if present)
      const cleaned = stdout
        .replace(/^```json\s*/m, '')
        .replace(/^```\s*/m, '')
        .replace(/```\s*$/m, '')
        .trim();

      const ops = JSON.parse(cleaned);
      return Response.json({ ok: true, ops });
    } catch (e: unknown) {
      unlinkSync(tmpFile);
      const err = e as { message?: string; stdout?: string; stderr?: string };
      return Response.json(
        { ok: false, error: err.message, stderr: err.stderr, stdout: err.stdout },
        { status: 500 }
      );
    }
  } catch (e: unknown) {
    const err = e as { message?: string };
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

function buildSrcDoc(headHtml: string, slideHtml: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
${headHtml}
<style>
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; width: 1280px; height: 720px; overflow: hidden; }
.slide { position: absolute !important; inset: 0 !important; opacity: 1 !important; transform: none !important; pointer-events: all !important; display: flex !important; }
</style>
</head>
<body>${slideHtml}</body>
</html>`;
}
