# Playbook: migrate one test

The recipe IMPLEMENT follows for every unit, regardless of what the test
does:

1. Read the source test's body once. Identify: what page(s) it visits, what
   it interacts with, and what each assertion actually checks (not just
   what selector it uses).
2. For each interaction, prefer a Playwright locator built from role and
   accessible name over a translated CSS/XPath selector. A source selector
   that worked against the old app is not evidence it still matches the
   current one.
3. For each assertion, decide: covers or drops. A drop needs a real reason
   ("this feature doesn't exist in the demo app"), not a convenience reason
   ("this one is harder to port").
4. Embed the unit's tag in the test title exactly once. This is the only
   thing binding the machine's identity for this unit to the model's choice
   of title — see `harness/checks.ts`, `tag-present-once`.
5. Do not add a page object, helper module, or shared fixture unless the
   test already needs one to exist. A migration is reviewed one unit at a
   time; new shared infrastructure inside that diff is scope the reviewer
   didn't ask for.
