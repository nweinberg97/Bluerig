// Colour helpers so any shop's real brand colours produce a readable site.

const toRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

/** Blend a toward b by t (0..1). */
export function mix(a: string, b: string, t: number): string {
  const x = toRgb(a), y = toRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Text colour that reads on a background. */
export function onColour(bg: string): string {
  return contrast(bg, '#FFFFFF') >= contrast(bg, '#14110A') ? '#FFFFFF' : '#14110A';
}

/** Darken a brand colour until white text passes 4.5:1 (for buttons and links). */
export function readable(hex: string, on = '#FFFFFF'): string {
  let c = hex;
  for (let i = 0; i < 12 && contrast(c, on) < 4.5; i++) c = mix(c, '#000000', 0.12);
  return c;
}

/** CSS variables for a site from its brand kit. */
export function siteVars(b: { primary: string; accent: string; ink: string }): Record<string, string> {
  const g = readable(b.primary);
  return {
    '--g': g,
    '--gs': mix(b.primary, '#FFFFFF', 0.86),
    '--amber': b.accent,
    '--amber-ink': onColour(b.accent),
    '--ink': contrast(b.ink, '#F3F5F1') >= 7 ? b.ink : mix(b.ink, '#000000', 0.6),
    '--paper': mix(b.primary, '#F5F6F3', 0.94),
    '--line': mix(b.primary, '#DDE2DE', 0.85),
  };
}
