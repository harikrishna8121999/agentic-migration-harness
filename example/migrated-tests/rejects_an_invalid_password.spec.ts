import { test, expect } from '@playwright/test';

test('rejects an invalid password [migrated:rejects_an_invalid_password]', async ({ page }) => {
  await page.goto('http://localhost:4000/login');
  await page.locator('#username').fill('demo');
  await page.locator('#password').fill('not-the-password');
  await page.locator('#login-submit').click();

  // covers rejects_an_invalid_password:shows-error-banner
  await expect(page.locator('#error-banner')).toHaveText('Invalid username or password');
});
