# Gotchas

Landmines, seeded from a real project's history and kept short by hand.
`harness/retrospective.ts` proposes new candidates into
`gotchas-proposed.md` after a run — a human decides what graduates into this
file. Nothing is added here automatically; nothing here becomes a scripted
check without first being seen enough times to be sure it's worth the
enforcement cost (see `principles.md` rule 1–3 for the ones that graduated).

- **A duplicate-code or pattern check that scans raw source text will match
  inside comments.** One incident sent a correct, passing change back
  through a full rework round because a duplicated-text check matched a
  comment, not code. It was "fixed" by editing the comment so the pattern
  would stop matching — the actual code was never wrong. Any scripted text
  check in this repo strips comments first (`harness/checks.ts`,
  `stripComments`).

- **A flat retry cap can't tell "one fix away from green" from "looping
  forever."** Both look identical to a counter. Diff the failure signature
  between attempts instead (`harness/convergence.ts`) — a new signature is
  progress, an identical one is thrash.

- **Re-deriving pass/fail from a tool's exit code misses states the tool
  itself considers a failure.** Use the runner's own authoritative verdict
  field (Playwright's `stats.unexpected`, not the process exit code) — see
  `adapters/protractor-playwright/adapter.ts`, `verifyUnit`.

- **A snapshot or report file written by the test runner's own setup step
  can be overwritten or deleted before the next attempt reads it.** If a
  retry needs to inspect the previous attempt's failure artifact, copy it
  out immediately after the run, before anything else touches that
  directory.

- **An "authoritative git state" design can make terminal states permanent**
  — a human who fixes the underlying blocker for a dropped unit still needs
  a way back in. Newest-commit-wins is not enough on its own; there has to
  be an explicit reopen record the human can add (`harness/caseFile.ts`,
  `reconcileWithGit`).

- **A source test that relies on session state established somewhere else
  (a shared login in a `beforeEach`, an earlier test in the same run) will
  migrate "correctly" and then hang.** The first real run against this
  repo's own example did exactly this: two source tests (`list.spec.js`,
  `checkout-flow.spec.js`) navigated straight to a page that requires a
  session, with no login step of their own — a pattern that works under a
  legacy runner sharing one browser/session across a whole suite. The
  migrated Playwright test was a faithful, correct translation of what the
  source actually did, and it still failed: Playwright gives every test its
  own isolated browser context, so with no login step it hit a redirect to
  `/login` and then timed out waiting for a locator that was never going to
  appear. Nothing was wrong with the harness or the model's output — the
  source test was under-specifying its own precondition, relying on
  implicit state the migration had no way to see. Caught mechanically (two
  identical timeout signatures, thrash-detected, dropped loudly) rather than
  silently producing a flaky migrated test. Fix was at the source: make each
  test's login precondition explicit rather than assumed.
