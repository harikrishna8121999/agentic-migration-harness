import { test, expect } from "@playwright/test";

test("filters tasks by status [migrated:filters_tasks_by_status]", async ({ page }) => {
  // Every test in this suite runs in its own isolated browser session —
  // there is no shared login step in a beforeEach. Log in first.
  await page.goto("http://localhost:4000/login");
  await page.locator("#username").fill("demo");
  await page.locator("#password").fill("demo123");
  await page.locator("#login-submit").click();

  await page.goto("http://localhost:4000/tasks");
  await page.locator("#status-filter").selectOption({ label: "Done" });

  // covers filters_tasks_by_status:hides-open-tasks-when-filtered-to-done
  await expect(page.locator("#task-list li")).toHaveCount(1);
});
