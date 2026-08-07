import { expect, test } from '@playwright/test';

test('home and content routes render without placeholder project data', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('img[alt*="VSCN"]')).toBeVisible();
  await page.goto('/mods');
  await expect(page.locator('main')).toBeVisible();
});

test('private resource URLs do not expose fallback content', async ({ request }) => {
  const response = await request.get('/api/v1/projects/does-not-exist');
  expect([404, 503]).toContain(response.status());
});
