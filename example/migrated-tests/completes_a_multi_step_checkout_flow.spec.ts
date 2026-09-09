import { test, expect } from '@playwright/test';

test('completes a multi-step checkout flow [migrated:completes_a_multi_step_checkout_flow]', async ({ page }) => {
  // Every test in this suite runs in its own isolated browser session —
  // there is no shared login step in a beforeEach. Log in first.
  await page.goto('http://localhost:4000/login');
  await page.locator('#username').fill('demo');
  await page.locator('#password').fill('demo123');
  await page.locator('#login-submit').click();

  await page.goto('http://localhost:4000/checkout/step1');
  await page.locator('#item-quantity').selectOption({ label: '2' });
  await page.locator('#checkout-next').click();

  await page.locator('#shipping-address').fill('123 Example St');
  await page.locator('#checkout-next').click();

  // covers completes_a_multi_step_checkout_flow:confirm-page-shows-order-summary
  await expect(page.locator('#checkout-summary')).toContainText('Quantity: 2');

  await page.locator('#checkout-submit').click();

  // covers completes_a_multi_step_checkout_flow:shows-order-confirmation-banner
  await expect(page.locator('#checkout-confirmation')).toHaveText('Order placed!');

  // dropped completes_a_multi_step_checkout_flow:sends-confirmation-email: the demo app has no email feature, so there is no confirmation email to inspect
});
