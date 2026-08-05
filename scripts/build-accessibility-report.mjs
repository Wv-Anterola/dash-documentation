/**
 * Publish this site's own accessibility measurements, including what is not
 * measured.
 *
 * `npm run accessibility` already computes contrast for every reviewed colour
 * pair in both themes and audits every built page for structural facts. It then
 * prints one line and exits. That is enough to stop a regression and not enough
 * for a reader who wants to know whether this site is usable for them before
 * committing to reading it.
 *
 * So the same numbers are published. The contrast half is derived from
 * src/styles/dash.css, which exists before the build, so it can be generated
 * here and rendered on a page. The per-page half runs against `dist` and stays
 * in the check, because it cannot see itself.
 *
 * The `notTested` list is the important part. Automated structural checks
 * establish that a page has a heading, a landmark, and a named button; they say
 * nothing about whether the reading order makes sense, whether the archived
 * recordings are followable without sound, or whether a screen reader user can
 * actually complete a task. Publishing a pass rate without that list would
 * claim more than the evidence supports.
 *
 * Drift rule: generation fails when a reviewed pair names a token the
 * stylesheet no longer defines, when a theme block disappears, or when a pair
 * cannot be resolved to real colours. Each means the published numbers would
 * describe colours nobody is using.
 *
 * Output: src/data/generated/accessibility.json, rendered at
 * /reference/accessibility/.
 *
 *   npm run audit:accessibility
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrast, parseColor, reviewedPairs } from './lib/contrast.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssPath = path.join(root, 'src', 'styles', 'dash.css');
const outputPath = path.join(root, 'src', 'data', 'generated', 'accessibility.json');

const css = await readFile(cssPath, 'utf8');

/** Custom properties declared inside one selector block. */
function declarationsIn(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`The stylesheet no longer declares a \`${selector}\` block, so theme values cannot be read.`);
  const block = css.slice(start, css.indexOf('\n}', start));
  return new Map([...block.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map((match) => [match[1], match[2].trim()]));
}

/** Follow `var(--x)` chains within one theme. */
function resolveToken(tokens, value, depth = 0) {
  if (depth > 8) return value;
  const reference = /^var\((--[a-z0-9-]+)\)$/.exec(String(value).trim());
  if (!reference) return value;
  const next = tokens.get(reference[1]);
  return next === undefined ? value : resolveToken(tokens, next, depth + 1);
}

const darkTokens = declarationsIn(':root');
const lightTokens = new Map([...darkTokens, ...declarationsIn(":root[data-theme='light']")]);
const themes = [
  ['dark', darkTokens],
  ['light', lightTokens],
];

const measurements = [];
for (const pair of reviewedPairs) {
  const perTheme = {};
  for (const [theme, tokens] of themes) {
    const foreground = parseColor(resolveToken(tokens, tokens.get(pair.fg) ?? ''));
    const background = parseColor(resolveToken(tokens, tokens.get(pair.bg) ?? ''));
    if (!foreground || !background) {
      throw new Error(
        `Cannot resolve ${pair.fg} on ${pair.bg} to real colours in the ${theme} theme. ` +
          'A reviewed pair names a token the stylesheet no longer defines, so the published ratios would be fiction.'
      );
    }
    const ratio = Math.round(contrast(foreground, background) * 100) / 100;
    perTheme[theme] = { ratio, passes: ratio >= pair.min };
  }
  measurements.push({
    name: pair.name,
    role: pair.role,
    foreground: pair.fg,
    background: pair.bg,
    required: pair.min,
    // The threshold only applies where the role says it does; saying which
    // criterion is being met is more useful than a bare tick.
    criterion: pair.role === 'text' ? 'WCAG 2.1 AA 1.4.3 (contrast, minimum)'
      : pair.role === 'component boundary' ? 'WCAG 2.1 AA 1.4.11 (non-text contrast)'
      : 'No WCAG threshold applies; this floor is a house rule so the line stays visible', // prettier-ignore
    themes: perTheme,
  });
}

const usedTokens = new Set([...css.matchAll(/var\((--dash-[a-z0-9-]+)/g)].map((match) => match[1]));
const undefinedTokens = [...usedTokens].filter((token) => !darkTokens.has(token)).sort();
if (undefinedTokens.length) {
  throw new Error(`The stylesheet uses tokens it never defines: ${undefinedTokens.join(', ')}`);
}

/**
 * What these measurements do not establish. Written by a person, because
 * nothing else can produce it, and kept beside the numbers so a pass rate is
 * never read as a clean bill of health.
 */
const notTested = [
  {
    area: 'Screen reader experience',
    checked: 'Every page has a language, one h1, a main landmark, labelled form controls, named buttons, discernible link text, and scoped table headers.',
    notChecked: 'Whether a page actually reads well. Correct structure is necessary and not sufficient: a heading can be present and unhelpful, and an alt text can exist and describe the wrong thing.',
  },
  {
    area: 'Keyboard navigation',
    checked: 'Interactive controls are real buttons, links, inputs, and details elements, which are focusable and operable by keyboard by default.',
    notChecked: 'Focus order and focus visibility have not been walked page by page. Nothing here traps focus deliberately, but that is a claim about intent, not a measurement.',
  },
  {
    area: 'Archived recordings',
    checked: 'Every image and recording carries alt text, and heavy recordings are deferred so they never block a page from appearing.',
    notChecked: 'The recordings have no captions or transcripts. They are silent screen captures of Dash, and the surrounding prose is written to stand on its own, but a reader who cannot see them is relying on that prose rather than on an equivalent.',
  },
  {
    area: 'Zoom and reflow',
    checked: 'Browser tests assert that no reference page scrolls sideways at a 390 pixel viewport, which is the failure that wide generated tables cause.',
    notChecked: 'WCAG 1.4.10 reflow at 400 percent zoom, and 1.4.12 text spacing overrides, have not been measured.',
  },
  {
    area: 'Colour vision',
    checked: 'Contrast ratios for every reviewed pair, in both themes, computed from the stylesheet rather than asserted.',
    notChecked: 'Whether any status is carried by hue alone has been reviewed by eye rather than by tooling. Where colour appears in generated tables it is paired with text.',
  },
  {
    area: 'Third-party interface',
    checked: 'The site is Starlight, whose own components are audited upstream, and the search index is Pagefind.',
    notChecked: 'Neither is re-audited here. A defect in the theme or in the search widget would not be caught by these checks.',
  },
];

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  // Every other published dataset carries a `repository` naming the Dash-Web
  // commit its records describe. This one has none, and saying so in the data
  // is better than an exemption written into a test: the absence is a fact
  // about the dataset, not an oversight to be waived.
  describes: 'this documentation site',
  methodology: {
    derivedFrom:
      'src/styles/dash.css. Every reviewed pair is resolved through its var() chain per theme and its contrast ratio computed with the WCAG 2.1 sRGB relative-luminance formula.',
    enforcement:
      '`npm run accessibility` recomputes these on every push and fails the build below the stated threshold, then audits every built page for structural facts. This report is the same measurement, published.',
    driftRule:
      'Generation fails when a reviewed pair names a token the stylesheet no longer defines, when a theme block disappears, or when the stylesheet uses a token it never defines.',
    standard: 'WCAG 2.1 level AA',
  },
  summary: {
    pairs: measurements.length,
    measurements: measurements.length * themes.length,
    passing: measurements.reduce((total, entry) => total + Object.values(entry.themes).filter((theme) => theme.passes).length, 0),
    themes: themes.map(([name]) => name),
    tokensUsed: usedTokens.size,
    tokensDefined: [...darkTokens.keys()].filter((token) => token.startsWith('--dash-')).length,
    areasNotTested: notTested.length,
  },
  measurements,
  notTested,
};

const failing = measurements.filter((entry) => Object.values(entry.themes).some((theme) => !theme.passes));
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Measured ${measurements.length} reviewed colour pairs across ${themes.length} themes ` +
    `(${output.summary.passing} of ${output.summary.measurements} meet their threshold), ` +
    `over ${usedTokens.size} tokens used and ${output.summary.tokensDefined} defined. ` +
    `${notTested.length} areas are documented as not tested.` +
    (failing.length ? ` ${failing.length} pairs are below threshold and will fail \`npm run accessibility\`.` : '')
);
