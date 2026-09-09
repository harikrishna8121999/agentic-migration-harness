// Legacy Protractor suite. Read as text by the harness (see
// adapters/protractor-playwright/adapter.ts, enumerateUnits) — never
// executed. This file is the specification for the migrated tests, not
// something the pipeline runs.

describe("Login", () => {
  it("logs in with valid credentials", async () => {
    await browser.get("http://localhost:4000/login");
    await element(by.id("username")).sendKeys("demo");
    await element(by.id("password")).sendKeys("demo123");
    await element(by.id("login-submit")).click();

    // assert: redirects-to-tasks
    expect(await browser.getCurrentUrl()).toContain("/tasks");
  });

  it("rejects an invalid password", async () => {
    await browser.get("http://localhost:4000/login");
    await element(by.id("username")).sendKeys("demo");
    await element(by.id("password")).sendKeys("not-the-password");
    await element(by.id("login-submit")).click();

    // assert: shows-error-banner
    expect(await element(by.id("error-banner")).getText()).toEqual("Invalid username or password");
  });
});
