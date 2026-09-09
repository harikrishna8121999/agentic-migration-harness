# Playbook: repair from a failure snapshot, don't re-drive the flow

On a retry, the expensive mistake is manually re-walking the whole scenario
(navigate, log in, click through three screens) just to reach the step that
actually failed. The test itself is the cheapest way back to that state:

1. Run the failing test once, on purpose, to reproduce the failure.
2. Capture the runner's own failure artifact for that exact step — for
   Playwright, its trace or the page snapshot at the point of failure —
   rather than reasoning about the DOM from memory or from the old source.
3. Copy that artifact out immediately. Don't rely on it surviving to the
   next attempt: a test runner's own setup step can overwrite or delete it
   before anything else reads it (see `gotchas.md`).
4. Repair only the step the snapshot shows is wrong. Don't rewrite
   surrounding steps that were already passing.

This is why `harness/convergence.ts` compares failure *signatures* rather
than treating every failed attempt as a fresh unknown: a repaired single
step should produce a new signature (progress) or the same one (thrash),
and both are informative.
