/**
 * Accessibility gate: design tokens first, then the built pages.
 *
 * This site has already shipped one contrast disaster. Overriding Starlight's
 * greys in a bare `:root` made every light-mode heading white on white, and
 * nothing caught it, because a stylesheet is the one artefact here with no
 * tests and no parser watching it. Two checks close that gap.
 *
 * 1. **Tokens.** Every `--dash-*` custom property used anywhere in the
 *    stylesheet must be defined for both themes, and every reviewed
 *    foreground/background pair must meet WCAG 2.1 AA. A missing token is not
 *    a cosmetic problem: `color: var(--undefined)` falls back to `inherit` and
 *    `background: var(--undefined)` falls back to transparent, so a typo turns
 *    a card into invisible text on the page background.
 *
 * 2. **Pages.** Structural accessibility facts that are true or false in the
 *    HTML: a language, exactly one h1, a main landmark, labelled controls,
 *    named buttons, discernible link text, and scoped table headers.
 *
 * Contrast is computed, not asserted from memory, so changing a token changes
 * the verdict. Run after `npm run build`.
 *
 *   node scripts/check-accessibility.mjs [dist-dir]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { contrast, parseColor, reviewedPairs } from './lib/contrast.mjs';

const DIST = resolve(process.argv[2] ?? 'dist');
const CSS = resolve('src/styles/dash.css');

const problems = [];
const complain = (message) => problems.push(message);

/* ------------------------------------------------------------------ *
 * Token resolution
 * ------------------------------------------------------------------ */

const css = readFileSync(CSS, 'utf8');

/** Custom properties declared inside one selector block. */
function declarationsIn(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) {
    complain(`the stylesheet no longer declares a \`${selector}\` block`);
    return new Map();
  }
  const end = css.indexOf('\n}', start);
  const block = css.slice(start, end);
  return new Map([...block.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map((match) => [match[1], match[2].trim()]));
}

const darkTokens = declarationsIn(':root');
const lightBase = declarationsIn(":root[data-theme='light']");
const lightTokens = new Map([...darkTokens, ...lightBase]);

/** Follow `var(--x)` chains within one theme. */
function resolve1(tokens, value, depth = 0) {
  if (depth > 8) return value;
  const reference = /^var\((--[a-z0-9-]+)\)$/.exec(value.trim());
  if (!reference) return value;
  const next = tokens.get(reference[1]);
  return next === undefined ? value : resolve1(tokens, next, depth + 1);
}

const used = new Set([...css.matchAll(/var\((--dash-[a-z0-9-]+)/g)].map((match) => match[1]));
for (const token of [...used].sort()) {
  if (!darkTokens.has(token)) complain(`${token} is used but never defined; a rule using it silently falls back to its initial value`);
}
// Themed values must exist in both themes. A colour defined only for dark is a
// light-mode bug waiting to happen, which is exactly the failure this file
// exists to prevent.
const colourTokens = [...darkTokens.keys()].filter((token) => token.startsWith('--dash-') && parseColor(resolve1(darkTokens, darkTokens.get(token))));
for (const token of colourTokens) {
  const dark = parseColor(resolve1(darkTokens, darkTokens.get(token)));
  const light = parseColor(resolve1(lightTokens, lightTokens.get(token) ?? ''));
  if (!light) complain(`${token} has no light-theme value`);
  else if (dark && contrast(dark, light) < 1.2) {
    complain(`${token} is effectively the same colour in both themes, which usually means the light override was forgotten`);
  }
}

const pairs = reviewedPairs;

const measured = [];
for (const [theme, tokens] of [['dark', darkTokens], ['light', lightTokens]]) {
  for (const pair of pairs) {
    const fg = parseColor(resolve1(tokens, tokens.get(pair.fg) ?? ''));
    const bg = parseColor(resolve1(tokens, tokens.get(pair.bg) ?? ''));
    if (!fg || !bg) {
      complain(`${theme}: cannot resolve ${pair.fg} on ${pair.bg} to real colours`);
      continue;
    }
    const ratio = contrast(fg, bg);
    measured.push({ theme, name: pair.name, ratio });
    if (ratio < pair.min) {
      complain(`${theme}: ${pair.name} is ${ratio.toFixed(2)}:1, below the ${pair.min}:1 it needs (${pair.fg} on ${pair.bg})`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * The built pages
 * ------------------------------------------------------------------ */

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push('/' + relative(DIST, full).split(sep).join('/'));
  }
  return out;
}

const pages = walk(DIST).filter((file) => file.endsWith('.html'));
let audited = 0;
const pageProblems = [];
const note = (page, message) => pageProblems.push(`${page}: ${message}`);

for (const page of pages) {
  const html = readFileSync(join(DIST, page.slice(1)), 'utf8');
  // Redirect stubs are three lines of meta refresh and have no content to audit.
  if (!/sl-markdown-content|<article/.test(html)) continue;
  audited += 1;

  if (!/<html[^>]*\slang="[a-z]{2}/i.test(html)) note(page, 'the document has no lang attribute');
  const h1s = [...html.matchAll(/<h1\b/g)].length;
  if (h1s !== 1) note(page, `has ${h1s} h1 elements; a page needs exactly one`);
  if (!/<main\b/.test(html)) note(page, 'has no main landmark');

  // A control can also be named by being wrapped in a <label>, which is how
  // Starlight labels its own theme and language pickers, so the enclosing
  // label's text counts as much as an explicit `for` or `aria-label`.
  const wrappingLabels = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)];
  const insideNamedLabel = (index) =>
    wrappingLabels.some((label) => index > label.index && index < label.index + label[0].length && label[1].replace(/<[^>]*>/g, '').trim().length > 0);

  for (const kind of ['input', 'select', 'textarea']) {
    for (const match of html.matchAll(new RegExp(`<${kind}\\b([^>]*)>`, 'g'))) {
      const tag = match[1];
      if (kind === 'input' && /\stype="(hidden|submit|button|image)"/.test(tag)) continue;
      const id = /\sid="([^"]+)"/.exec(tag)?.[1];
      const labelled =
        /\saria-label(?:ledby)?="/.test(tag) || /\stitle="[^"]+"/.test(tag) || (id && html.includes(`for="${id}"`)) || insideNamedLabel(match.index);
      if (!labelled) note(page, `a ${kind} has no label (${tag.trim().slice(0, 70)})`);
    }
  }
  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const [, tag, inner] = match;
    // `title` is the last-resort accessible name in the accname algorithm, and
    // is what the code-block copy button relies on.
    const named =
      /\saria-label(?:ledby)?="/.test(tag) ||
      /\stitle="[^"]+"/.test(tag) ||
      inner.replace(/<[^>]*>/g, '').trim().length > 0 ||
      /<(img|svg)\b[^>]*\salt="[^"]+"/.test(inner);
    if (!named) note(page, 'a button has no accessible name');
  }
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]{0,400}?)<\/a>/g)) {
    const [, tag, inner] = match;
    if (!/\shref=/.test(tag)) continue;
    const text = inner.replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').trim();
    const named = text.length > 0 || /\saria-label(?:ledby)?="/.test(tag) || /<img\b[^>]*\salt="[^"]+"/.test(inner);
    if (!named) note(page, 'a link has no discernible text');
  }
  for (const table of html.matchAll(/<table\b[\s\S]*?<\/table>/g)) {
    const headers = [...table[0].matchAll(/<th\b([^>]*)>/g)];
    for (const header of headers) {
      if (!/\sscope="(col|row|colgroup|rowgroup)"/.test(header[1])) {
        note(page, 'a table header cell has no scope');
        break;
      }
    }
  }
}

// Report each distinct kind once per page so a systemic issue does not bury
// everything else under a thousand identical lines.
const deduped = [...new Set(pageProblems)];
for (const problem of deduped.slice(0, 40)) complain(problem);
if (deduped.length > 40) complain(`... and ${deduped.length - 40} more page-level findings`);

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

const worst = measured.slice().sort((a, b) => a.ratio - b.ratio)[0];
console.log(`Checked ${used.size} design tokens and ${audited} content pages in ${DIST}`);
if (problems.length) {
  console.log(`\n### Accessibility problems: ${problems.length}`);
  for (const problem of problems) console.log('   ', problem);
  process.exit(1);
}
console.log(
  `Every --dash-* token used is defined in both themes; all ${measured.length} reviewed colour pairs meet WCAG AA ` +
    `(tightest: ${worst.name} in ${worst.theme} at ${worst.ratio.toFixed(2)}:1); ` +
    `every audited page has a language, one h1, a main landmark, labelled controls, named buttons, ` +
    'discernible link text, and scoped table headers.'
);
