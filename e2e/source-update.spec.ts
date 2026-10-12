import { expect, test } from '@playwright/test';
import type { MocknSliceProjectFileV9 } from '../src/domain/project';
import { createCubeMesh } from '../src/geometry/mesh/createPrimitiveMesh';
import { subdividedCube } from '../src/test-fixtures/papercraftSources';
import type { SerializableTriangleMesh } from '../src/domain/geometry';
function stl(mesh: SerializableTriangleMesh) {
  return `solid source\n${Array.from(
    { length: mesh.indices.length / 3 },
    (_, i) =>
      `facet normal 0 0 0\nouter loop\n${mesh.indices
        .slice(i * 3, i * 3 + 3)
        .map((id) => `vertex ${mesh.positionsMm.slice(id * 3, id * 3 + 3).join(' ')}`)
        .join('\n')}\nendloop\nendfacet`,
  ).join('\n')}\nendsolid source`;
}
test('reviews source replacement without losing edits and persists explicit unmatched-edit resolution', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import a 3D model', exact: true }).click();
  const input = page.getByLabel('Choose STL model', { exact: true });
  await input.setInputFiles({
    name: 'original.stl',
    mimeType: 'model/stl',
    buffer: Buffer.from(stl(createCubeMesh(40).mesh)),
  });
  await expect(page.getByText('STL imported and inspected.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use collision-safe unfolding', exact: true }).click();
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  await page.getByRole('button', { name: '2D parts', exact: true }).click();
  // Select a real cut seam; a split would also be retained by the source-update confidence gate.
  const target = page.locator('[data-papercraft-edge]').first();
  await target.locator('circle').click();
  const selected = await page
    .locator('[data-papercraft-selected-edge]')
    .getAttribute('data-papercraft-selected-edge');
  expect(selected).toBeTruthy();
  const hide = page.getByRole('button', { name: 'Hide tab', exact: true });
  if (await hide.isEnabled()) await hide.click();
  else {
    await page.getByRole('button', { name: 'Split edge', exact: true }).click();
    await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
    await hide.click();
  }
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  await input.setInputFiles({
    name: 'same.stl',
    mimeType: 'model/stl',
    buffer: Buffer.from(stl(createCubeMesh(40).mesh)),
  });
  const dialog = page.getByRole('dialog', { name: 'Review source update', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Unresolved edits: 0');
  await dialog.getByRole('button', { name: 'Cancel source update', exact: true }).click();
  await expect(page.locator('.papercraft-toolbar')).toContainText('suppressed');
  await input.setInputFiles({
    name: 'replacement.stl',
    mimeType: 'model/stl',
    buffer: Buffer.from(stl(createCubeMesh(42).mesh)),
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText('Unresolved edits: 0');
  await dialog.getByRole('button', { name: 'Accept source update', exact: true }).click();
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  await expect(
    page.getByRole('heading', { name: 'Review unmatched edits before cutting', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Review unmatched edits before cutting', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Discard this unmatched edit', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Review unmatched edits before cutting', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Projects', exact: true }),
    pending = page.waitForEvent('download');
  await drawer.getByRole('button', { name: 'Download project JSON', exact: true }).click();
  const stream = await (await pending).createReadStream(),
    chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const saved = JSON.parse(Buffer.concat(chunks).toString('utf8')) as MocknSliceProjectFileV9;
  expect(saved.project.model.dimensions.widthMm).toBe(42);
  expect(saved.project.unresolvedEdits).toEqual([]);
  expect(saved.project.papercraft!.settings.edgeEdits).toEqual([]);
});
test('accepts bounded simplification, resolves tabs, cancels a worker and reloads editable mesh intent', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Import a 3D model', exact: true }).click();
  await page.getByLabel('Choose STL model', { exact: true }).setInputFiles({
    name: 'subdivided.stl',
    mimeType: 'model/stl',
    buffer: Buffer.from(stl(subdividedCube())),
  });
  await expect(page.getByText('STL imported and inspected.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use collision-safe unfolding', exact: true }).click();
  await expect(page.locator('.studio-bottom-bar')).not.toContainText('Calculating', {
    timeout: 15000,
  });
  const target = page.getByRole('slider', { name: 'Face target', exact: true });
  await target.fill('150');
  await target.blur();
  await page.getByRole('checkbox', { name: /accept.*simplif/i }).check();
  const candidates = page.getByLabel('Candidate budget', { exact: true });
  await candidates.fill('1');
  await candidates.press('Enter');
  await page.getByRole('button', { name: 'Optimize net', exact: true }).click();
  await expect(page.locator('.studio-bottom-bar')).not.toContainText('Calculating', {
    timeout: 20000,
  });
  for (let i = 0; i < 10; i++) {
    const button = page
      .getByRole('button', { name: 'Suppress unresolved tab', exact: true })
      .first();
    if (!(await button.count())) break;
    await button.click();
    await expect(page.locator('.studio-bottom-bar')).not.toContainText('Calculating', {
      timeout: 20000,
    });
  }
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  await expect(page.locator('.papercraft-toolbar')).toContainText('192 → 150');
  await page.getByRole('button', { name: 'Optimize net', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel calculation', exact: true }).click();
  await expect(page.locator('.studio-bottom-bar')).not.toContainText('Calculating', {
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Optimize net', exact: true }).click();
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry', {
    timeout: 20000,
  });
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.papercraft-toolbar')).toContainText('192 → 150');
  await expect(
    page.getByRole('button', { name: 'Review mesh preparation', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '2D parts', exact: true }).click();
  await expect(page.locator('[data-papercraft-edge]')).not.toHaveCount(0);
});
