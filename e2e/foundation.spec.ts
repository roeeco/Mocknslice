import { expect, test } from '@playwright/test';

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
