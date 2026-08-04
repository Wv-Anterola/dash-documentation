import { expect, test } from '@playwright/test';
import reference from '../../src/data/generated/source-modules.json' with { type: 'json' };

const slug = (path) =>
  path.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

test('searches generated modules and opens an immutable symbol reference', async ({ page }) => {
  await page.goto('/technical/api/');
  await expect(page.getByRole('heading', { name: 'Source-generated API and registry reference' })).toBeVisible();
  const query = page.getByLabel('Find a module or symbol');
  await query.fill('DocumentTypes');
  await expect(page.locator('.source-module:visible')).toHaveCount(1);

  const module = reference.modules.find((row) => row.path.endsWith('/DocumentTypes.ts'));
  expect(module).toBeTruthy();
  await page.goto(`/technical/api/modules/${slug(module.path)}/`);
  await expect(page.getByRole('heading', { name: module.path })).toBeVisible();
  await expect(page.locator('a[href*="/blob/"][href*="#L"]').first()).toBeVisible();
});

test('searches every exported symbol and opens its exact module contract', async ({ page }) => {
  const shellResponse = await page.request.get('/technical/exported-symbols/');
  expect(shellResponse.ok()).toBeTruthy();
  expect(Buffer.byteLength(await shellResponse.text())).toBeLessThan(150_000);
  const dataResponse = await page.request.get('/assets/data/exported-symbols.json');
  expect(dataResponse.ok()).toBeTruthy();
  expect(dataResponse.headers()['content-type']).toContain('application/json');
  const symbolData = await dataResponse.json();
  expect(symbolData.rows).toHaveLength(2264);

  await page.goto('/technical/exported-symbols/');
  await expect(page.getByRole('heading', { name: 'Exported symbol index' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Five-stage map from the pinned Dash source tree/ })).toBeVisible();
  await expect(page.locator('.exported-symbol-summary strong').first()).toHaveText('2,264');
  await expect(page.locator('[data-exported-symbol-row]:visible')).toHaveCount(80);

  const query = page.getByLabel('Find a name, signature, module, behavior, or direct call');
  await query.fill('export function CompileScript(script: string');
  await expect(page.locator('[data-exported-symbol-row]:visible')).toHaveCount(1);
  await expect(page.locator('[data-exported-symbol-count]')).toContainText('1 of 1 matching exports');
  const result = page.locator('[data-exported-symbol-row]:visible');
  await result.locator('summary').click();
  await expect(result.getByText(/CompileScript\(script: string, options: ScriptOptions/)).toBeVisible();
  const contract = result.getByRole('link', { name: 'Open generated module contract' });
  await expect(contract).toHaveAttribute('href', /\/technical\/api\/modules\/src-client-util-scripting-ts\/#compilescript$/);
  await expect(result.getByRole('link', { name: 'Open immutable source' })).toHaveAttribute('href', /\/blob\/.*#L\d+-L\d+$/);
  await expect(page).toHaveURL(/q=export\+function\+CompileScript/);

  await contract.click();
  await expect(page).toHaveURL(/\/technical\/api\/modules\/src-client-util-scripting-ts\/#compilescript$/);
  await expect(page.locator('#compilescript')).toHaveAttribute('open', '');
  await expect(page.locator('#compilescript').getByText(/Transforms TypeScript-like author source/)).toBeVisible();

  await page.goto('/technical/exported-symbols/?kind=class');
  await expect(page.getByLabel('Declaration kind')).toHaveValue('class');
  await expect(page.locator('[data-exported-symbol-count]')).toContainText('80 of 428 matching exports');

  await page.setViewportSize({ width: 390, height: 844 });
  const geometry = await page.evaluate(() => {
    const root = document.querySelector('[data-exported-symbol-reference]');
    if (!root) throw new Error('Exported symbol reference is missing');
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rootRight: root.getBoundingClientRect().right,
    };
  });
  expect(geometry.pageWidth).toBe(geometry.viewportWidth);
  expect(geometry.rootRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
});

test('traces every interface control from plain behavior to implementation effects', async ({ page }) => {
  const dataResponse = await page.request.get('/assets/data/interface-controls.json');
  expect(dataResponse.ok()).toBeTruthy();
  expect(dataResponse.headers()['content-type']).toContain('application/json');
  const data = await dataResponse.json();
  expect(data.controls).toHaveLength(213);

  await page.goto('/reference/interface-controls/');
  await expect(page.getByRole('heading', { name: 'Interface control and node atlas' })).toBeVisible();
  await expect(page.getByRole('img', { name: /source-backed trace of the Image.*Rotate control/ })).toBeVisible();
  await expect(page.locator('.control-contract-summary strong').first()).toHaveText('213');
  await expect(page.locator('[data-control-row]:visible')).toHaveCount(40);

  const query = page.getByLabel('Find a button, icon, tooltip, handler, state field, or effect');
  await query.fill('imageRotate90');
  await expect(page.locator('[data-control-row]:visible')).toHaveCount(1);
  await expect(page.locator('[data-control-count]')).toContainText('1 of 1 matching controls');
  const rotate = page.locator('[data-control-row]:visible');
  await rotate.locator('summary').first().click();
  await expect(rotate.getByText(/Sets Native Pixel Size|Rotate 90/).first()).toBeVisible();
  await expect(rotate.getByText('the selected image document and its ImageBox renderer')).toBeVisible();
  await rotate.getByText('Technical trace', { exact: true }).click();
  await expect(rotate.getByText('imageRotate90()', { exact: true })).toBeVisible();
  await expect(rotate.getByRole('link', { name: 'Open imageRotate90 implementation' })).toHaveAttribute('href', /\/blob\/.*#L\d+$/);
  await expect(page).toHaveURL(/control=imageRotate90/);

  await page.setViewportSize({ width: 390, height: 844 });
  const geometry = await page.evaluate(() => {
    const root = document.querySelector('[data-control-reference]');
    const filters = document.querySelector('.control-contract-filters');
    if (!root || !filters) throw new Error('Interface control reference layout is missing');
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rootRight: root.getBoundingClientRect().right,
      filtersRight: filters.getBoundingClientRect().right,
    };
  });
  expect(geometry.pageWidth).toBe(geometry.viewportWidth);
  expect(geometry.filtersRight).toBeLessThanOrEqual(geometry.rootRight + 1);
});

test('filters semantic branch deltas', async ({ page }) => {
  await page.goto('/reference/branch-audit/');
  await expect(page.getByText('TypeScript compiler + Python AST')).toBeVisible();
  await expect(page.getByText('added hinge feature git push')).toHaveCount(0);
  await page.getByLabel('Relationship to master').selectOption('branch-only');
  const status = page.locator('#branch-count');
  await expect(status).toContainText('branches');
  await page.getByLabel('Find a branch, file, symbol, or feature').fill('agent');
  await expect(page.locator('.branch-audit__row:visible').first()).toBeVisible();
});

test('connects project and publication archive records', async ({ page }) => {
  await page.goto('/research/projects/');
  const projectLink = page.locator('main .project-atlas h3 a').first();
  await expect(projectLink).toBeVisible();
  await projectLink.click();
  await expect(page.getByRole('heading', { name: 'Engineering placement' })).toBeVisible();
  await expect(page.getByText('Durable state owner')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Expected execution path' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Implementation evidence' })).toBeVisible();

  await page.goto('/research/publications/');
  const publicationLink = page.locator('main .source-rows a').first();
  await expect(publicationLink).toBeVisible();
  await publicationLink.click();
  await expect(page.getByRole('heading', { name: 'Current implementation status' })).toBeVisible();
});

test('explains the causal engineering model instead of only listing components', async ({ page }) => {
  await page.goto('/architecture/engineering-model/');
  await expect(page.getByRole('heading', { name: 'How Dash actually works' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The design pressures behind the architecture' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Write path: from gesture to every client' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'System invariants' })).toBeVisible();
  await expect(page.locator('img[src*="dash-action-lifecycle"]')).toBeVisible();
});

test('connects decisions, runtime contracts, diagnostics, and symbol-level failure semantics', async ({ page }) => {
  await page.goto('/architecture/decisions-tradeoffs/');
  await expect(page.getByRole('heading', { name: 'Architecture decisions and tradeoffs' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ADR-006: Synchronize field operations instead of whole workspaces' })).toBeVisible();
  await expect(page.locator('img[src*="dash-decision-record"]')).toBeVisible();

  await page.goto('/reference/runtime-contracts/');
  await expect(page.getByRole('heading', { name: 'Runtime contract reference' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Client synchronization contracts' })).toBeVisible();
  await expect(page.getByText(/Guest creation, updates, and deletes are not emitted/)).toBeVisible();

  await page.goto('/development/troubleshooting/');
  await expect(page.getByRole('heading', { name: 'Troubleshooting Dash' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'An edit appears, then disappears after reload' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Evidence bundle for escalation' })).toBeVisible();

  await page.goto(`/technical/api/modules/${slug('src/client/DocServer.ts')}/`);
  const updateField = page.locator('details').filter({
    has: page.locator('summary code').filter({ hasText: /^UpdateField$/ }),
  });
  await expect(updateField).toHaveCount(1);
  await updateField.locator('summary').click();
  await expect(updateField.getByText(/Failure semantic:/).first()).toBeVisible();
  await expect(updateField.getByText(/Guest and read-only updates are suppressed/)).toBeVisible();
  await expect(updateField.locator('.source-contract')).toBeVisible();
});

test('keeps basics and reference navigation usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/getting-started/basic-interactions/');
  await expect(page.getByRole('heading', { name: 'Move, order, select, and resize things' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The short version' })).toBeVisible();
  await page.getByRole('button', { name: /menu/i }).click();
  await expect(page.getByText('Technical', { exact: true })).toBeVisible();
  await expect(page.getByText('Research', { exact: true })).toBeVisible();
});

test('shows availability and source evidence without exposing revision hashes', async ({ page }) => {
  await page.goto('/capabilities/');
  await expect(page.locator('.capability-availability').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'source coverage note' })).toBeVisible();
  await expect(page.getByText(reference.repository.baselineTip.slice(0, 12))).toHaveCount(0);
  await expect(page.getByText(/immutable source link/).first()).toBeVisible();
});

test('documents field encoding, the wire protocol, and observed security boundaries', async ({ page }) => {
  await page.goto('/architecture/field-runtime/');
  await expect(page.getByRole('heading', { name: 'Field runtime and serialization' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Seven-stage lifecycle/ })).toBeVisible();
  await expect(page.locator('li').filter({ hasText: 'become serialized' })).toContainText(
    'undefined and null become serialized null'
  );

  await page.goto('/reference/synchronization-protocol/');
  await expect(page.getByRole('heading', { name: 'Synchronization protocol reference' })).toBeVisible();
  await expect(page.getByText('85ff0b5e-3e4c-5f4a-8434-50c8b8782bfe')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Consistency model' })).toBeVisible();
  await expect(page.getByText('None for ordinary create/update/delete')).toBeVisible();

  await page.goto('/architecture/server-storage-security/');
  await expect(page.getByRole('heading', { name: 'Observed enforcement matrix' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Trust-boundary map/ })).toBeVisible();
  await expect(page.getByText('Current destructive protocol surface')).toBeVisible();

  await page.goto(`/technical/api/modules/${slug('src/client/util/SerializationHelper.ts')}/`);
  const serialize = page.locator('details').filter({
    has: page.locator('summary code').filter({ hasText: /^Serialize$/ }),
  });
  await serialize.locator('summary').click();
  await expect(serialize.getByText('Failure semantic:', { exact: false }).first()).toBeVisible();
  await expect(serialize.getByText(/unregistered object constructor throws/).first()).toBeVisible();
});

test('catalogues the HTTP surface and exposes request-supervision contracts', async ({ page }) => {
  await page.goto('/reference/http-service-interface/');
  await expect(page.getByRole('heading', { name: 'HTTP and service interface reference' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Two-lane lifecycle/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /full 1600 × 900 resolution/ })).toBeVisible();
  await expect(page.getByText('109', { exact: true }).first()).toBeVisible();
  const geometry = await page.evaluate(() => {
    const root = document.querySelector('[data-http-route-reference]');
    const filters = document.querySelector('.http-route-filters');
    const scroller = document.querySelector('.http-route-scroll');
    if (!root || !filters || !scroller) throw new Error('HTTP reference layout is missing');
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rootRight: root.getBoundingClientRect().right,
      filtersRight: filters.getBoundingClientRect().right,
      tableViewport: scroller.clientWidth,
      tableContent: scroller.scrollWidth,
    };
  });
  expect(geometry.pageWidth).toBe(geometry.viewportWidth);
  expect(geometry.filtersRight).toBeLessThanOrEqual(geometry.rootRight + 1);
  expect(geometry.tableContent).toBeGreaterThan(geometry.tableViewport);

  const query = page.getByLabel('Find a path, input, response, or service');
  await query.fill('saveDynamicTool');
  await expect(page.locator('[data-route-row]:visible')).toHaveCount(1);
  await expect(
    page.locator('[data-route-row]:visible').getByText('Direct Express; no route supervisor')
  ).toBeVisible();
  await expect(page.locator('[data-route-count]')).toHaveText('1 registration shown');

  await query.fill('');
  await page.getByLabel('Access path').selectOption('admin-in-release');
  await expect(page.locator('[data-route-row]:visible')).toHaveCount(2);
  await expect(page.locator('[data-route-count]')).toHaveText('2 registrations shown');
  await expect(page.getByText('Multiple registration layers:')).toBeVisible();

  await page.goto(`/technical/api/modules/${slug('src/server/RouteManager.ts')}/`);
  const supervisor = page.locator('details').filter({
    has: page.locator('summary code').filter({ hasText: /addSupervisedRoute$/ }),
  });
  await supervisor.locator('summary').click();
  await expect(supervisor.getByText(/one-second missing-response timer/)).toBeVisible();
  await expect(supervisor.getByText(/does not replace per-action/)).toBeVisible();
});

test('maps every document type from stored value through factory and renderer', async ({ page }) => {
  await page.goto('/reference/document-types/');
  await expect(page.getByRole('heading', { name: 'Document type, prototype, and factory reference' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Seven-stage lifecycle/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /full 1600 x 900 resolution/ })).toBeVisible();
  await expect(page.locator('.document-type-summary strong').first()).toHaveText('51');

  const geometry = await page.evaluate(() => {
    const root = document.querySelector('[data-document-type-reference]');
    const filters = document.querySelector('.document-type-filters');
    if (!root || !filters) throw new Error('Document type reference layout is missing');
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rootRight: root.getBoundingClientRect().right,
      filtersRight: filters.getBoundingClientRect().right,
    };
  });
  expect(geometry.pageWidth).toBe(geometry.viewportWidth);
  expect(geometry.filtersRight).toBeLessThanOrEqual(geometry.rootRight + 1);

  const query = page.getByLabel('Find a type, renderer, field, factory, or purpose');
  await query.fill('ConfigDocument');
  await expect(page.locator('[data-document-type-row]:visible')).toHaveCount(1);
  await expect(page.locator('[data-document-type-count]')).toHaveText('1 type shown');
  const config = page.locator('[data-document-type-row]:visible');
  await config.locator('summary').click();
  await expect(config.getByText('Docs.Create.ConfigDocument')).toBeVisible();
  await expect(config.getByText('Data-only factory').first()).toBeVisible();

  await query.fill('');
  await page.getByLabel('Construction path').selectOption('prototype-only');
  await expect(page.locator('[data-document-type-row]:visible')).toHaveCount(1);
  await expect(page.locator('[data-document-type-row]:visible summary code').first()).toHaveText('KVP');

  await expect(page.locator('.collection-view-reference article')).toHaveCount(21);
  const math = page.locator('.palette-reference tbody tr').filter({ has: page.getByText('Math', { exact: true }) });
  await expect(math).toContainText('EQUATION');
  await expect(math).toContainText('EquationDocument');
});

test('maps every serialized field tag through storage, hydration, and conversion', async ({ page }) => {
  await page.goto('/architecture/field-runtime/');
  await expect(page.getByRole('heading', { name: 'Field runtime and serialization' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Seven-stage lifecycle from a document assignment/ })).toBeVisible();
  await expect(page.locator('.field-type-summary strong').nth(1)).toHaveText('21');
  await expect(page.locator('.field-primitives article')).toHaveCount(3);

  const geometry = await page.evaluate(() => {
    const root = document.querySelector('[data-field-type-reference]');
    const filters = document.querySelector('.field-type-filters');
    if (!root || !filters) throw new Error('Field type reference layout is missing');
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rootRight: root.getBoundingClientRect().right,
      filtersRight: filters.getBoundingClientRect().right,
    };
  });
  expect(geometry.pageWidth).toBe(geometry.viewportWidth);
  expect(geometry.filtersRight).toBeLessThanOrEqual(geometry.rootRight + 1);

  const query = page.getByLabel('Find a tag, class, stored member, behavior, or purpose');
  await query.fill('prefetch_proxy');
  await expect(page.locator('[data-field-type-row]:visible')).toHaveCount(1);
  await expect(page.locator('[data-field-type-count]')).toHaveText('1 registered type shown');
  const prefetch = page.locator('[data-field-type-row]:visible');
  await prefetch.locator('summary').click();
  await expect(prefetch.getByText('fieldId', { exact: true })).toBeVisible();
  await expect(prefetch.getByText(/prefetchValue/)).toBeVisible();
  await expect(prefetch.getByText(/ProxyField rather than preserving/)).toBeVisible();

  await query.fill('');
  await page.getByLabel('Runtime family').selectOption('media');
  await expect(page.locator('[data-field-type-row]:visible')).toHaveCount(8);
});

test('exposes every scripting global with source, role, and responsive filters', async ({ page }) => {
  await page.goto('/guides/features/scripting/');
  await expect(page.getByRole('heading', { name: 'Scripting', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /editable, applied, and saved-function states/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Seven-stage Dash scripting pipeline/ })).toBeVisible();
  await expect(page.locator('.script-global-summary strong').first()).toHaveText('151');

  const query = page.getByLabel('Find a name, parameter, operation, call, field write, or source file');
  await query.fill('selectedDocs(container');
  await expect(page.locator('[data-script-global-row]:visible')).toHaveCount(1);
  await expect(page.locator('[data-script-global-count]')).toHaveText('1 global shown');
  const selectedDocs = page.locator('[data-script-global-row]:visible');
  await selectedDocs.locator('summary').click();
  await expect(selectedDocs.getByText(/selectedDocs\(container: Doc/)).toBeVisible();
  await expect(selectedDocs.getByRole('link', { name: /registration source/ })).toHaveAttribute('href', /\/blob\/.*#L\d+$/);

  await query.fill('');
  await page.getByLabel('Runtime role').selectOption('constructor');
  await expect(page.locator('[data-script-global-row]:visible')).toHaveCount(22);
  await page.getByLabel('Registration path').selectOption('decorator');
  await expect(page.locator('[data-script-global-row]:visible')).toHaveCount(16);

  await page.setViewportSize({ width: 390, height: 844 });
  const geometry = await page.evaluate(() => {
    const root = document.querySelector('[data-script-global-reference]');
    const filters = document.querySelector('.script-global-filters');
    if (!root || !filters) throw new Error('Scripting global reference layout is missing');
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rootRight: root.getBoundingClientRect().right,
      filtersRight: filters.getBoundingClientRect().right,
    };
  });
  expect(geometry.pageWidth).toBe(geometry.viewportWidth);
  expect(geometry.filtersRight).toBeLessThanOrEqual(geometry.rootRight + 1);
});

test('assembles every right-click menu entry from its contributing component', async ({ page }) => {
  const dataResponse = await page.request.get('/assets/data/context-menus.json');
  expect(dataResponse.ok()).toBeTruthy();
  expect(dataResponse.headers()['content-type']).toContain('application/json');
  const data = await dataResponse.json();
  expect(data.items).toHaveLength(223);

  await page.goto('/reference/context-menus/');
  await expect(page.getByRole('heading', { name: 'Right-click menu atlas' })).toBeVisible();
  await expect(page.getByRole('img', { name: /How Dash assembles a right-click menu/ })).toBeVisible();
  await expect(page.locator('.control-contract-summary strong').first()).toHaveText('223');
  await expect(page.locator('#menu-list .control-contract-row')).toHaveCount(40);

  const query = page.getByLabel('Find an entry, guard, handler, or component');
  await query.fill('Send to Back');
  await expect(page.locator('#menu-list .control-contract-row')).toHaveCount(1);
  const entry = page.locator('#menu-list .control-contract-row');
  await entry.locator('summary').first().click();
  await expect(entry.getByText('Any document → Z Order... → Send to Back')).toBeVisible();
  await expect(entry.locator('dd', { hasText: 'Z Order... → Send to Back' })).toBeVisible();
  await entry.getByText('Technical trace', { exact: true }).click();
  await expect(entry.getByText(/bringToFront/).first()).toBeVisible();
  await expect(entry.getByRole('link', { name: /Open the registration in DocumentView\.tsx:\d+/ })).toHaveAttribute('href', /\/blob\/.*#L\d+$/);
  await expect(page).toHaveURL(/entry=Send\+to\+Back/);

  // A state-dependent label must show every string the same entry can read as.
  await query.fill('Hide Clusters');
  const clusters = page.locator('#menu-list .control-contract-row');
  await clusters.locator('summary').first().click();
  await expect(clusters.getByText('The same entry also reads:')).toBeVisible();
  await expect(clusters.getByText('Show Clusters')).toBeVisible();
  await expect(clusters.getByText('Contributed when Developer mode is on.')).toBeVisible();

  await query.fill('');
  await page.getByLabel('What you right-clicked').selectOption('dashboard');
  await expect(page.locator('#menu-list .control-contract-row')).toHaveCount(2);
  await page.getByLabel('How its label is decided').selectOption('generated');
  await expect(page.locator('[data-menu-count]')).toContainText('0 of 0 matching entries');

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('#menu-list .control-contract-row')).toHaveCount(40);

  await page.setViewportSize({ width: 390, height: 844 });
  const geometry = await page.evaluate(() => {
    const root = document.querySelector('[data-menu-reference]');
    const filters = root?.querySelector('.control-contract-filters');
    if (!root || !filters) throw new Error('Context menu reference layout is missing');
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rootRight: root.getBoundingClientRect().right,
      filtersRight: filters.getBoundingClientRect().right,
    };
  });
  expect(geometry.pageWidth).toBe(geometry.viewportWidth);
  expect(geometry.filtersRight).toBeLessThanOrEqual(geometry.rootRight + 1);
});

test('shows each keyboard chord for both platforms and says what the browser keeps', async ({ page }) => {
  const dataResponse = await page.request.get('/assets/data/keyboard-shortcuts.json');
  expect(dataResponse.ok()).toBeTruthy();
  const data = await dataResponse.json();
  expect(data.shortcuts).toHaveLength(58);

  await page.goto('/reference/keyboard-shortcuts/');
  await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible();
  await expect(page.locator('.control-contract-summary strong').first()).toHaveText('58');
  await expect(page.locator('#shortcut-list .control-contract-row')).toHaveCount(58);

  const query = page.getByLabel('Find a key, effect, or handler');
  await query.fill('Opens the Trails panel');
  await expect(page.locator('#shortcut-list .control-contract-row')).toHaveCount(1);
  const trails = page.locator('#shortcut-list .control-contract-row');
  await trails.locator('summary').first().click();
  await expect(trails.locator('dd', { hasText: 'Ctrl + S' })).toBeVisible();
  await expect(trails.locator('dd', { hasText: 'Cmd + S' })).toBeVisible();

  // The same letter is two different commands depending on the modifier, and
  // the macOS chords for those two commands are not the ones a reader expects.
  await query.fill('floats the first selected document');
  const float = page.locator('#shortcut-list .control-contract-row');
  await expect(float).toHaveCount(1);
  await float.locator('summary').first().click();
  await expect(float.locator('dd', { hasText: 'Ctrl + F' })).toBeVisible();

  await query.fill('');
  await page.getByLabel('Show the chord for').selectOption('mac');
  await expect(page.locator('#shortcut-list .control-contract-row').filter({ hasText: 'Differs by platform' }).first()).toBeVisible();

  await page.getByLabel('Browser default').selectOption('kept');
  const kept = await page.locator('#shortcut-list .control-contract-row').count();
  expect(kept).toBe(58 - data.summary.blocksBrowserDefault);
  await expect(page.locator('#shortcut-list .control-contract-row').first()).toContainText('Browser default kept');

  await page.setViewportSize({ width: 390, height: 844 });
  const geometry = await page.evaluate(() => {
    const root = document.querySelector('[data-shortcut-reference]');
    const filters = root?.querySelector('.control-contract-filters');
    if (!root || !filters) throw new Error('Keyboard shortcut reference layout is missing');
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rootRight: root.getBoundingClientRect().right,
      filtersRight: filters.getBoundingClientRect().right,
    };
  });
  expect(geometry.pageWidth).toBe(geometry.viewportWidth);
  expect(geometry.filtersRight).toBeLessThanOrEqual(geometry.rootRight + 1);
});
