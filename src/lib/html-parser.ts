import { Slide, CSSVariable } from '@/types/editor';

export interface ParseResult {
  headHtml: string;
  slides: Slide[];
  cssVariables: CSSVariable[];
}

export function parseHTMLSlides(html: string): ParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const headHtml = doc.head.innerHTML;

  // Extract CSS variables from :root
  const cssVariables = extractCSSVariables(html);

  // Detect slides
  let slideElements: Element[] = [];

  const divSlides = doc.querySelectorAll('div.slide, section.slide');
  if (divSlides.length > 0) {
    slideElements = Array.from(divSlides);
  }

  if (slideElements.length === 0) {
    const sections = doc.querySelectorAll('section');
    if (sections.length > 0) slideElements = Array.from(sections);
  }

  if (slideElements.length === 0) {
    const bodyDivs = doc.querySelectorAll('body > div');
    if (bodyDivs.length > 0) slideElements = Array.from(bodyDivs);
  }

  // Fallback: treat body content as single slide
  if (slideElements.length === 0) {
    return {
      headHtml,
      cssVariables,
      slides: [{ id: 'slide-0', html: doc.body.innerHTML }],
    };
  }

  const slides: Slide[] = slideElements.map((el, index) => ({
    id: `slide-${index}`,
    html: el.outerHTML,
  }));

  return { headHtml, slides, cssVariables };
}

export function extractCSSVariables(html: string): CSSVariable[] {
  const vars: CSSVariable[] = [];
  const rootRegex = /:root\s*\{([^}]+)\}/g;

  let rootMatch;
  while ((rootMatch = rootRegex.exec(html)) !== null) {
    const rootContent = rootMatch[1];
    const varRegex = /(--[\w-]+)\s*:\s*([^;]+)/g;
    let varMatch;
    while ((varMatch = varRegex.exec(rootContent)) !== null) {
      const name = varMatch[1].trim();
      const value = varMatch[2].trim();
      if (name && value) {
        vars.push({ name, value });
      }
    }
  }

  return vars;
}

export function buildSrcDoc(headHtml: string, slideHtml: string, bridgeScript?: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
${headHtml}
<style>
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  width: 1280px; height: 720px;
  overflow: hidden;
}
/* Force slide visibility in editor */
.slide {
  position: absolute !important;
  inset: 0 !important;
  opacity: 1 !important;
  transform: none !important;
  pointer-events: all !important;
  display: flex !important;
}
</style>
</head>
<body>
${slideHtml}
${bridgeScript ? `<script>\n${bridgeScript}\n</script>` : ''}
</body>
</html>`;
}

export function buildThumbnailSrcDoc(headHtml: string, slideHtml: string): string {
  return buildSrcDoc(headHtml, slideHtml);
}

export function exportUpdatedHTML(
  rawHTML: string,
  slides: Slide[],
  cssVariables: CSSVariable[]
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHTML, 'text/html');

  // Detect and replace slide elements
  let slideEls = Array.from(doc.querySelectorAll('div.slide, section.slide'));
  if (slideEls.length === 0) slideEls = Array.from(doc.querySelectorAll('section'));
  if (slideEls.length === 0) slideEls = Array.from(doc.querySelectorAll('body > div'));

  slides.forEach((slide, i) => {
    if (!slideEls[i]) return;
    const tempDiv = doc.createElement('div');
    tempDiv.innerHTML = slide.html;
    const newEl = tempDiv.firstElementChild;
    if (newEl) {
      // Remove drag placeholders before export
      newEl.querySelectorAll('[data-sf-placeholder]').forEach(ph => ph.remove());
      slideEls[i].replaceWith(newEl);
    }
  });

  // Apply CSS variable updates
  const styleEls = doc.querySelectorAll('style');
  cssVariables.forEach(({ name, value }) => {
    const escapedName = name.replace(/[-]/g, '\\-');
    styleEls.forEach(styleEl => {
      if (!styleEl.textContent) return;
      styleEl.textContent = styleEl.textContent.replace(
        new RegExp(`${escapedName}\\s*:\\s*[^;]+`, 'g'),
        `${name}: ${value}`
      );
    });
  });

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}
