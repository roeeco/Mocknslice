import type { MocknSliceProjectFileV9 } from '../src/domain/project';
import { expect, test } from '@playwright/test';
const vertices = [
  [-20, -20, -20],
  [20, -20, -20],
  [20, 20, -20],
  [-20, 20, -20],
  [-20, -20, 20],
  [20, -20, 20],
  [20, 20, 20],
  [-20, 20, 20],
];
const indices = [
  0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6,
  1, 6, 5,
];
const cubeStl = `solid cube\n${Array.from(
  { length: indices.length / 3 },
  (_, i) =>
    `facet normal 0 0 0\nouter loop\n${indices
      .slice(i * 3, i * 3 + 3)
      .map((index) => `vertex ${vertices[index].join(' ')}`)
      .join('\n')}\nendloop\nendfacet`,
).join('\n')}\nendsolid cube`;

test('imports STL and edits native edges directly with undo, locks, folding, v9 export and reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import a 3D model', exact: true }).click();
  await page
    .getByLabel('Choose STL model', { exact: true })
    .setInputFiles({ name: 'cube.stl', mimeType: 'model/stl', buffer: Buffer.from(cubeStl) });
  await expect(page.getByText('STL imported and inspected.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use collision-safe unfolding', exact: true }).click();
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  await page.getByRole('button', { name: '2D parts', exact: true }).click();
  await expect(page.locator('.papercraft-net-targets')).toBeVisible();
  const crease = page.locator('path[data-operation="mountain-fold"]').first(),
    edgeId = await crease.getAttribute('data-edge-id');
  expect(edgeId).toBeTruthy();
  const key = edgeId!.slice(5);
  await page.locator(`[data-papercraft-edge="${key}"]`).first().locator('circle').click();
  await expect(page.locator('[data-papercraft-selected-edge]')).toHaveAttribute(
    'data-papercraft-selected-edge',
    key,
  );
  await page.getByRole('button', { name: 'Split edge', exact: true }).click();
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  await expect(page.locator('.papercraft-toolbar')).toContainText('must-cut');
  await page.getByRole('button', { name: 'Hide tab', exact: true }).click();
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  await expect(page.locator('.papercraft-toolbar')).toContainText('suppressed');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.papercraft-toolbar')).not.toContainText('suppressed');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.papercraft-toolbar')).toContainText('suppressed');
  await page.getByRole('button', { name: 'Join edge', exact: true }).click();
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  await expect(page.locator('.papercraft-toolbar')).toContainText('must-join');
  await page.getByRole('button', { name: 'Lock placement', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unlock placement', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Together', exact: true }).click();
  await expect(page.locator('.dual-preview canvas')).toBeVisible();
  await page.getByLabel('Fold preview', { exact: true }).fill('0.6');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Projects' });
  const downloadPromise = page.waitForEvent('download');
  await drawer.getByRole('button', { name: 'Download project JSON', exact: true }).click();
  const stream = await (await downloadPromise).createReadStream(),
    chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const saved = JSON.parse(Buffer.concat(chunks).toString('utf8')) as MocknSliceProjectFileV9;
  expect(saved.version).toBe(9);
  expect(
    saved.project.papercraft!.settings.edgeEdits.some(
      (e: { id: string; intent: string }) => e.id === key && e.intent === 'must-join',
    ),
  ).toBe(true);
  expect(
    saved.project.papercraft!.settings.islandEdits.some(
      (e: { layoutLocked: boolean }) => e.layoutLocked,
    ),
  ).toBe(true);
  await drawer.getByRole('textbox', { name: 'Project name', exact: true }).fill('Native cube');
  await drawer.getByRole('button', { name: 'Save a named copy', exact: true }).click();
  await expect(drawer.locator('.saved-project-row').filter({ hasText: 'Native cube' })).toHaveCount(
    1,
  );
  await drawer.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.project-status')).toContainText('Saved locally');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue(
    'Native cube',
  );
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  await page.getByRole('button', { name: '2D parts', exact: true }).click();
  await page.locator(`[data-papercraft-edge="${key}"]`).first().locator('circle').click();
  await expect(page.locator('.papercraft-toolbar')).toContainText('must-join');
  await expect(page.getByRole('button', { name: 'Unlock placement', exact: true })).toBeVisible();
});
