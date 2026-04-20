'use client';

import type { Slide } from '@/types/editor';

const SLIDE_W_IN = 10;
const SLIDE_H_IN = 5.625;

async function imageToDataUrl(src: string): Promise<string | null> {
  try {
    if (src.startsWith('data:')) return src;
    const r = await fetch(src);
    const b = await r.blob();
    return new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => res(null);
      fr.readAsDataURL(b);
    });
  } catch { return null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Op = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyOp(slide: any, op: Op): Promise<void> {
  switch (op.op) {
    case 'background':
      slide.background = { color: op.color };
      break;

    case 'shape':
      slide.addShape(op.shape || 'rect', {
        x: op.x, y: op.y, w: op.w, h: op.h,
        fill: op.fill ?? { type: 'none' },
        line: op.line ?? { type: 'none' },
        ...(op.rectRadius != null ? { rectRadius: op.rectRadius } : {}),
      });
      break;

    case 'text': {
      const runs = (op.runs ?? []).map((r: Op) => ({
        text: r.text ?? '',
        options: {
          fontSize: r.fontSize ?? 14,
          fontFace: r.fontFace ?? 'Arial',
          color: r.color ?? '000000',
          bold: r.bold ?? false,
          italic: r.italic ?? false,
          ...(r.underline ? { underline: { style: 'sng' } } : {}),
        },
      }));
      if (runs.length === 0) break;
      slide.addText(runs, {
        x: op.x, y: op.y, w: op.w, h: op.h,
        align: op.align ?? 'left',
        valign: op.valign ?? 'top',
        wrap: true,
        fill: op.fill ?? { type: 'none' },
        line: { type: 'none' },
      });
      break;
    }

    case 'image': {
      const dataUrl = await imageToDataUrl(op.src);
      if (!dataUrl) break;
      slide.addImage({ data: dataUrl, x: op.x, y: op.y, w: op.w, h: op.h });
      break;
    }
  }
}

export async function exportToPPTX(
  headHtml: string,
  slides: Slide[],
  fileName: string,
  onProgress?: (label: string, current: number, total: number) => void
): Promise<void> {
  const pptxgenjs = (await import('pptxgenjs')).default;
  const pptx = new pptxgenjs();
  pptx.layout = 'LAYOUT_16x9';

  const total = slides.length * 2;
  let step = 0;

  for (let i = 0; i < slides.length; i++) {
    const label = `スライド ${i + 1}/${slides.length}`;

    // Ask Claude CLI to analyze the slide and return pptxgenjs ops
    onProgress?.(`${label} — Claude解析中...`, ++step, total);

    let ops: Op[] = [];
    try {
      const res = await fetch('/api/slide-to-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: slides[i].html,
          headHtml,
          slideIndex: i,
          totalSlides: slides.length,
        }),
      });
      const json = await res.json();
      if (json.ok && Array.isArray(json.ops)) {
        ops = json.ops;
      } else {
        console.error('Claude API error:', json);
        throw new Error(json.error ?? 'Unknown error from API');
      }
    } catch (e) {
      console.error('Failed to get ops from Claude:', e);
      throw e;
    }

    // Build the PPTX slide from Claude's ops
    onProgress?.(`${label} — PPTX生成`, ++step, total);
    const pptxSlide = pptx.addSlide();

    // Default white background if not specified
    let hasBg = false;
    for (const op of ops) {
      if (op.op === 'background') { hasBg = true; break; }
    }
    if (!hasBg) pptxSlide.background = { color: 'FFFFFF' };

    for (const op of ops) {
      await applyOp(pptxSlide, op);
    }
  }

  const baseName = fileName.replace(/\.(html|htm)$/i, '') || 'slides';
  await pptx.writeFile({ fileName: `${baseName}.pptx` });
}

export { SLIDE_W_IN, SLIDE_H_IN };
