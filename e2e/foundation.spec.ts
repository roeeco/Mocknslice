import { expect, test, type Page } from '@playwright/test';

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

const openTriangleStl = `solid open
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 30 0 0
vertex 0 30 0
endloop
endfacet
endsolid open`;

const cubeTriangles = [
  [
    [0, 0, 0],
    [0, 40, 0],
    [40, 40, 0],
  ],
  [
    [0, 0, 0],
    [40, 40, 0],
    [40, 0, 0],
  ],
  [
    [0, 0, 40],
    [40, 0, 40],
    [40, 40, 40],
  ],
  [
    [0, 0, 40],
    [40, 40, 40],
    [0, 40, 40],
  ],
  [
    [0, 0, 0],
    [40, 0, 0],
    [40, 0, 40],
  ],
  [
    [0, 0, 0],
    [40, 0, 40],
    [0, 0, 40],
  ],
  [
    [0, 40, 0],
    [0, 40, 40],
    [40, 40, 40],
  ],
  [
    [0, 40, 0],
    [40, 40, 40],
    [40, 40, 0],
  ],
  [
    [0, 0, 0],
    [0, 0, 40],
    [0, 40, 40],
  ],
  [
    [0, 0, 0],
    [0, 40, 40],
    [0, 40, 0],
  ],
  [
    [40, 0, 0],
    [40, 40, 0],
    [40, 40, 40],
  ],
  [
    [40, 0, 0],
    [40, 40, 40],
    [40, 0, 40],
  ],
] as const;

const cubeStl = `solid cube
${cubeTriangles
  .map(
    (triangle) => `facet normal 0 0 0
outer loop
${triangle.map((vertex) => `vertex ${vertex.join(' ')}`).join('\n')}
endloop
endfacet`,
  )
  .join('\n')}
endsolid cube`;

async function reachImportStep(
  page: Page,
  mode = 'Stacked slices',
  experience: 'standard' | 'advanced' = 'advanced',
) {
  if (experience === 'advanced') await page.getByRole('button', { name: 'Advanced' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  const modeChoice =
    mode === 'Folding template' || mode === 'Unfold a 3D model' ? 'Folding and unfolding' : mode;
  if (modeChoice !== 'Stacked slices') await page.getByRole('radio', { name: modeChoice }).check();
  await page.getByRole('button', { name: 'Next' }).click();
}

async function reachConfigureStep(
  page: Page,
  mode = 'Stacked slices',
  importStl = false,
  experience: 'standard' | 'advanced' = 'advanced',
) {
  await reachImportStep(page, mode, experience);
  if (mode === 'Panel construction') return;
  if (mode === 'Folding template') {
    await page.getByRole('button', { name: 'Create from template' }).click();
  } else if (importStl) {
    const useCube = mode === 'Stacked slices' || mode === 'Interlocking slices';
    await page.getByLabel('Choose STL model').setInputFiles({
      name: useCube ? 'cube.stl' : 'tetrahedron.stl',
      mimeType: 'model/stl',
      buffer: Buffer.from(useCube ? cubeStl : tetrahedronStl),
    });
    await expect(page.getByText('STL imported and inspected.')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Next' }).click();
}

async function generateAndReachExport(page: Page) {
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Inspect generated parts' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Sheet layout' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Fabrication output' })).toBeVisible();
}

test('opens the foundation workspace and switches to the sheet preview', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto('/');

  await expect(page.getByText('MocknSlice', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Assembled model preview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Start a project' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('The 3D preview stopped rendering.')).toHaveCount(0);
  expect(consoleErrors.join('\n')).not.toContain('Maximum update depth exceeded');
  const shellBounds = await page.locator('.app-shell').boundingBox();
  const wizardBounds = await page.locator('.right-sidebar').boundingBox();
  const previewBounds = await page.locator('.main-workspace').boundingBox();
  if (!shellBounds || !wizardBounds || !previewBounds)
    throw new Error('Desktop workspace regions were not rendered.');
  expect(previewBounds.x).toBeGreaterThan(wizardBounds.x);
  expect(previewBounds.width).toBeCloseTo(shellBounds.width / 2, 0);

  await page.getByRole('button', { name: '2D parts' }).click();
  await expect(page.getByRole('heading', { name: 'No fabrication parts yet' })).toBeVisible();
  const sheetPreview = page.getByRole('img', { name: /millimetre sheet/ });
  await expect(sheetPreview).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(sheetPreview).toHaveAttribute('data-zoom', '1.25');
  await expect(page.getByLabel('Zoom level')).toHaveText('125%');
  await page.getByRole('button', { name: 'Fit sheet' }).click();
  await expect(sheetPreview).toHaveAttribute('data-zoom', '1');

  const sheetBounds = await sheetPreview.boundingBox();
  if (!sheetBounds) throw new Error('The 2D sheet preview has no rendered bounds.');
  await page.mouse.move(
    sheetBounds.x + sheetBounds.width * 0.3,
    sheetBounds.y + sheetBounds.height * 0.2,
  );
  await page.mouse.wheel(0, -240);
  await expect(sheetPreview).not.toHaveAttribute('data-zoom', '1');
  const viewBeforePan = await sheetPreview.getAttribute('viewBox');

  await page.mouse.down();
  await page.mouse.move(
    sheetBounds.x + sheetBounds.width * 0.3 + 42,
    sheetBounds.y + sheetBounds.height * 0.2 + 28,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect.poll(() => sheetPreview.getAttribute('viewBox')).not.toBe(viewBeforePan);

  await page.getByRole('button', { name: 'Fit sheet' }).click();
  await expect(sheetPreview).toHaveAttribute('viewBox', '0 0 10 10');
});

test('keeps the wizard and preview side by side in narrow embedded panes', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto('/');
  const controls = await page.locator('.right-sidebar').boundingBox();
  const preview = await page.locator('.main-workspace').boundingBox();
  if (!controls || !preview) throw new Error('Responsive workspace regions were not rendered.');
  expect(preview.x).toBeGreaterThan(controls.x);
  expect(controls.width).toBeCloseTo(360, 0);
  expect(preview.width).toBeCloseTo(360, 0);
  expect(preview.y).toBeCloseTo(controls.y, 0);
  await expect(page.locator('.workflow-nav ol')).toHaveCSS('display', 'flex');
});

test('mirrors the preview toggle corners for Hebrew RTL', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'עב' }).click();

  const modelButton = page.getByRole('button', { name: 'מודל תלת־ממדי' });
  const partsButton = page.getByRole('button', { name: 'חלקים דו־ממדיים' });
  await expect(modelButton).toHaveCSS('border-top-right-radius', '4px');
  await expect(modelButton).toHaveCSS('border-top-left-radius', '0px');
  await expect(partsButton).toHaveCSS('border-top-left-radius', '4px');
  await expect(partsButton).toHaveCSS('border-top-right-radius', '0px');
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
  await reachImportStep(page);
  await page.getByLabel('Choose STL model').setInputFiles({
    name: 'tetrahedron.stl',
    mimeType: 'model/stl',
    buffer: Buffer.from(tetrahedronStl),
  });

  await expect(page.getByRole('heading', { name: 'Model inspection' })).toBeVisible();
  await expect(page.getByText('STL imported and inspected.')).toBeVisible();
  await expect(page.getByText('10 mm', { exact: true })).toBeVisible();
  await expect(page.getByText('20 mm', { exact: true })).toBeVisible();
  await expect(page.getByText('30 mm', { exact: true })).toBeVisible();

  await page.getByLabel('Longest dimension').fill('60');
  await page.getByLabel('Longest dimension').press('Enter');
  await expect(page.getByText('40 mm', { exact: true })).toBeVisible();
  await expect(page.getByText('60 mm', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Around X' }).click();
  await expect(page.getByText('Height (Y)').locator('..')).toContainText('60 mm');
  await expect(page.getByText('Length / depth (Z)').locator('..')).toContainText('40 mm');
});

test('starts a configurable folding form from an illustrated template', async ({ page }) => {
  await page.goto('/');
  await reachImportStep(page, 'Folding template');

  await page.getByRole('button', { name: 'Create from template' }).click();
  await expect(page.locator('svg.template-choice-icon')).toHaveCount(7);
  await page.getByRole('button', { name: 'Profile sleeve' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByLabel('Template family')).toHaveValue('sleeve');
  await expect(page.getByLabel('Width (X)')).toHaveValue('80');
  await expect(page.getByLabel('Length / depth (Z)')).toHaveValue('60');
  await expect(page.getByLabel('Height (Y)')).toHaveValue('40');
  await expect(page.getByLabel('Connection method')).toHaveValue('glue');
});

test('Simple panel construction skips source, Inspect, and Arrange and generates in place', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Simple' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: 'Panel construction' }).check();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Step 3 / 4')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Panel construction' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Import or create/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Inspect/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Arrange/ })).toHaveCount(0);

  await page.getByRole('button', { name: '2D parts' }).click();
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Panel construction' })).toBeVisible();
  await expect(page.getByRole('button', { name: '2D parts' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  await page.getByRole('button', { name: 'Regenerate', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Panel construction' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Fabrication output' })).toBeVisible();
});

test('Simple warnings open the issue drawer and a blocking generation error inserts Inspect', async ({
  page,
}) => {
  await page.goto('/');
  await reachImportStep(page, 'Stacked slices', 'standard');
  await page.getByLabel('Choose STL model').setInputFiles({
    name: 'open.stl',
    mimeType: 'model/stl',
    buffer: Buffer.from(openTriangleStl),
  });
  await expect(page.getByText('STL imported and inspected.')).toBeVisible();

  const issueBadge = page.getByRole('button', { name: /notice/ });
  await expect(issueBadge).toBeVisible();
  await issueBadge.click();
  await expect(page.getByRole('dialog', { name: 'Checks & warnings' })).toBeVisible();
  await expect(page.getByText('OPEN_MESH')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review errors' })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Inspect/ })).toBeVisible();
  await page.getByRole('button', { name: 'Review errors' }).click();
  await expect(page.getByRole('heading', { name: 'Inspect generated parts' })).toBeVisible();
});

test('generates, arranges, rotates, and exports a selected fabrication sheet', async ({ page }) => {
  await page.goto('/');
  await reachConfigureStep(page, 'Stacked slices', true);

  await expect(page.getByLabel('Slice axis')).toHaveValue('z');
  await expect(page.getByLabel('Slice spacing')).toHaveValue('10');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText(/4 fabrication parts generated/)).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('4 of 4 parts placed · 1 sheet', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /A3/ }).click();
  await expect(page.getByLabel('Sheet width')).toHaveValue('297');
  await expect(page.getByLabel('Sheet height')).toHaveValue('420');

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

  const preservedX = await page.getByLabel('Position X').inputValue();
  await page.getByRole('button', { name: 'Simple' }).click();
  await expect(page.getByRole('heading', { name: 'Fabrication output' })).toBeVisible();
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.getByRole('button', { name: /Inspect/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByLabel('Position X')).toHaveValue(preservedX);
  await expect(page.getByLabel('Rotation')).toHaveValue('90');

  await page.getByLabel('Sheet width').fill('60');
  await page.getByLabel('Sheet height').fill('60');
  await page.getByRole('button', { name: 'Arrange all parts' }).click();
  await expect(page.getByText('4 of 4 parts placed · 4 sheets', { exact: true })).toBeVisible();
  await page.getByLabel('Active sheet').selectOption({ index: 1 });
  await expect(page.getByRole('button', { name: 'Slice Z2 on sheet' })).toBeVisible();

  await page.getByRole('button', { name: 'Next' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download active sheet SVG' }).click();
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
  await reachConfigureStep(page, 'Interlocking slices', true);

  await expect(page.getByRole('heading', { name: 'Interlocking slices' })).toBeVisible();
  await expect(page.getByLabel('Family A axis')).toHaveValue('x');
  await expect(page.getByLabel('Family B axis')).toHaveValue('y');
  await expect(page.getByLabel('Family A spacing')).toHaveValue('20');
  await expect(page.getByLabel('Family B spacing')).toHaveValue('20');
  await page.getByLabel('Slot clearance').fill('0.25');
  await expect(page.getByText('0.6 mm', { exact: true })).toBeVisible();
  await page.getByLabel('Reverse all slot directions').check();

  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText(/4 fabrication parts generated/)).toBeVisible();
  await expect(page.getByText('Family A', { exact: true })).toBeVisible();
  await expect(page.getByText('Family B', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('4 of 4 parts placed · 1 sheet', { exact: true })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Family A · Slice X1 on sheet' })).toBeVisible();
  await expect(page.locator('path[data-slot="true"]')).toHaveCount(8);

  await page.getByRole('button', { name: 'Next' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download active sheet SVG' }).click();
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

test('creates a standalone folding template, previews its net, and exports operation layers', async ({
  page,
}) => {
  await page.goto('/');
  await reachConfigureStep(page, 'Folding template');
  await expect(page.getByRole('heading', { name: 'Parametric folding template' })).toBeVisible();
  await expect(page.getByLabel('Template family')).toHaveValue('open-box');
  await page.getByLabel('Width (X)').fill('80');
  await page.getByLabel('Length / depth (Z)').fill('60');
  await page.getByLabel('Height (Y)').fill('40');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Parametric template', { exact: true })).toBeVisible();
  await expect(page.getByTestId('assembly-inspection')).toContainText('8/8 resolved');
  await expect(page.getByTestId('assembly-inspection')).toContainText('Receiver alignment0.000 mm');
  await expect(page.getByTestId('assembly-inspection')).toContainText(
    'fold 4 hinges, then close 4 seams',
  );

  await page.getByRole('button', { name: '2D parts' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'Open box net on sheet' })).toBeVisible();
  await expect(page.locator('path[data-panel-id]')).not.toHaveCount(0);
  await expect(page.locator('path[data-edge-id]')).not.toHaveCount(0);
  await expect(page.locator('path[data-tab-id]')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Next' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download active sheet SVG' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const svg = Buffer.concat(chunks).toString('utf8');
  expect(svg).toContain('&quot;mode&quot;:&quot;fold-template&quot;');
  expect(svg).toContain('id="operation-cut"');
  expect(svg).toContain('id="operation-score"');
  expect(svg).toContain('id="operation-valley-fold"');
  expect(svg).not.toContain('receiver-slit');
  expect(svg).toContain('data-panel-id=');
  expect(svg).toContain('data-edge-id=');
  expect(svg).toContain('data-tab-id=');
  expect(svg).toContain('data-entity-id=');
});

test('imports a low-poly STL, unfolds it, edits seams, previews folding, and exports the net', async ({
  page,
}) => {
  await page.goto('/');
  await reachConfigureStep(page, 'Unfold a 3D model', true);
  await expect(page.getByRole('heading', { name: 'Mesh unfolding' })).toBeVisible();
  await expect(page.getByText(/does not repair meshes/)).toBeVisible();
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText(/1 fabrication part generated/)).toBeVisible();
  await expect(page.getByText('Ghosted source', { exact: true })).toBeVisible();
  await expect(page.getByText('Fold preview', { exact: true })).toBeVisible();
  await page.getByLabel('Folding preview').fill('65');
  await expect(page.getByText('65%')).toBeVisible();

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: /Unfolded net 1 on sheet/ })).toBeVisible();
  await expect(page.locator('path[data-panel-id^="unfold-face-"]')).not.toHaveCount(0);
  await expect(page.locator('path[data-tab-id^="unfold-tab-"]')).not.toHaveCount(0);

  await page.getByRole('button', { name: 'Next' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download active sheet SVG' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const svg = Buffer.concat(chunks).toString('utf8');
  expect(svg).toContain('&quot;mode&quot;:&quot;mesh-unfold&quot;');
  expect(svg).toContain('&quot;projectFormatVersion&quot;:6');
  expect(svg).toContain('data-panel-id="unfold-face-');
  expect(svg).toContain('data-edge-id="unfold-edge-');
  expect(svg).toContain('data-tab-id="unfold-tab-');
  expect(svg).toContain('>T1</text>');
});

test('builds a tab-slot panel enclosure, previews it, and exports labelled joint geometry', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto('/');
  await reachConfigureStep(page, 'Panel construction');
  await page.getByLabel('Material profile').selectOption('plywood-3mm');

  await expect(page.getByRole('heading', { name: 'Panel construction' })).toBeVisible();
  await expect(page.getByLabel('Inside width (mm)')).toHaveValue('80');
  await page.getByLabel('Edge joint').selectOption('tab-slot');
  await page.getByLabel('Slot clearance (mm)').fill('0.2');
  await page.getByLabel('Dividers across width').fill('2');
  await page.getByLabel('Dividers across depth').fill('2');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText(/9 fabrication parts generated/)).toBeVisible();
  await expect(page.getByText('Assembled panel kit', { exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('The 3D preview stopped rendering.')).toHaveCount(0);
  expect(consoleErrors).toEqual([]);

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'Base panel on sheet' })).toBeVisible();
  await expect(page.locator('path[data-contour-role="hole"]')).not.toHaveCount(0);
  await expect(page.locator('path[data-edge-id^="construction-joint-"]')).not.toHaveCount(0);

  await page.getByRole('button', { name: 'Next' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download active sheet SVG' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const svg = Buffer.concat(chunks).toString('utf8');
  expect(svg).toContain('&quot;mode&quot;:&quot;panel-construction&quot;');
  expect(svg).toContain('&quot;projectFormatVersion&quot;:6');
  expect(svg).toContain('data-panel-id="construction-panel-');
  expect(svg).toContain('data-edge-id="construction-joint-');
  expect(svg).toContain('divider-1-base-slot');
  expect(svg).toContain('-side-slot-');
  expect(svg).toContain('data-contour-role="hole"');
  expect(svg).toContain('>J1</text>');
});

test('prepares kerf, perforations, labels, registration marks, styles, and PDF output', async ({
  page,
}) => {
  await page.goto('/');
  await reachConfigureStep(page, 'Folding template');
  await generateAndReachExport(page);

  await page.getByLabel('Kerf compensation').selectOption('material');
  await expect(
    page.getByLabel('Fabrication output').getByText('0.1 mm', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Fold-line output').selectOption('perforate');
  await page.getByLabel('Dash length').fill('3');
  await page.getByLabel('Gap length').fill('1');
  await page.getByLabel('Registration marks').check();
  await page.getByLabel('Label size').fill('4');
  await expect(page.getByText('Operation styles', { exact: true })).toBeVisible();
  await page.getByLabel('Cut colour').fill('#00aa11');
  await page.getByLabel('Cut width').fill('0.2');

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
  expect(svg).toContain('&quot;projectFormatVersion&quot;:6');
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
