'use client';

import type { Slide } from '@/types/editor';
import { buildSrcDoc } from '@/lib/html-parser';

const SLIDE_W = 1280;
const SLIDE_H = 720;

function renderSlideInIframe(headHtml: string, slideHtml: string): Promise<HTMLIFrameElement> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${SLIDE_W}px;height:${SLIDE_H}px;border:none;visibility:hidden;`;
    document.body.appendChild(iframe);

    const srcDoc = buildSrcDoc(headHtml, slideHtml);
    iframe.srcdoc = srcDoc;
    iframe.onload = () => resolve(iframe);
  });
}

export async function exportToPDF(
  headHtml: string,
  slides: Slide[],
  fileName: string,
  onProgress?: (label: string, current: number, total: number) => void,
): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [SLIDE_W, SLIDE_H],
    hotfixes: ['px_scaling'],
  });

  for (let i = 0; i < slides.length; i++) {
    onProgress?.(`スライド ${i + 1}/${slides.length}`, i + 1, slides.length);

    if (i > 0) pdf.addPage([SLIDE_W, SLIDE_H], 'landscape');

    const iframe = await renderSlideInIframe(headHtml, slides[i].html);
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      continue;
    }

    await new Promise((r) => setTimeout(r, 200));

    const slideEl = iframeDoc.querySelector('.slide') || iframeDoc.body;
    const canvas = await html2canvas(slideEl as HTMLElement, {
      width: SLIDE_W,
      height: SLIDE_H,
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: SLIDE_W,
      windowHeight: SLIDE_H,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, SLIDE_W, SLIDE_H);

    document.body.removeChild(iframe);
  }

  const baseName = fileName.replace(/\.(html|htm)$/i, '') || 'slides';
  pdf.save(`${baseName}.pdf`);
}
