# Job card: VERIFY

No model runs this phase. VERIFY's entire job is to run the real test suite
and report the runner's own verdict — that's exactly the kind of decision
that must never be a model's claim (see `adapters/*/adapter.ts`,
`verifyUnit`). Adding a model here would reintroduce the thing this whole
design exists to avoid: "it passes" as a sentence instead of a fact.

Where a model *is* useful adjacent to VERIFY is live locator confirmation
during IMPLEMENT, before the test is even run — see `playbooks/` and
principle 4 in `principles.md`.
