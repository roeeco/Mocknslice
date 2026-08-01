import { expect, test } from '@playwright/test';

const tetrahedronStl = `solid tetrahedron
facet normal 0 0 -1
outer loop
vertex 0 0 0
vertex 0 20 0
vertex 10 0 0
endloop
endfacet
facet normal 0 -1 0
outer loop
vertex 0 0 0
vertex 10 0 0
vertex 0 0 30
endloop
endfacet
facet normal -1 0 0
outer loop
vertex 0 0 0
vertex 0 0 30
vertex 0 20 0
endloop
endfacet
facet normal 1 1 1
outer loop
vertex 10 0 0
vertex 0 20 0
vertex 0 0 30
endloop
endfacet
endsolid tetrahedron`;

test('opens the foundation workspace and switches to the sheet preview', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('SliceFold', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Assembled model preview' })).toBeVisible();
  await expect(page.getByLabel('Material profile')).toHaveValue('card-300gsm');

  await page.getByRole('button', { name: '2D parts' }).click();
  await expect(page.getByRole('heading', { name: 'No fabrication parts yet' })).toBeVisible();
  await expect(page.getByRole('img', { name: /millimetre sheet/ })).toBeVisible();
});

test('edits a project and exposes a working undo action', async ({ page }) => {
  await page.goto('/');
  const projectName = page.getByLabel('Project name');

  await projectName.fill('Workshop prototype');
  await expect(page.getByText('Workshop prototype', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(projectName).not.toHaveValue('Workshop prototype');
});

test('imports, inspects, scales, and rotates an STL model', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Choose STL model').setInputFiles({
    name: 'tetrahedron.stl',
    mimeType: 'model/stl',
    buffer: Buffer.from(tetrahedronStl),
  });

  await expect(page.getByRole('heading', { name: 'Model inspection' })).toBeVisible();
  await expect(page.getByText('STL imported and inspected.')).toBeVisible();
  await expect(page.getByLabel('Width (X)')).toHaveValue('10');
  await expect(page.getByLabel('Height (Y)')).toHaveValue('20');
  await expect(page.getByLabel('Depth (Z)')).toHaveValue('30');

  await page.getByLabel('Width (X)').fill('20');
  await page.getByLabel('Width (X)').press('Enter');
  await expect(page.getByLabel('Height (Y)')).toHaveValue('40');
  await expect(page.getByLabel('Depth (Z)')).toHaveValue('60');

  await page.getByRole('button', { name: 'Around X' }).click();
  await expect(page.getByLabel('Height (Y)')).toHaveValue('60');
  await expect(page.getByLabel('Depth (Z)')).toHaveValue('40');
});

test('generates, arranges, rotates, and exports a selected fabrication sheet', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByLabel('Slice axis')).toHaveValue('z');
  await expect(page.getByLabel('Slice spacing')).toHaveValue('10');
  await page.getByRole('button', { name: 'Generate slices' }).click();
  await expect(page.getByText('4 parts', { exact: true })).toBeVisible();
  await expect(page.getByText('4 of 4 parts placed · 1 sheet', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '2D parts' }).click();
  const firstPart = page.getByRole('button', { name: 'Slice Z1 on sheet' });
  const secondPart = page.getByRole('button', { name: 'Slice Z2 on sheet' });
  await expect(firstPart).toBeVisible();
  await secondPart.click();
  await expect(secondPart).toHaveAttribute('aria-pressed', 'true');
  const xBeforeDrag = await page.getByLabel('Position X').inputValue();
  const secondPartBounds = await secondPart.boundingBox();
  if (!secondPartBounds) throw new Error('The second sheet part has no rendered bounds.');
  await page.mouse.move(
    secondPartBounds.x + secondPartBounds.width / 2,
    secondPartBounds.y + secondPartBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    secondPartBounds.x + secondPartBounds.width / 2 + 12,
    secondPartBounds.y + secondPartBounds.height / 2 + 8,
    { steps: 3 },
  );
  await page.mouse.up();
  await expect.poll(() => page.getByLabel('Position X').inputValue()).not.toBe(xBeforeDrag);
  await page.getByRole('button', { name: 'Rotate 90°' }).click();
  await expect(page.getByLabel('Rotation')).toHaveValue('90');

  await page.getByLabel('Sheet width').fill('60');
  await page.getByLabel('Sheet height').fill('60');
  await page.getByRole('button', { name: 'Arrange all parts' }).click();
  await expect(page.getByText('4 of 4 parts placed · 4 sheets', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sheet 2' }).click();
  await expect(page.getByRole('button', { name: 'Slice Z2 on sheet' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export sheet SVG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/sheet-2\.svg$/);
  const stream = await download.createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const svg = Buffer.concat(chunks).toString('utf8');
  expect(svg).toContain('width="60mm"');
  expect(svg).toContain('id="operation-cut"');
  expect(svg).toContain('data-part-id="slice-z-2-1"');
  expect(svg).not.toContain('data-part-id="slice-z-1-1"');
  expect(svg).toContain('data-contour-role="outer"');
  expect(svg).not.toContain('<image');
});
