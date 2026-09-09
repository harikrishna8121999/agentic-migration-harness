# Job card: PREFLIGHT

No model runs this phase in this reference — it's entirely mechanical (see
`harness/gates.ts`). It's documented here anyway because in a fuller system
this is also where a model-assisted check could live: e.g. "does the target
repo already have a partial, hand-written migration for this unit that a
human is mid-way through? If so, stop and ask rather than overwrite it."

This reference keeps PREFLIGHT purely scripted on purpose: environment gates
(git present, target directory writable, credentials/browser available for
a real run) don't benefit from a model's judgment, and every gate here needs
to be either provably correct or not a gate — the same rule as REVIEW.
