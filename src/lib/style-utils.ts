export function parseColor(value: string): string {
  if (!value) return '#000000';
  if (value.startsWith('#')) return value;
  if (value.startsWith('rgb')) {
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1]).toString(16).padStart(2, '0');
      const g = parseInt(match[2]).toString(16).padStart(2, '0');
      const b = parseInt(match[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
  }
  return '#000000';
}

export function parseFontSize(value: string): number {
  if (!value) return 16;
  const match = value.match(/^([\d.]+)/);
  return match ? parseFloat(match[1]) : 16;
}

export const FONT_FAMILIES = [
  'Inter',
  'Noto Sans JP',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Barlow',
  'Barlow Condensed',
];

export function getStyleProperty(styles: Record<string, string>, property: string, fallback: string = ''): string {
  return styles[property] || styles[toCamelCase(property)] || fallback;
}

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
