/**
 * Builds the source-traced keyboard shortcut reference.
 *
 * Dash routes keystrokes in two places that never see each other:
 *
 * - `GlobalKeyHandler.ts` owns a router keyed by a four-bit modifier string,
 *   `shift + ctrl + alt + meta`. Each bit pattern maps to one handler whose body
 *   is a `switch` over the lowercased key name. The router is built differently
 *   on macOS, and the difference is not a cosmetic Cmd-for-Ctrl swap: it changes
 *   which physical key reaches which handler, and leaves one modifier unrouted.
 * - `MarqueeView.tsx` owns the freeform-canvas keys and the marquee-selection
 *   commands, as an if/else chain and a gated `switch`.
 *
 * This generator parses both with the TypeScript compiler, recovers every key a
 * handler can act on, records the guards inside each case, and states whether
 * the keystroke is swallowed (`preventDefault` / `stopPropagation`) so a reader
 * can tell "Dash does nothing" apart from "Dash blocks the browser default".
 */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import sourceReference from '../src/data/generated/source-reference.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.env.DASH_SOURCE_ROOT ?? path.join(root, '..', 'Dash-Web'));
const baseline = sourceReference.repository.baselineTip;
const remote = sourceReference.repository.remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');

const keyHandlerPath = 'src/client/views/GlobalKeyHandler.ts';
const marqueePath = 'src/client/views/collections/collectionFreeForm/MarqueeView.tsx';

function git(...args) {
  return execFileSync('git', ['-c', `safe.directory=${sourceRoot.replaceAll('\\', '/')}`, '-C', sourceRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
}

const sourceCache = new Map();
function sourceAt(file) {
  if (!sourceCache.has(file)) sourceCache.set(file, git('show', `${baseline}:${file}`));
  return sourceCache.get(file);
}

function parse(file) {
  const text = sourceAt(file);
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function sourceUrl(file, line) {
  return `${remote}/blob/${baseline}/${file}#L${line}`;
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function compact(node, sourceFile, limit = 320) {
  if (!node) return '';
  const value = node.getText(sourceFile).replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

const callIgnored = new Set([
  'if', 'for', 'return', 'map', 'filter', 'forEach', 'push', 'includes', 'indexOf', 'split', 'join', 'trim',
  'toString', 'toLowerCase', 'startsWith', 'endsWith', 'then', 'catch', 'action', 'runInAction', 'Number', 'String',
  'Cast', 'StrCast', 'NumCast', 'DocListCast', 'DocCast', 'ScriptCast', 'bit', 'find', 'some', 'slice', 'substr',
]);

function callsIn(node, sourceFile) {
  const names = [];
  const visit = (child) => {
    if (ts.isCallExpression(child)) {
      const text = compact(child.expression, sourceFile, 90);
      const tail = text.split('.').pop() ?? text;
      if (!callIgnored.has(tail) && !/^\(/.test(text)) names.push(text);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return [...new Set(names)].slice(0, 8);
}

/* ------------------------------------------------------------------ *
 * GlobalKeyHandler: the modifier router
 * ------------------------------------------------------------------ */

const keyHandlerFile = parse(keyHandlerPath);

// modifierIndex is built as shift + ctrl + alt + meta, one bit each.
const BIT_ORDER = ['Shift', 'Ctrl', 'Alt', 'Cmd'];

function decodeBits(bits) {
  return BIT_ORDER.filter((_, index) => bits[index] === '1');
}

const routes = [];
const collectRoutes = (node) => {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'set' &&
    compact(node.expression.expression, keyHandlerFile).endsWith('router') &&
    node.arguments.length === 2
  ) {
    const [pattern, handler] = node.arguments;
    const handlerName = ts.isPropertyAccessExpression(handler) ? handler.name.text : compact(handler, keyHandlerFile, 40);
    const line = lineOf(keyHandlerFile, node);
    if (ts.isStringLiteralLike(pattern)) {
      routes.push({ handlerName, mac: pattern.text, other: pattern.text, line });
    } else if (ts.isConditionalExpression(pattern)) {
      const condition = compact(pattern.condition, keyHandlerFile, 40);
      const whenTrue = ts.isStringLiteralLike(pattern.whenTrue) ? pattern.whenTrue.text : '';
      const whenFalse = ts.isStringLiteralLike(pattern.whenFalse) ? pattern.whenFalse.text : '';
      if (!/isMac/i.test(condition)) throw new Error(`Unexpected router condition ${condition}; the platform routing model changed.`);
      routes.push({ handlerName, mac: whenTrue, other: whenFalse, line });
    }
  }
  ts.forEachChild(node, collectRoutes);
};
collectRoutes(keyHandlerFile);

if (!routes.length) throw new Error('Found no KeyManager router registrations; GlobalKeyHandler restructured.');

// Every modifier combination that is never registered is silently ignored.
const allBitPatterns = [];
for (let value = 0; value < 16; value += 1) allBitPatterns.push(value.toString(2).padStart(4, '0'));
const macRouted = new Set(routes.map((route) => route.mac));
const otherRouted = new Set(routes.map((route) => route.other));
const unroutedMac = allBitPatterns.filter((bits) => !macRouted.has(bits) && bits !== '0000');
const unroutedOther = allBitPatterns.filter((bits) => !otherRouted.has(bits) && bits !== '0000');

/** Locates the arrow function assigned to a `private name = action((…) => {…})` field. */
function handlerBody(name) {
  let found;
  const visit = (node) => {
    if (!found && ts.isPropertyDeclaration(node) && node.name.getText(keyHandlerFile) === name && node.initializer) {
      let target = node.initializer;
      if (ts.isCallExpression(target) && target.arguments.length) target = target.arguments[0];
      if (ts.isArrowFunction(target) || ts.isFunctionExpression(target)) found = target;
    }
    if (!found) ts.forEachChild(node, visit);
  };
  visit(keyHandlerFile);
  if (!found) throw new Error(`Could not find KeyManager handler ${name}`);
  return found;
}

function switchIn(node) {
  let found;
  const visit = (child) => {
    if (!found && ts.isSwitchStatement(child)) found = child;
    if (!found) ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

/**
 * Reports whether a case's own statements re-assign the handler's
 * stopPropagation/preventDefault locals, or return an explicit control object.
 */
function eventControlIn(statements, sourceFile, handlerDefault) {
  const text = statements.map((statement) => compact(statement, sourceFile, 600)).join(' ');
  const control = { ...handlerDefault };
  const explicitReturn = /return\s*\{\s*stopPropagation:\s*(true|false)\s*,\s*preventDefault:\s*(true|false)/.exec(text);
  if (explicitReturn) {
    control.stopPropagation = explicitReturn[1] === 'true';
    control.preventDefault = explicitReturn[2] === 'true';
    control.conditional = /if\s*\(/.test(text);
    return control;
  }
  const stop = /\bstopPropagation\s*=\s*(true|false)/.exec(text);
  const prevent = /\bpreventDefault\s*=\s*(true|false)/.exec(text);
  if (stop) control.stopPropagation = stop[1] === 'true';
  if (prevent) control.preventDefault = prevent[1] === 'true';
  control.conditional = Boolean((stop || prevent) && /if\s*\(/.test(text));
  return control;
}

/** The stopPropagation/preventDefault a handler returns when no case changes them. */
function handlerDefaults(handler) {
  const text = compact(handler.body, keyHandlerFile, 4000);
  if (/let stopPropagation = true/.test(text) && /let preventDefault = true/.test(text)) return { stopPropagation: true, preventDefault: true };
  if (/const stopPropagation = true/.test(text) && /const preventDefault = true/.test(text)) return { stopPropagation: true, preventDefault: true };
  return { stopPropagation: false, preventDefault: false };
}

const KEY_LABELS = {
  ' ': 'Space',
  escape: 'Esc',
  enter: 'Enter',
  delete: 'Delete',
  backspace: 'Backspace',
  arrowleft: 'Left arrow',
  arrowright: 'Right arrow',
  arrowup: 'Up arrow',
  arrowdown: 'Down arrow',
};

function keyLabel(key) {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  // Only uppercase ASCII letters; `ƒ` is a literal character the layout produces.
  if (key.length === 1 && /[a-z]/.test(key)) return key.toUpperCase();
  return key;
}

/**
 * A single capital letter in a `switch (e.key)` is a Shift chord: `e.key` is
 * case-sensitive there, unlike the lowercased name GlobalKeyHandler switches on.
 */
function caseSensitiveChord(key) {
  return key.length === 1 && /[A-Z]/.test(key) ? `Shift + ${key}` : keyLabel(key);
}

function chordFor(bits, key) {
  const parts = decodeBits(bits);
  return [...parts, keyLabel(key)].join(' + ');
}

function slug(value) {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'key'
  );
}

const shortcuts = [];
const usedIds = new Map();
function addShortcut(row) {
  const base = slug(`${row.scope}-${row.chordOther || row.chordMac}`);
  const seen = usedIds.get(base) ?? 0;
  usedIds.set(base, seen + 1);
  shortcuts.push({ id: seen ? `${base}-${seen + 1}` : base, ...row });
}

for (const route of routes) {
  const handler = handlerBody(route.handlerName);
  const defaults = handlerDefaults(handler);
  const block = switchIn(handler);
  if (!block) throw new Error(`KeyManager handler ${route.handlerName} no longer switches on the key name`);

  // Consecutive empty cases share the following case's statements.
  let pendingKeys = [];
  for (const clause of block.caseBlock.clauses) {
    if (ts.isDefaultClause(clause)) continue;
    const literal = clause.expression;
    if (!ts.isStringLiteralLike(literal)) continue;
    pendingKeys.push(literal.text);
    if (!clause.statements.length) continue;

    const statements = [...clause.statements];
    const effect = statements.map((statement) => compact(statement, keyHandlerFile, 260)).join(' ');
    const control = eventControlIn(statements, keyHandlerFile, defaults);
    const guards = statements
      .filter((statement) => ts.isIfStatement(statement))
      .map((statement) => compact(statement.expression, keyHandlerFile, 200));
    const line = lineOf(keyHandlerFile, clause);

    for (const key of pendingKeys) {
      addShortcut({
        scope: 'global',
        handler: route.handlerName,
        modifierBitsMac: route.mac,
        modifierBitsOther: route.other,
        chordMac: chordFor(route.mac, key),
        chordOther: chordFor(route.other, key),
        key,
        keyLabel: keyLabel(key),
        effect,
        calls: callsIn(clause, keyHandlerFile),
        guards,
        eventControl: control,
        source: { file: keyHandlerPath, line, url: sourceUrl(keyHandlerPath, line) },
      });
    }
    pendingKeys = [];
  }
}

/* ------------------------------------------------------------------ *
 * MarqueeView: canvas keys and marquee-selection commands
 * ------------------------------------------------------------------ */

const marqueeFile = parse(marqueePath);

function findMethod(sourceFile, name) {
  let found;
  const visit = (node) => {
    if (!found && ts.isPropertyDeclaration(node) && node.name.getText(sourceFile) === name && node.initializer) {
      let target = node.initializer;
      if (ts.isCallExpression(target) && target.arguments.length) target = target.arguments[0];
      if (ts.isArrowFunction(target) || ts.isFunctionExpression(target)) found = target;
    }
    if (!found && ts.isMethodDeclaration(node) && node.name.getText(sourceFile) === name) found = node;
    if (!found) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!found) throw new Error(`Could not find ${name} in ${sourceFile.fileName}`);
  return found;
}

/** Pulls `e.key === 'x'` comparisons and the modifier flags in the same condition. */
function keyConditionsIn(expression, sourceFile) {
  const text = compact(expression, sourceFile, 400);
  const keys = [...text.matchAll(/\.key\s*===\s*'([^']+)'/g)].map((match) => match[1]);
  const modifiers = [];
  if (/\bctrlKey\b/.test(text) && !/!\s*e\.ctrlKey/.test(text)) modifiers.push('Ctrl');
  if (/\bmetaKey\b/.test(text) && !/!\s*e\.metaKey/.test(text)) modifiers.push('Cmd');
  if (/\bshiftKey\b/.test(text) && !/!\s*e\.shiftKey/.test(text)) modifiers.push('Shift');
  if (/\baltKey\b/.test(text) && !/!\s*e\.altKey/.test(text)) modifiers.push('Alt');
  return { keys, modifiers, text };
}

const canvasKeyHandler = findMethod(marqueeFile, 'onKeyDown');
let branch = canvasKeyHandler.body?.statements.find((statement) => ts.isIfStatement(statement));
if (!branch) throw new Error('MarqueeView.onKeyDown no longer branches on the pressed key');

while (branch) {
  const { keys, modifiers, text } = keyConditionsIn(branch.expression, marqueeFile);
  const line = lineOf(marqueeFile, branch);
  const effect = compact(branch.thenStatement, marqueeFile, 300);
  const control = {
    stopPropagation: /stopPropagation\(\)/.test(compact(branch.thenStatement, marqueeFile, 4000)),
    preventDefault: /preventDefault\(\)/.test(compact(branch.thenStatement, marqueeFile, 4000)),
    conditional: false,
  };
  // Where the branch tests ctrlKey *and* metaKey, either modifier works and macOS
  // readers should see Cmd. Where it tests ctrlKey alone, macOS really does mean Control.
  const eitherModifier = modifiers.includes('Ctrl') && modifiers.includes('Cmd');
  const otherModifiers = modifiers.filter((modifier) => modifier !== 'Cmd');
  const macModifiers = eitherModifier ? modifiers.filter((modifier) => modifier !== 'Ctrl') : modifiers.filter((modifier) => modifier !== 'Cmd');
  for (const key of keys.length ? keys : ['(any other printable key)']) {
    addShortcut({
      scope: 'freeform-canvas',
      handler: 'MarqueeView.onKeyDown',
      modifierBitsMac: '',
      modifierBitsOther: '',
      chordMac: [...macModifiers, keyLabel(key)].join(' + '),
      chordOther: [...otherModifiers, keyLabel(key)].join(' + '),
      key,
      keyLabel: keyLabel(key),
      effect,
      calls: callsIn(branch.thenStatement, marqueeFile),
      guards: [text],
      eventControl: control,
      source: { file: marqueePath, line, url: sourceUrl(marqueePath, line) },
    });
  }
  branch = branch.elseStatement && ts.isIfStatement(branch.elseStatement) ? branch.elseStatement : undefined;
}

const marqueeCommand = findMethod(marqueeFile, 'marqueeCommand');
const marqueeStatements = marqueeCommand.body?.statements ?? [];
for (const statement of marqueeStatements) {
  if (!ts.isIfStatement(statement)) continue;
  const conditionText = compact(statement.expression, marqueeFile, 300);
  const line = lineOf(marqueeFile, statement);
  const body = compact(statement.thenStatement, marqueeFile, 4000);
  const control = { stopPropagation: /stopPropagation\(\)/.test(body), preventDefault: /preventDefault\(\)/.test(body), conditional: false };

  const inner = switchIn(statement.thenStatement);
  if (inner) {
    // `'ctsSpgGw'.indexOf(e.key) !== -1` gates a switch over the same letters.
    let pending = [];
    for (const clause of inner.caseBlock.clauses) {
      if (ts.isDefaultClause(clause) || !ts.isStringLiteralLike(clause.expression)) continue;
      pending.push(clause.expression.text);
      if (!clause.statements.length) continue;
      const effect = clause.statements.map((child) => compact(child, marqueeFile, 200)).join(' ');
      const clauseLine = lineOf(marqueeFile, clause);
      for (const key of pending) {
        addShortcut({
          scope: 'marquee-selection',
          handler: 'MarqueeView.marqueeCommand',
          modifierBitsMac: '',
          modifierBitsOther: '',
          chordMac: caseSensitiveChord(key),
          chordOther: caseSensitiveChord(key),
          key,
          keyLabel: caseSensitiveChord(key),
          effect,
          calls: callsIn(clause, marqueeFile),
          guards: [conditionText],
          eventControl: control,
          source: { file: marqueePath, line: clauseLine, url: sourceUrl(marqueePath, clauseLine) },
        });
      }
      pending = [];
    }
    continue;
  }

  const keys = [...conditionText.matchAll(/\.key\s*===\s*'([^']+)'/g)].map((match) => match[1]);
  for (const key of keys) {
    addShortcut({
      scope: 'marquee-selection',
      handler: 'MarqueeView.marqueeCommand',
      modifierBitsMac: '',
      modifierBitsOther: '',
      chordMac: keyLabel(key),
      chordOther: keyLabel(key),
      key,
      keyLabel: keyLabel(key),
      effect: compact(statement.thenStatement, marqueeFile, 300),
      calls: callsIn(statement.thenStatement, marqueeFile),
      guards: [conditionText],
      eventControl: control,
      source: { file: marqueePath, line, url: sourceUrl(marqueePath, line) },
    });
  }
}

/* ------------------------------------------------------------------ *
 * Plain language
 * ------------------------------------------------------------------ */

const reviewedPlain = {
  // Keyed by handler and key, because the same letter means different things
  // under different modifiers: Ctrl+F searches, but the alt handler's F floats.
  'unmodified|escape': 'The universal way out. It cancels a link in progress, the active ink tool, a drag, a timeline region selection, and the Google sign-in flow; closes the context menu, sharing, and settings; and only then clears the selection and any lightbox.',
  'unmodified|delete': 'Closes the selected document, or dismisses the lightbox if nothing is selected. Ignored while you are typing in an input.',
  'unmodified|backspace': 'Closes the selected document, or dismisses the lightbox if nothing is selected. Ignored while you are typing in an input.',
  'unmodified|arrowleft': 'Nudges the selected freeform documents one unit left. Ignored inside a text input.',
  'unmodified|arrowright': 'Nudges the selected freeform documents one unit right. Ignored inside a text input.',
  'unmodified|arrowup': 'Nudges the selected freeform documents one unit up. Ignored inside a text input.',
  'unmodified|arrowdown': 'Nudges the selected freeform documents one unit down. Ignored inside a text input.',
  'shift|arrowleft': 'Nudges the selected freeform documents ten units left.',
  'shift|arrowright': 'Nudges the selected freeform documents ten units right.',
  'shift|arrowup': 'Nudges the selected freeform documents ten units up.',
  'shift|arrowdown': 'Nudges the selected freeform documents ten units down.',
  'shift|g': 'Puts every selected document into one new group, then clears the selection.',
  'shift|u': 'Removes the group from every selected document, then clears the selection.',
  'alt|f': 'Floats the first selected document above its freeform collection, when that view supports floating.',
  'alt|ƒ': 'The character this keyboard layout produces for the same chord. It shares the float case so the command still matches.',
  'ctrl|z': 'Undoes the last Dash action batch. It does nothing on the home screen.',
  'ctrl|y': 'Redoes the last undone batch. It does nothing on the home screen.',
  'ctrl|f': 'Searches inside the selected document when that document supports search, and otherwise opens the global search panel.',
  'ctrl|i': 'Opens the Imports panel.',
  'ctrl|s': 'Opens the Trails panel. This deliberately replaces the browser Save shortcut inside the workspace.',
  'ctrl|t': 'Runs whatever the Tools button on your user document is configured to do.',
  'ctrl|p': 'Turns the pen on, or off if it is already on.',
  'ctrl|e': 'Turns the eraser on, or off if it is already on.',
  'ctrl|r': 'Left to the browser, so the page reloads.',
  'ctrl|a': 'Passed through to the browser only when focus is inside an element. With focus on the page body, Dash swallows it and nothing is selected.',
  'ctrl|c': 'Copies the selected documents as clone references, together with the selection centre, rather than copying their contents.',
  'ctrl|x': 'Cuts the selected documents: it writes their identifiers and the selection centre to the clipboard, then closes them.',
  'ctrl|v': 'Left to the browser, which fires the paste event Dash listens to separately.',
  'ctrl|arrowleft': 'Reserved so the chord still reaches the browser inside an input; it does nothing on the canvas.',
  'ctrl|arrowright': 'Reserved so the chord still reaches the browser inside an input; it does nothing on the canvas.',
  'ctrl|backspace': 'Reserved so the chord still reaches the browser inside an input; it does nothing on the canvas.',
  'ctrl_shift|z': 'Redoes the last undone batch. Unlike plain redo, this one is not blocked on the home screen.',
  'ctrl_shift|p': 'Switches the ink to handwriting mode and turns the pen on.',
  'MarqueeView.onKeyDown|:': 'Opens the document-creation menu at the pointer.',
  'MarqueeView.onKeyDown|?': 'Asks for a topic, then creates a Wikipedia web document for it beside the canvas.',
  'MarqueeView.onKeyDown|u': 'Ungroups, when the containing view supplies an ungroup action.',
  'MarqueeView.onKeyDown|a': 'Selects every document currently active in this view.',
  'MarqueeView.onKeyDown|q': 'Reads the clipboard, rejoins lines that were wrapped mid-sentence, and creates one text note per resulting line, indented to match the source.',
  'MarqueeView.onKeyDown|b': 'Pastes an image from the clipboard and uses it as this collection’s icon.',
  'MarqueeView.onKeyDown|p': 'Reads the clipboard and lays it out as a table, splitting on tabs.',
  'MarqueeView.onKeyDown|h': 'Reads the clipboard as HTML and creates a web document from it.',
  'MarqueeView.onKeyDown|(any other printable key)': 'Any ordinary character starts a new text note at the pointer and puts that character into it. This is the fallback branch, so it runs only when no earlier branch matched, neither Ctrl nor Cmd is held, and fewer than two documents are selected.',
  'MarqueeView.marqueeCommand|g': 'Collects the marquee’s documents into a new collection and keeps them grouped.',
  'MarqueeView.marqueeCommand|c': 'Collects the marquee’s documents into a new collection.',
  'MarqueeView.marqueeCommand|t': 'Collects the marquee’s documents into a new stacking collection.',
  'MarqueeView.marqueeCommand|s': 'Summarises the marquee’s documents.',
  'MarqueeView.marqueeCommand|S': 'Summarises the marquee’s documents; the capital letter runs the same command.',
  'MarqueeView.marqueeCommand|G': 'Generates a scrapbook from the marquee’s documents.',
  'MarqueeView.marqueeCommand|p': 'Piles the marquee’s documents up into a stack.',
  'MarqueeView.marqueeCommand|w': 'Generates wiki-style links between the marquee’s documents.',
  'MarqueeView.marqueeCommand|d': 'Deletes the marquee’s documents.',
  'MarqueeView.marqueeCommand|h': 'Deletes the marquee’s documents, hiding them rather than removing them outright.',
  'MarqueeView.marqueeCommand|Backspace': 'Deletes the marquee’s documents.',
  'MarqueeView.marqueeCommand|Delete': 'Deletes the marquee’s documents.',
  'MarqueeView.marqueeCommand|r': 'Switches the marquee between a rectangle and a freehand lasso.',
  'MarqueeView.marqueeCommand| ': 'Switches the marquee between a rectangle and a freehand lasso.',
};

const scopeNames = {
  global: 'Anywhere in Dash',
  'freeform-canvas': 'A focused freeform canvas',
  'marquee-selection': 'An active marquee selection',
};

for (const shortcut of shortcuts) {
  shortcut.scopeName = scopeNames[shortcut.scope];
  // A case whose only statement is `break` is a placeholder: the key is claimed
  // by the router but the behaviour behind it is commented out or removed.
  shortcut.empty = !shortcut.effect || /^break;?$/.test(shortcut.effect.trim());
  shortcut.plain =
    reviewedPlain[`${shortcut.handler}|${shortcut.key}`] ??
    (shortcut.empty
      ? 'Claimed but inert: the case exists with no body, so pressing it does nothing today.'
      : `Runs the handler shown in the trace against ${shortcut.scopeName.toLowerCase()}.`);
  shortcut.browserDefault = shortcut.eventControl.preventDefault
    ? shortcut.eventControl.conditional
      ? 'Dash blocks the browser default in some branches of this case; read the trace for which.'
      : 'Dash blocks the browser default for this chord.'
    : 'The browser default still runs.';
}

const platformNote = routes.map((route) => ({
  handler: route.handlerName,
  macModifiers: decodeBits(route.mac),
  otherModifiers: decodeBits(route.other),
  differs: route.mac !== route.other,
  source: { file: keyHandlerPath, line: route.line, url: sourceUrl(keyHandlerPath, route.line) },
}));

const scopeOrder = ['global', 'freeform-canvas', 'marquee-selection'];
shortcuts.sort((a, b) => scopeOrder.indexOf(a.scope) - scopeOrder.indexOf(b.scope) || a.source.line - b.source.line);

const output = {
  schemaVersion: 1,
  generatedAt: sourceReference.generatedAt,
  repository: { remote, baseline },
  methodology: {
    parser: 'TypeScript compiler AST over GlobalKeyHandler.ts and MarqueeView.tsx',
    router: 'KeyManager.router entries decoded from the four-bit shift/ctrl/alt/meta index, including the macOS branch',
    cases: 'Every switch case and if/else branch that tests a key name, with fall-through cases attributed to the body they share',
    eventControl: 'preventDefault and stopPropagation resolved from each case, falling back to the handler default',
    driftRule: 'Generation fails when the router, a handler switch, or the marquee key branch disappears',
  },
  summary: {
    shortcuts: shortcuts.length,
    scopes: new Set(shortcuts.map((row) => row.scope)).size,
    routedModifierCombinations: routes.length,
    platformDivergentHandlers: platformNote.filter((entry) => entry.differs).length,
    unroutedModifierCombinationsMac: unroutedMac.length,
    unroutedModifierCombinationsOther: unroutedOther.length,
    blocksBrowserDefault: shortcuts.filter((row) => row.eventControl.preventDefault).length,
    reservedButEmpty: shortcuts.filter((row) => row.empty).length,
  },
  platformRouting: {
    bitOrder: BIT_ORDER,
    routes: platformNote,
    unroutedMac,
    unroutedOther,
  },
  scopes: scopeOrder.map((id) => ({ id, name: scopeNames[id], shortcuts: shortcuts.filter((row) => row.scope === id).length })).filter((scope) => scope.shortcuts),
  shortcuts,
};

const outputPath = path.join(root, 'src', 'data', 'generated', 'keyboard-shortcuts.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${outputPath}\n` +
    `${output.summary.shortcuts} shortcuts across ${output.summary.scopes} scopes; ` +
    `${output.summary.routedModifierCombinations} routed modifier combinations, ` +
    `${output.summary.platformDivergentHandlers} of which are wired differently on macOS; ` +
    `${output.summary.blocksBrowserDefault} block a browser default.`
);
