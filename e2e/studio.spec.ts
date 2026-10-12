import { expect, test } from '@playwright/test';

test('creates and resizes a template with synchronized previews, undo and SVG export', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Create', exact: true })).toBeVisible();
  await expect(page.locator('.template-card')).toHaveCount(7);
  await page.getByRole('button', { name: 'Create by dimensions', exact: true }).click();
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  await page.getByRole('button', { name: 'Together', exact: true }).click();
  await expect(page.locator('.dual-preview canvas')).toBeVisible();
  await expect(page.locator('.dual-preview .sheet-part').first()).toBeVisible();
  const width = page.getByRole('spinbutton', { name: 'Width (X)', exact: true });
  await width.fill('105');
  await expect(page.locator('.studio-bottom-bar')).toContainText('Draft preview');
  await expect(page.locator('path[data-operation="cut"]').first()).toHaveAttribute('d', /L 150 5/);
  await expect(page.getByRole('button', { name: 'Manufacture', exact: true })).toBeDisabled();
  await width.press('Enter');
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  await expect(width).toHaveValue('105');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(width).toHaveValue('80');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(width).toHaveValue('105');
  await page.getByRole('button', { name: 'Manufacture', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export draft SVG', exact: true }).click();
  const stream = await (await downloaded).createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const svg = Buffer.concat(chunks).toString('utf8');
  expect(svg).toContain('width="');
  expect(svg).toContain('mm"');
  expect(svg).toContain('operation-cut');
  await page.reload();
  await expect(page.locator('[data-workflow="studio"]')).toBeVisible();
});

test('provides Hebrew RTL dimensions with LTR numeric axes and no unsupported FEFCO entries', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'עב', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('searchbox', { name: 'חיפוש לפי שם, קוד או קטגוריה' }).fill('FEFCO');
  await expect(page.locator('.template-card')).toHaveCount(0);
  await page.getByRole('searchbox').fill('קופסה פתוחה');
  await expect(page.locator('.template-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'בחירת תבנית: קופסה פתוחה', exact: true }).click();
  await expect(page.locator('.studio-bottom-bar')).toContainText('הגאומטריה עדכנית');
  const width = page.getByRole('spinbutton', { name: 'רוחב (X)', exact: true });
  await expect(width).toHaveAttribute('dir', 'ltr');
  await width.fill('95');
  await width.press('Enter');
  await expect(page.locator('.studio-bottom-bar')).toContainText('הגאומטריה עדכנית');
  await page.getByRole('button', { name: 'חלקים דו־ממדיים', exact: true }).click();
  await expect(page.locator('.sheet-part').first()).toBeVisible();
  await page.getByRole('button', { name: 'הכנה לחיתוך', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ייצוא SVG ראשוני' })).toBeEnabled();
});

test('retains valid geometry through invalid drafts and restores named projects', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create by dimensions', exact: true }).click();
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  const width = page.getByRole('spinbutton', { name: 'Width (X)', exact: true });
  await width.fill('-1');
  await width.press('Enter');
  await expect(width).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Manufacture', exact: true })).toBeDisabled();
  await width.press('Escape');
  await expect(width).toHaveValue('80');
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Projects' });
  await drawer.getByRole('textbox', { name: 'Project name', exact: true }).fill('Saved carton');
  await drawer.getByRole('button', { name: 'Save a named copy', exact: true }).click();
  await expect(
    drawer.locator('.saved-project-row').filter({ hasText: 'Saved carton' }),
  ).toHaveCount(1);
  await drawer.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await drawer
    .locator('.saved-project-row')
    .filter({ hasText: 'Saved carton' })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue(
    'Saved carton',
  );
  await expect(width).toHaveValue('80');
  await expect(page.locator('.studio-bottom-bar')).toContainText('Current geometry');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(width).toBeVisible();
  await page
    .locator('.studio-inspector')
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await expect(width).toBeHidden();
  await page
    .locator('.studio-preview-actions')
    .getByRole('button', { name: 'Design', exact: true })
    .click();
  await expect(width).toBeVisible();
});
