import { test, expect } from '@playwright/test';

test('logs in with valid credentials [migrated:logs_in_with_valid_credentials]', async ({ page }) => {
  await page.goto('http://localhost:4000/login');
  await page.locator('#username').fill('demo');
  await page.locator('#password').fill('demo123');
  await page.locator('#login-submit').click();

  // covers logs_in_with_valid_credentials:redirects-to-tasks
  await expect(page).toHaveURL(/\/tasks/);
});
