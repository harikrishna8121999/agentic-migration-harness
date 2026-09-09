describe("Task list", () => {
  it("filters tasks by status", async () => {
    // Every test in this suite runs in its own isolated browser session —
    // there is no shared login step in a beforeEach. Log in first.
    await browser.get("http://localhost:4000/login");
    await element(by.id("username")).sendKeys("demo");
    await element(by.id("password")).sendKeys("demo123");
    await element(by.id("login-submit")).click();

    await browser.get("http://localhost:4000/tasks");
    await element(by.id("status-filter")).element(by.cssContainingText("option", "Done")).click();

    // assert: hides-open-tasks-when-filtered-to-done
    const items = element.all(by.css("#task-list li"));
    expect(await items.count()).toEqual(1);
  });
});
