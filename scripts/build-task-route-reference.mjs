/**
 * Builds the cross-route task index.
 *
 * The three control references answer "what does this thing do". This one
 * answers the question people actually arrive with: "I want to do X, what are
 * my options, and are they the same thing?"
 *
 * The task list is reviewed by hand, because deciding that two controls serve
 * one intent is a judgement no parser can make. What is *not* hand-written is
 * whether each named route still exists: every route below is resolved against
 * the generated control, menu, and shortcut inventories, and generation fails
 * if any of them no longer matches. A cross-reference that silently rots is
 * worse than no cross-reference, so this file refuses to emit one.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import contextMenus from '../src/data/generated/context-menus.json' with { type: 'json' };
import interfaceControls from '../src/data/generated/interface-controls.json' with { type: 'json' };
import keyboardShortcuts from '../src/data/generated/keyboard-shortcuts.json' with { type: 'json' };
import sourceReference from '../src/data/generated/source-reference.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Reviewed tasks. `caution` is used where the routes are close but not
 * identical, which is the most useful thing this page can tell someone.
 */
const tasks = [
  {
    id: 'undo-an-action',
    intent: 'Undo or redo what I just did',
    plain: 'Dash groups work into named batches, so one undo reverses a whole action rather than one keystroke.',
    control: [['Undo', 'Canvas footer'], ['Redo', 'Canvas footer']],
    shortcut: [['Ctrl + Z', 'global'], ['Ctrl + Y', 'global'], ['Shift + Ctrl + Z', 'global']],
    caution: 'Plain undo and redo do nothing on the home screen. Shift + Ctrl + Z is the only redo that is not blocked there.',
  },
  {
    id: 'remove-from-view',
    intent: 'Get a document off my screen',
    plain: 'Closing is not deleting. The document goes to Recently Closed unless it is still open somewhere else.',
    control: [['Tab close', 'Tabs and tiles']],
    menu: [['Close', 'document']],
    shortcut: [['Delete', 'global'], ['Backspace', 'global']],
    caution: 'The keyboard route is ignored while you are typing in an input, and dismisses the lightbox first if one is open.',
  },
  {
    id: 'reorder-overlapping',
    intent: 'Move a document in front of or behind another',
    plain: 'Only meaningful on a freeform canvas, where documents can overlap.',
    control: [['Top', 'Context toolbar'], ['Bottom', 'Context toolbar']],
    menu: [['Bring to Front', 'document'], ['Send to Back', 'document']],
    caution: 'The two toolbar buttons have tooltips that contradict their labels and their handlers; the labels and handlers agree with each other, so trust those.',
  },
  {
    id: 'share-a-document',
    intent: 'Let someone else see or edit something',
    plain: 'Sharing is per document. Sharing a dashboard does not automatically share everything inside it.',
    control: [['Share / View Original', 'Top bar'], ['Document sharing', 'Document decorations']],
    menu: [['Share', 'document'], ['Share Dashboard', 'dashboard']],
    caution: 'The document decoration only appears when the full link menu is enabled, and the top bar label changes to View Original without admin access.',
  },
  {
    id: 'find-something',
    intent: 'Find a document or some text',
    plain: 'One shortcut serves two different searches depending on what is selected.',
    control: [['Search', 'Sidebar']],
    shortcut: [['Ctrl + F', 'global']],
    caution: 'With exactly one document selected that supports search, the shortcut searches inside it instead of opening the panel. On macOS this is Cmd + F: Ctrl + F floats a document instead.',
  },
  {
    id: 'open-panels',
    intent: 'Open the Imports or Trails panel',
    plain: 'The sidebar buttons and their shortcuts drive the same panel state.',
    control: [['Imports', 'Sidebar'], ['Trails', 'Sidebar']],
    shortcut: [['Ctrl + I', 'global'], ['Ctrl + S', 'global']],
    caution: 'Ctrl + S opens Trails rather than saving. Dash saves continuously.',
  },
  {
    id: 'add-to-a-trail',
    intent: 'Add a document to a presentation trail',
    plain: 'Pinning adds a step to the active trail. Modifier keys decide how much state the step remembers.',
    control: [['Pin', 'Context toolbar'], ['Pin to trail', 'Document decorations'], ['Pin layout', 'Document decorations'], ['Pin content view', 'Document decorations']],
    menu: [['Pin', 'document']],
  },
  {
    id: 'group-documents',
    intent: 'Group several documents together',
    plain: 'Grouping tags the selected documents with a shared group value; collecting puts them inside a new collection. They are different operations.',
    shortcut: [['Shift + G', 'global'], ['Shift + U', 'global'], ['G', 'marquee-selection'], ['C', 'marquee-selection']],
    caution: 'Shift + G groups the current selection in place. The single-letter marquee commands create a new collection instead, and only work while a marquee is active.',
  },
  {
    id: 'create-a-document',
    intent: 'Create a new document on a canvas',
    plain: 'Every route reaches the same creator registry; they differ in where the new document lands.',
    control: [['Tools', 'Sidebar']],
    menu: [['Create document', 'document']],
    shortcut: [[':', 'freeform-canvas'], ['(any other printable key)', 'freeform-canvas']],
    caution: 'Clicking a creator uses the default destination; dragging one lets you choose the position. Typing an ordinary character starts a text note wherever the pointer is.',
  },
  {
    id: 'open-full-screen',
    intent: 'See one document full screen',
    plain: 'The lightbox floats a document over the workspace without moving it.',
    control: [['Tab lightbox icon', 'Tabs and tiles']],
    menu: [['Open in Lightbox', 'document']],
    shortcut: [['Esc', 'global']],
    caution: 'Escape dismisses the lightbox, but only after it has finished cancelling any link, drag, ink tool, or open menu.',
  },
  {
    id: 'inspect-fields',
    intent: 'See a document’s raw fields',
    plain: 'The properties panel and the metadata view show the same underlying fields with different affordances.',
    control: [['Fields & Tags', 'Properties panel']],
    menu: [['Show Metadata', 'document']],
  },
  {
    id: 'draw-and-erase',
    intent: 'Draw or erase ink',
    plain: 'The toolbar group and the shortcuts set the same active-tool state.',
    control: [['Pen', 'Context toolbar'], ['Eraser', 'Context toolbar']],
    shortcut: [['Ctrl + P', 'global'], ['Ctrl + E', 'global'], ['Shift + Ctrl + P', 'global']],
    caution: 'Shift + Ctrl + P selects handwriting ink specifically. On a focused freeform canvas, Ctrl + P is claimed first for pasting a table.',
  },
  {
    id: 'add-a-tab',
    intent: 'Add another tab or tile to the workspace',
    plain: 'The plus control on a tile is GoldenLayout’s popout button with its handler replaced; it creates a freeform canvas tab.',
    control: [['Tile new tab', 'Tabs and tiles'], ['Empty tile background', 'Tabs and tiles'], ['Drag a document into the tab bar', 'Tabs and tiles']],
    caution: 'It does not pop the tile out into a browser window, despite the upstream icon name.',
  },
  {
    id: 'export-something',
    intent: 'Get content out of Dash',
    plain: 'Export writes a file; copy writes document identifiers, not content.',
    menu: [['Zip Export', 'document'], ['Copy ID', 'document']],
    shortcut: [['Ctrl + C', 'global'], ['Ctrl + X', 'global']],
    caution: 'Copy and cut place `__DashCloneId` / `__DashDocId` markers on the clipboard. Pasting them into another application yields an identifier string, not your content.',
  },
];

/* ------------------------------------------------------------------ *
 * Resolve every route against the generated inventories
 * ------------------------------------------------------------------ */

const failures = [];

function resolveControl([label, region]) {
  const found = interfaceControls.controls.find((control) => control.label === label && control.region === region);
  if (!found) {
    failures.push(`Interface control route no longer exists: ${region} → ${label}`);
    return undefined;
  }
  return {
    kind: 'control',
    label: found.label,
    where: `${found.region} → ${found.group}`,
    plain: found.beginner,
    availability: found.visibility,
    href: `/reference/interface-controls/?control=${encodeURIComponent(found.label)}`,
    anchor: `control-${found.id}`,
    source: found.source.url,
  };
}

function resolveMenu([label, surface]) {
  const found = contextMenus.items.find((item) => item.label === label && item.surface === surface);
  if (!found) {
    failures.push(`Context menu route no longer exists: ${surface} → ${label}`);
    return undefined;
  }
  return {
    kind: 'menu',
    label: found.label,
    where: found.parent ? `${found.surfaceName} → ${found.parent}` : `${found.surfaceName} → top level`,
    plain: found.plain,
    availability: found.availability,
    href: `/reference/context-menus/?entry=${encodeURIComponent(found.label)}`,
    anchor: `menu-${found.id}`,
    source: found.source.url,
  };
}

function resolveShortcut([chord, scope]) {
  const found = keyboardShortcuts.shortcuts.find((shortcut) => shortcut.chordOther === chord && shortcut.scope === scope);
  if (!found) {
    failures.push(`Keyboard route no longer exists: ${scope} → ${chord}`);
    return undefined;
  }
  return {
    kind: 'shortcut',
    label: found.chordOther,
    macLabel: found.chordMac,
    where: found.scopeName,
    plain: found.plain,
    availability: found.browserDefault,
    href: `/reference/keyboard-shortcuts/?key=${encodeURIComponent(found.chordOther)}`,
    anchor: `shortcut-${found.id}`,
    source: found.source.url,
  };
}

const resolved = tasks.map((task) => {
  const routes = [
    ...(task.control ?? []).map(resolveControl),
    ...(task.menu ?? []).map(resolveMenu),
    ...(task.shortcut ?? []).map(resolveShortcut),
  ].filter(Boolean);
  return {
    id: task.id,
    intent: task.intent,
    plain: task.plain,
    caution: task.caution ?? '',
    routeKinds: [...new Set(routes.map((route) => route.kind))],
    routes,
  };
});

if (failures.length) {
  throw new Error(`Cross-route task index drifted from the generated inventories:\n  ${[...new Set(failures)].join('\n  ')}`);
}
for (const task of resolved) {
  if (task.routes.length < 2) throw new Error(`${task.id}: a cross-route task needs at least two surviving routes`);
}

const output = {
  schemaVersion: 1,
  generatedAt: sourceReference.generatedAt,
  repository: { remote: sourceReference.repository.remote, baseline: sourceReference.repository.baselineTip },
  methodology: {
    taskList: 'Reviewed by hand: deciding that two controls serve one intent is a judgement, not a parse',
    routeResolution: 'Every route is looked up in the generated interface-control, context-menu, and keyboard-shortcut inventories',
    driftRule: 'Generation fails when any named route disappears, or when a task drops below two surviving routes',
  },
  summary: {
    tasks: resolved.length,
    routes: resolved.reduce((total, task) => total + task.routes.length, 0),
    tasksWithThreeKinds: resolved.filter((task) => task.routeKinds.length === 3).length,
    tasksWithCaution: resolved.filter((task) => task.caution).length,
    controlRoutes: resolved.reduce((total, task) => total + task.routes.filter((route) => route.kind === 'control').length, 0),
    menuRoutes: resolved.reduce((total, task) => total + task.routes.filter((route) => route.kind === 'menu').length, 0),
    shortcutRoutes: resolved.reduce((total, task) => total + task.routes.filter((route) => route.kind === 'shortcut').length, 0),
  },
  tasks: resolved,
};

const outputPath = path.join(root, 'src', 'data', 'generated', 'task-routes.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${outputPath}\n` +
    `${output.summary.tasks} tasks resolved to ${output.summary.routes} live routes ` +
    `(${output.summary.controlRoutes} controls, ${output.summary.menuRoutes} menu entries, ${output.summary.shortcutRoutes} shortcuts); ` +
    `${output.summary.tasksWithThreeKinds} tasks are reachable all three ways.`
);
