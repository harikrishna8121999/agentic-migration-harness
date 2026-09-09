# Principles

Short, on purpose. Every rule below is marked with how it's enforced —
`scripted` means a check in `harness/checks.ts` or `harness/gates.ts` will
stop the run if it's violated; `advisory` means it's shown to the model and
to a human reviewer, but never blocks CLOSE on its own.

A scripted rule earns that status by being provably correct against the
exact thing it inspects. If a check can't clear that bar, it stays advisory
— see `gotchas.md` for the incident that made this policy non-negotiable.

1. **[scripted]** Every migrated test's title contains its unit tag
   (`[migrated:<id>]`) exactly once. The machine validates this; it does not
   trust the model's report that the tag is there.
2. **[scripted]** No `test.only(...)` is left in a file the run produces —
   checked against the source with comments stripped, so a mention inside a
   comment can never trip this.
3. **[scripted]** Every source assertion is accounted for at CLOSE: covered
   by a `// covers <id>` line in the target, or explicitly
   `// dropped <id>: <reason>`. An assertion with neither is a gap, and the
   run reports it as one — never silently.
4. **[advisory]** Confirm a migrated locator against the running app before
   writing the assertion. Do not port a source selector faithfully just
   because it once worked.
5. **[advisory]** Do not port manual waits or sleeps. Prefer the target
   framework's built-in auto-waiting assertions.
6. **[advisory]** A generic locator string (e.g. matching visible text like
   "OK" or "Submit") is a smell worth a second look, not a defect on its own.

Repo-wide only. Adapter-specific principles live with the adapter
(`adapters/protractor-playwright/adapter.ts`, `principles()`), and are
merged in for the model's context — see `harness/llm.ts`.
