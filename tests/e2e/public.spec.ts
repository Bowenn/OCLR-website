import { expect, test } from '@playwright/test';
test('shared navigation works at desktop and mobile widths', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('OCLR — osu! Chinese League Rookie');
  if (isMobile) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Tournaments' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tournament');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
