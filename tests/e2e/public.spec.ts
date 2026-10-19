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
test('landing page has honest CTAs and readable original artwork', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('osu! Chinese League Rookie');
  await expect(page.getByText('Awaiting announcement')).toBeVisible();
  await page.getByRole('link', { name: 'Learn more', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Find your rhythm/ })).toBeVisible();
  await page.goto('/');
  await page.screenshot({ path: `/private/tmp/oclr-home-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' });
  await page.getByRole('link', { name: 'View tournament', exact: false }).first().click();
  await expect(page).toHaveURL(/\/tournaments$/);
});
