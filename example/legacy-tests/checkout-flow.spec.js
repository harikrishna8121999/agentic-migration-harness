describe("Checkout", () => {
  it("completes a multi-step checkout flow", async () => {
    await browser.get("http://localhost:4000/checkout/step1");
    await element(by.id("item-quantity")).element(by.cssContainingText("option", "2")).click();
    await element(by.id("checkout-next")).click();

    await element(by.id("shipping-address")).sendKeys("123 Example St");
    await element(by.id("checkout-next")).click();

    // assert: confirm-page-shows-order-summary
    expect(await element(by.id("checkout-summary")).getText()).toContain("Quantity: 2");

    await element(by.id("checkout-submit")).click();

    // assert: shows-order-confirmation-banner
    expect(await element(by.id("checkout-confirmation")).getText()).toEqual("Order placed!");

    // assert: sends-confirmation-email
    // (the original app emailed a receipt here — the demo app has no email
    // feature, so the migrated test cannot cover this one)
    expect(await getLastSentEmailSubject()).toEqual("Your order confirmation");
  });
});
