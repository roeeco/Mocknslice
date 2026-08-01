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

test('generates complementary waffle slots and exports them on the active sheet', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Fabrication mode').selectOption('waffle-slices');

  await expect(page.getByRole('heading', { name: 'Interlocking slices' })).toBeVisible();
  await expect(page.getByLabel('Family A axis')).toHaveValue('x');
  await expect(page.getByLabel('Family B axis')).toHaveValue('y');
  await expect(page.getByLabel('Family A spacing')).toHaveValue('20');
  await expect(page.getByLabel('Family B spacing')).toHaveValue('20');
  await page.getByLabel('Slot clearance').fill('0.25');
  await expect(page.getByText('0.6 mm', { exact: true })).toBeVisible();
  await page.getByLabel('Reverse all slot directions').check();

  await page.getByRole('button', { name: 'Generate waffle slices' }).click();
  await expect(page.getByText('4 parts · 4 joints', { exact: true })).toBeVisible();
  await expect(page.getByText('Family A', { exact: true })).toBeVisible();
  await expect(page.getByText('Family B', { exact: true })).toBeVisible();
  await expect(page.getByText('4 of 4 parts placed · 1 sheet', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '2D parts' }).click();
  await expect(page.getByRole('button', { name: 'Family A · Slice X1 on sheet' })).toBeVisible();
  await expect(page.locator('path[data-slot="true"]')).toHaveCount(8);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export sheet SVG' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const svg = Buffer.concat(chunks).toString('utf8');
  expect(svg).toContain('&quot;mode&quot;:&quot;waffle-slices&quot;');
  expect(svg).toContain('-slot-');
  expect(svg).toContain('id="operation-cut"');
  expect(svg).not.toContain('<image');
});

test('imports an STL, fits a folding template, previews its net, and exports operation layers', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Choose STL model').setInputFiles({
    name: 'tetrahedron.stl',
    mimeType: 'model/stl',
    buffer: Buffer.from(tetrahedronStl),
  });
  await expect(page.getByText('STL imported and inspected.')).toBeVisible();

  await page.getByLabel('Fabrication mode').selectOption('fold-template');
  await expect(page.getByRole('heading', { name: 'Shape-aware folding template' })).toBeVisible();
  await expect(page.getByLabel('Template family')).toHaveValue('open-box');
  await page.getByLabel('Fitting axis').selectOption('z');
  await page.getByLabel('Clearance').fill('1.5');
  await page.getByRole('button', { name: 'Generate template' }).click();

  await expect(page.getByText('5 panels · 4 tabs', { exact: true })).toBeVisible();
  await expect(page.getByTestId('fold-profile-preview')).toBeVisible();
  await expect(page.getByText('Ghosted model', { exact: true })).toBeVisible();
  await expect(page.getByText('Assembled template', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '2D parts' }).click();
  await expect(page.getByRole('button', { name: 'Open box net on sheet' })).toBeVisible();
  await expect(page.locator('path[data-panel-id]')).not.toHaveCount(0);
  await expect(page.locator('path[data-edge-id]')).not.toHaveCount(0);
  await expect(page.locator('path[data-tab-id]')).not.toHaveCount(0);
  await page.getByRole('button', { name: '3D model' }).click();
  await expect(page.getByText('Assembled template', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '2D parts' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export sheet SVG' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const svg = Buffer.concat(chunks).toString('utf8');
  expect(svg).toContain('&quot;mode&quot;:&quot;fold-template&quot;');
  expect(svg).toContain('id="operation-cut"');
  expect(svg).toContain('id="operation-score"');
  expect(svg).toContain('id="operation-valley-fold"');
  expect(svg).toContain('data-panel-id=');
  expect(svg).toContain('data-edge-id=');
  expect(svg).toContain('data-tab-id=');
  expect(svg).toContain('data-entity-id=');
});

test('imports a low-poly STL, unfolds it, edits seams, previews folding, and exports the net', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Choose STL model').setInputFiles({
    name: 'tetrahedron.stl',
    mimeType: 'model/stl',
    buffer: Buffer.from(tetrahedronStl),
  });
  await expect(page.getByText('STL imported and inspected.')).toBeVisible();

  await page.getByLabel('Fabrication mode').selectOption('mesh-unfold');
  await expect(page.getByRole('heading', { name: 'Mesh unfolding' })).toBeVisible();
  await expect(page.getByText(/does not repair meshes/)).toBeVisible();
  await page.getByRole('button', { name: 'Generate net' }).click();

  await expect(page.getByText('4 faces · 1 island', { exact: true })).toBeVisible();
  await expect(page.getByTestId('mesh-unfold-summary')).toContainText('3 folds');
  await expect(page.getByText('Ghosted source', { exact: true })).toBeVisible();
  await expect(page.getByText('Fold preview', { exact: true })).toBeVisible();
  await page.getByLabel('Folding preview').fill('65');
  await expect(page.getByText('65%')).toBeVisible();

  await page.getByLabel('Seam strategy').selectOption('manual');
  const firstSeam = page.getByRole('checkbox').first();
  await firstSeam.check();
  await expect(page.getByRole('button', { name: 'Regenerate net' })).toBeVisible();
  await page.getByRole('button', { name: 'Regenerate net' }).click();
  await expect(page.getByText(/4 faces ·/)).toBeVisible();

  await page.getByRole('button', { name: '2D parts' }).click();
  await expect(page.getByRole('button', { name: /Unfolded net 1 on sheet/ })).toBeVisible();
  await expect(page.locator('path[data-panel-id^="unfold-face-"]')).not.toHaveCount(0);
  await expect(page.locator('path[data-tab-id^="unfold-tab-"]')).not.toHaveCount(0);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export sheet SVG' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const svg = Buffer.concat(chunks).toString('utf8');
  expect(svg).toContain('&quot;mode&quot;:&quot;mesh-unfold&quot;');
  expect(svg).toContain('&quot;projectFormatVersion&quot;:5');
  expect(svg).toContain('data-panel-id="unfold-face-');
  expect(svg).toContain('data-edge-id="unfold-edge-');
  expect(svg).toContain('data-tab-id="unfold-tab-');
  expect(svg).toContain('>T1</text>');
});

test('builds a tab-slot panel enclosure, previews it, and exports labelled joint geometry', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Material profile').selectOption('plywood-3mm');
  await page.getByLabel('Fabrication mode').selectOption('panel-construction');

  await expect(page.getByRole('heading', { name: 'Panel construction' })).toBeVisible();
  await expect(page.getByLabel('Inside width (mm)')).toHaveValue('80');
  await page.getByLabel('Edge joint').selectOption('tab-slot');
  await page.getByLabel('Slot clearance (mm)').fill('0.2');
  await page.getByRole('button', { name: 'Generate panels' }).click();

  await expect(page.getByText('5 panels · 8 joints', { exact: true })).toBeVisible();
  await expect(page.getByTestId('panel-construction-summary')).toContainText('slots');
  await expect(page.getByText('Assembled panel kit', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '2D parts' }).click();
  await expect(page.getByRole('button', { name: 'Base panel on sheet' })).toBeVisible();
  await expect(page.locator('path[data-contour-role="hole"]')).not.toHaveCount(0);
  await expect(page.locator('path[data-edge-id^="construction-joint-"]')).not.toHaveCount(0);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export sheet SVG' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const svg = Buffer.concat(chunks).toString('utf8');
  expect(svg).toContain('&quot;mode&quot;:&quot;panel-construction&quot;');
  expect(svg).toContain('&quot;projectFormatVersion&quot;:5');
  expect(svg).toContain('data-panel-id="construction-panel-');
  expect(svg).toContain('data-edge-id="construction-joint-');
  expect(svg).toContain('data-contour-role="hole"');
  expect(svg).toContain('>J1</text>');
});

test('prepares kerf, perforations, labels, registration marks, styles, and PDF output', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Fabrication mode').selectOption('fold-template');
  await page.getByRole('button', { name: 'Generate template' }).click();
  await expect(page.getByText('5 panels · 4 tabs', { exact: true })).toBeVisible();

  await page.getByLabel('Kerf compensation').selectOption('material');
  await expect(
    page.getByLabel('Fabrication output').getByText('0.1 mm', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Fold-line output').selectOption('perforate');
  await page.getByLabel('Dash length').fill('3');
  await page.getByLabel('Gap length').fill('1');
  await page.getByLabel('Registration marks').check();
  await page.getByLabel('Label size').fill('4');
  await page.getByText('Operation styles', { exact: true }).click();
  await page.getByLabel('Cut colour').fill('#00aa11');
  await page.getByLabel('Cut width').fill('0.2');

  await page.getByRole('button', { name: '2D parts' }).click();
  await expect(page.locator('path[data-registration-mark="true"]')).toHaveCount(8);
  await expect(page.locator('path[data-operation="perforate"]')).not.toHaveCount(0);
  await expect(page.locator('path[data-operation="valley-fold"]')).toHaveCount(0);
  await expect(page.locator('path[data-operation="cut"]').first()).toHaveAttribute(
    'stroke',
    '#00aa11',
  );

  const svgDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download active sheet SVG' }).click();
  const svgDownload = await svgDownloadPromise;
  const svgStream = await svgDownload.createReadStream();
  const svgChunks: Uint8Array[] = [];
  for await (const chunk of svgStream as AsyncIterable<Uint8Array>) svgChunks.push(chunk);
  const svg = Buffer.concat(svgChunks).toString('utf8');
  expect(svg).toContain('&quot;projectFormatVersion&quot;:5');
  expect(svg).toContain('&quot;kerfMm&quot;:0.1');
  expect(svg).toContain('id="operation-perforate"');
  expect(svg).toContain('data-registration-mark="true"');
  expect(svg).toContain('stroke="#00aa11" stroke-width="0.2"');
  expect(svg).toContain('font-size="4"');

  const pdfDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export assembly PDF' }).click();
  const pdfDownload = await pdfDownloadPromise;
  expect(pdfDownload.suggestedFilename()).toMatch(/assembly\.pdf$/);
  const pdfStream = await pdfDownload.createReadStream();
  const pdfChunks: Uint8Array[] = [];
  for await (const chunk of pdfStream as AsyncIterable<Uint8Array>) pdfChunks.push(chunk);
  const pdf = Buffer.concat(pdfChunks).toString('latin1');
  expect(pdf.startsWith('%PDF-1.4')).toBe(true);
  expect(pdf).toContain('/Type /Pages');
  expect(pdf).toContain('(Open box net) Tj');
  expect(pdf).toContain('Operations: cut, score, perforate, engrave, guide');
  expect(pdf.endsWith('%%EOF\n')).toBe(true);
});
