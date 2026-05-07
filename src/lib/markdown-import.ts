/**
 * markdown-import.ts
 * Purpose: Convert structured Markdown text into SlideForge-compatible HTML.
 * Created: 2026-04-30
 * Dependencies: none (no external markdown libraries)
 *
 * Slide boundary rules:
 *   - A line starting with "# " (h1) always begins a new slide.
 *   - A line containing only "---" (horizontal rule) also begins a new slide.
 *
 * Element mapping:
 *   # Title       → large centered title (title slides)
 *   ## Subtitle   → subtitle text below the title
 *   ### Heading   → section heading on content slides
 *   - item / * item → bullet list items
 *   ![alt](url)   → <img> element
 *   plain text    → body paragraph
 *
 * Output: a complete <!DOCTYPE html> document with one
 *   <div class="slide" style="..."> per logical slide.
 */

const SLIDE_STYLE =
  'position:relative;width:1280px;height:720px;background:white;overflow:hidden;';

// Vertical layout constants (px)
const TITLE_TOP = 280;        // centered title baseline (title-only slides)
const CONTENT_TITLE_TOP = 72; // heading top on content slides
const CONTENT_START_TOP = 160; // first body element top on content slides
const LINE_HEIGHT_H3 = 48;     // ### heading own height
const LINE_HEIGHT_BODY = 32;   // paragraph / bullet line height
const LEFT_MARGIN = 100;       // left padding for content slides
const RIGHT_MARGIN = 100;      // right padding (width - left - right = 1080)

/** Escape characters that are special in HTML attribute values / text content. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline markdown: bold, italic, code, links — minimal, no nesting. */
function renderInline(text: string): string {
  return text
    // Bold **text** or __text__
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_m, a, b) => `<strong>${a ?? b}</strong>`)
    // Italic *text* or _text_
    .replace(/\*(.+?)\*|_(.+?)_/g, (_m, a, b) => `<em>${a ?? b}</em>`)
    // Inline code `code`
    .replace(/`(.+?)`/g, (_m, c) => `<code style="font-family:monospace;background:rgba(0,0,0,0.06);padding:2px 5px;border-radius:3px;">${escapeHtml(c)}</code>`)
    // Links [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => `<a href="${escapeHtml(u)}" style="color:#007AFF;">${t}</a>`);
}

interface RawBlock {
  type: 'h1' | 'h2' | 'h3' | 'bullet' | 'image' | 'text';
  content: string;
  alt?: string;  // for images
  src?: string;  // for images
}

/** Parse a single line into a RawBlock, or return null for blank/separator lines. */
function parseLine(line: string): RawBlock | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed === '---') return null;

  // Heading 1
  if (trimmed.startsWith('# ')) {
    return { type: 'h1', content: trimmed.slice(2).trim() };
  }
  // Heading 2
  if (trimmed.startsWith('## ')) {
    return { type: 'h2', content: trimmed.slice(3).trim() };
  }
  // Heading 3
  if (trimmed.startsWith('### ')) {
    return { type: 'h3', content: trimmed.slice(4).trim() };
  }
  // Bullet (- or *)
  if (/^[-*]\s+/.test(trimmed)) {
    return { type: 'bullet', content: trimmed.replace(/^[-*]\s+/, '') };
  }
  // Image ![alt](src)
  const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (imgMatch) {
    return { type: 'image', content: '', alt: imgMatch[1], src: imgMatch[2] };
  }
  // Regular text
  return { type: 'text', content: trimmed };
}

/** Split raw lines into groups of logical slides. */
function splitIntoSlideGroups(lines: string[]): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // New slide: h1 boundary or horizontal rule
    if (trimmed.startsWith('# ') || trimmed === '---') {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    }
    current.push(line);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * Render a group of lines as a single slide <div>.
 *
 * Layout strategy:
 *   - If the group has ONLY an h1 (and optionally h2), centre them vertically
 *     ("title slide" layout).
 *   - Otherwise use left-aligned "content slide" layout: h1/h2/h3 at top,
 *     body elements below with accumulated top offset.
 */
function renderSlide(lines: string[]): string {
  const blocks: RawBlock[] = lines
    .map(parseLine)
    .filter((b): b is RawBlock => b !== null);

  if (blocks.length === 0) {
    return `<div class="slide" style="${SLIDE_STYLE}"></div>`;
  }

  // Determine layout mode
  const hasH1 = blocks.some(b => b.type === 'h1');
  const hasBodyContent = blocks.some(
    b => b.type === 'bullet' || b.type === 'text' || b.type === 'h3' || b.type === 'image'
  );
  const isTitleSlide = hasH1 && !hasBodyContent;

  const elements: string[] = [];

  if (isTitleSlide) {
    // ---- Title-slide layout ----
    let topOffset = TITLE_TOP;

    for (const block of blocks) {
      if (block.type === 'h1') {
        const escaped = renderInline(escapeHtml(block.content));
        elements.push(
          `<div style="position:absolute;left:0;right:0;top:${topOffset}px;` +
          `text-align:center;font-size:48px;font-weight:700;color:#1d1d1f;` +
          `padding:0 80px;line-height:1.2;">${escaped}</div>`
        );
        topOffset += 72;
      } else if (block.type === 'h2') {
        const escaped = renderInline(escapeHtml(block.content));
        elements.push(
          `<div style="position:absolute;left:0;right:0;top:${topOffset}px;` +
          `text-align:center;font-size:24px;font-weight:400;color:#86868b;` +
          `padding:0 80px;line-height:1.4;">${escaped}</div>`
        );
        topOffset += 40;
      }
    }
  } else {
    // ---- Content-slide layout ----
    let topOffset = CONTENT_START_TOP;
    let titlePlaced = false;

    for (const block of blocks) {
      switch (block.type) {
        case 'h1': {
          const escaped = renderInline(escapeHtml(block.content));
          elements.push(
            `<div style="position:absolute;left:${LEFT_MARGIN}px;right:${RIGHT_MARGIN}px;` +
            `top:${CONTENT_TITLE_TOP}px;font-size:40px;font-weight:700;color:#1d1d1f;` +
            `line-height:1.2;">${escaped}</div>`
          );
          titlePlaced = true;
          break;
        }
        case 'h2': {
          const escaped = renderInline(escapeHtml(block.content));
          // h2 on a content slide acts as a sub-title beneath the h1
          const h2Top = titlePlaced ? CONTENT_TITLE_TOP + 52 : CONTENT_TITLE_TOP;
          elements.push(
            `<div style="position:absolute;left:${LEFT_MARGIN}px;right:${RIGHT_MARGIN}px;` +
            `top:${h2Top}px;font-size:22px;font-weight:400;color:#86868b;` +
            `line-height:1.4;">${escaped}</div>`
          );
          if (!titlePlaced) titlePlaced = true;
          break;
        }
        case 'h3': {
          const escaped = renderInline(escapeHtml(block.content));
          elements.push(
            `<div style="position:absolute;left:${LEFT_MARGIN}px;right:${RIGHT_MARGIN}px;` +
            `top:${topOffset}px;font-size:32px;font-weight:700;color:#1d1d1f;` +
            `line-height:1.2;">${escaped}</div>`
          );
          topOffset += LINE_HEIGHT_H3 + 16;
          break;
        }
        case 'bullet': {
          const escaped = renderInline(escapeHtml(block.content));
          elements.push(
            `<div style="position:absolute;left:${LEFT_MARGIN}px;right:${RIGHT_MARGIN}px;` +
            `top:${topOffset}px;font-size:20px;color:#1d1d1f;line-height:1.5;">` +
            `<span style="margin-right:10px;">•</span>${escaped}</div>`
          );
          topOffset += LINE_HEIGHT_BODY;
          break;
        }
        case 'text': {
          const escaped = renderInline(escapeHtml(block.content));
          elements.push(
            `<div style="position:absolute;left:${LEFT_MARGIN}px;right:${RIGHT_MARGIN}px;` +
            `top:${topOffset}px;font-size:18px;color:#3a3a3c;line-height:1.6;">${escaped}</div>`
          );
          topOffset += LINE_HEIGHT_BODY + 4;
          break;
        }
        case 'image': {
          const src = escapeHtml(block.src ?? '');
          const alt = escapeHtml(block.alt ?? '');
          const remaining = 720 - topOffset - 40;
          const imgHeight = Math.max(80, Math.min(remaining, 280));
          elements.push(
            `<img src="${src}" alt="${alt}" style="position:absolute;` +
            `left:${LEFT_MARGIN}px;top:${topOffset}px;` +
            `max-width:${1280 - LEFT_MARGIN - RIGHT_MARGIN}px;max-height:${imgHeight}px;` +
            `object-fit:contain;" />`
          );
          topOffset += imgHeight + 16;
          break;
        }
      }
    }
  }

  return (
    `<div class="slide" style="${SLIDE_STYLE}">` +
    elements.join('\n') +
    `</div>`
  );
}

/**
 * Convert a Markdown string into a full SlideForge-compatible HTML document.
 *
 * @param md - Raw markdown text
 * @returns Complete <!DOCTYPE html> document string ready for loadHTML()
 */
export function markdownToSlideHTML(md: string): string {
  const lines = md.split(/\r?\n/);
  const slideGroups = splitIntoSlideGroups(lines);

  // Ensure at least one slide even for empty input
  const groups = slideGroups.length > 0 ? slideGroups : [[]];

  const slideHtml = groups.map(renderSlide).join('\n');

  return (
    `<!DOCTYPE html>` +
    `<html>` +
    `<head>` +
    `<meta charset="utf-8">` +
    `<title>MD Import</title>` +
    `<style>` +
    `body{margin:0}` +
    `.slide{font-family:-apple-system,"SF Pro Display","Helvetica Neue",sans-serif}` +
    `</style>` +
    `</head>` +
    `<body>` +
    `\n${slideHtml}\n` +
    `</body>` +
    `</html>`
  );
}
