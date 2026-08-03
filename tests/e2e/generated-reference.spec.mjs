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
  await expect(serialize.getByText('Failure semantic:', { exact: false })).toBeVisible();
  await expect(serialize.getByText(/unregistered object constructor throws/)).toBeVisible();
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
