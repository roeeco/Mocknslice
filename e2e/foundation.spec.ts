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
