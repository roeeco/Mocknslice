import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';

// Run against a separately started Vite server. Default output stays ignored;
// copying reviewed captures into docs is an explicit PR 0 operation.
const destination = path.resolve(process.argv[2] ?? 'test-results/upgrade-baseline');
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
  args: ['--enable-unsafe-swiftshader'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.getByRole('heading', { name: 'Start a project' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: path.join(destination, 'en-start.png'), fullPage: true });
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('radio', { name: 'Panel construction', exact: true }).check();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Panel preset').selectOption('sorting-tray');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page.locator('.generation-status')).toContainText('Current');
  await page.screenshot({ path: path.join(destination, 'en-panel-3d.png'), fullPage: true });
  await page.getByRole('button', { name: '2D parts', exact: true }).click();
  await expect(page.locator('path[data-contour-role="outer"]').first()).toBeVisible();
  await page.screenshot({ path: path.join(destination, 'en-panel-2d.png'), fullPage: true });
  await page.getByRole('button', { name: 'עב', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByLabel('הגדרה מוכנה ללוחות')).toHaveValue('sorting-tray');
  await page.screenshot({ path: path.join(destination, 'he-panel-rtl.png'), fullPage: true });
  expect(errors).toEqual([]);
  console.log(`Saved four baseline screenshots to ${destination}`);
} finally {
  await browser.close();
}
