# A finished task, unedited

These three files are copied verbatim from a real `npm run dry-run` — nothing
here was hand-written to look tidy. The paths inside `case-file.json` (e.g.
`tasks/reports/...`) are where these files lived during that run, not where
they sit in this folder; they're left as-is rather than rewritten, because
the point is to show the real output, not a cleaned-up mockup of it.

- **`case-file.json`** — the paperwork for one unit,
  `rejects_an_invalid_password`, migrated from
  `example/legacy-tests/login.spec.js`. Read `attempts` top to bottom: the
  first `verify` fails ("locator resolved to 0 elements" — the naively
  translated selector didn't match the running app), IMPLEMENT runs again,
  and the second `verify` and the `review` both pass. That's a converging
  retry, the whole reason `harness/convergence.ts` exists.
- **`evidence-report.json`** — the file `case-file.json`'s
  `evidence.reportHash` is a sha256 of. In a real run this would be a full
  Playwright JSON report; in dry-run mode it's a small fixture, but it's a
  real file on disk either way — that's what `scripts/break-it.ts` deletes
  to prove the hash can't be faked.
- **`migrated-test.spec.ts`** — the file IMPLEMENT actually wrote. Note the
  `[migrated:rejects_an_invalid_password]` tag in the test title (checked by
  `harness/checks.ts`, `tag-present-once`) and the
  `// covers rejects_an_invalid_password:shows-error-banner` comment (checked
  by `harness/evidence.ts`, `computeAssertionParity`).

Reproduce this exact shape yourself: `npm run dry-run`, then look at
whichever file under `tasks/` reached `"status": "done"`.
