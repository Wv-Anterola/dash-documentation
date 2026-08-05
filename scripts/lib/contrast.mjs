/**
 * Colour parsing, WCAG relative luminance, and the reviewed contrast pairs.
 *
 * Shared by the accessibility gate, which enforces these, and by the report
 * generator, which publishes them. Two copies of this maths would eventually
 * disagree, and the disagreement would be invisible: the check would pass while
 * the published page reported a different number for the same colours.
 *
 * The formulae are WCAG 2.1: relative luminance per the sRGB definition, and a
 * contrast ratio of (lighter + 0.05) / (darker + 0.05).
 */

export function parseColor(value) {
  const text = String(value).trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1];
    return [0, 2, 4].map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16));
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
    if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) return parts;
  }
  const hsl = /^hsla?\(([^)]+)\)$/i.exec(text);
  if (hsl) {
    const [h, s, l] = hsl[1].split(/[\s,/]+/).filter(Boolean).map((part) => Number.parseFloat(part));
    return hslToRgb(h, s / 100, l / 100);
  }
  return null;
}

export function hslToRgb(h, s, l) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const hue = (((h % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((hue % 2) - 1));
  const [r, g, b] = hue < 1 ? [chroma, second, 0]
    : hue < 2 ? [second, chroma, 0]
    : hue < 3 ? [0, chroma, second]
    : hue < 4 ? [0, second, chroma]
    : hue < 5 ? [second, 0, chroma]
    : [chroma, 0, second]; // prettier-ignore
  const match = l - chroma / 2;
  return [r, g, b].map((channel) => Math.round((channel + match) * 255));
}

export const relativeLuminance = (rgb) => {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function contrast(a, b) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Reviewed foreground/background pairs, with the WCAG 2.1 AA threshold for the
 * role each one plays: 4.5 for body text, 3.0 for large text and for the
 * boundary of a user interface component (1.4.11), and 1.0 where the element is
 * decoration and no threshold applies.
 *
 * Naming the role rather than the token is the point. A grey line is a failure
 * at 1.95:1 if it separates a form control from the page and is fine at the
 * same ratio if it is a rule between paragraphs, and only a person can say
 * which one it is.
 */
export const reviewedPairs = [
  { name: 'body text on the page', fg: '--dash-ink', bg: '--dash-surface', min: 4.5, role: 'text' },
  { name: 'body text on a raised surface', fg: '--dash-ink', bg: '--dash-surface-raised', min: 4.5, role: 'text' },
  { name: 'body text on a panel', fg: '--dash-ink', bg: '--dash-panel', min: 4.5, role: 'text' },
  { name: 'secondary text on the page', fg: '--dash-ink-soft', bg: '--dash-surface', min: 4.5, role: 'text' },
  { name: 'secondary text on a raised surface', fg: '--dash-ink-soft', bg: '--dash-surface-raised', min: 4.5, role: 'text' },
  { name: 'link colour on the page', fg: '--dash-blue', bg: '--dash-surface', min: 4.5, role: 'text' },
  { name: 'accent text on the page', fg: '--dash-accent', bg: '--dash-surface', min: 4.5, role: 'text' },
  { name: 'body text on an accent tint', fg: '--dash-ink', bg: '--dash-accent-soft', min: 4.5, role: 'text' },
  { name: 'form control border on the page', fg: '--dash-control-border', bg: '--dash-surface', min: 3, role: 'component boundary' },
  { name: 'form control border on a raised surface', fg: '--dash-control-border', bg: '--dash-surface-raised', min: 3, role: 'component boundary' },
  { name: 'accent boundary against the page', fg: '--dash-accent', bg: '--dash-surface', min: 3, role: 'component boundary' },
  // A grouping rule is decoration, not a component boundary, so 1.4.11 does not
  // apply to it. It still has to be visible, which is what this floor is for.
  { name: 'decorative grouping rule', fg: '--dash-rule-strong', bg: '--dash-surface', min: 1.6, role: 'decoration' },
];
