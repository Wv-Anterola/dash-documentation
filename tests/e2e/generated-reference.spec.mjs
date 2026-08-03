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
