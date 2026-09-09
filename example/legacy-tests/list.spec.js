describe("Task list", () => {
  it("filters tasks by status", async () => {
    await browser.get("http://localhost:4000/tasks");
    await element(by.id("status-filter")).element(by.cssContainingText("option", "Done")).click();

    // assert: hides-open-tasks-when-filtered-to-done
    const items = element.all(by.css("#task-list li"));
    expect(await items.count()).toEqual(1);
  });
});
