# Job card: RETROSPECTIVE

In this reference, RETROSPECTIVE is a script (`harness/retrospective.ts`)
that looks at every dropped or blocked unit from the run and appends a
candidate line to `gotchas-proposed.md`. A fuller system gives a model this
job card instead, asking it to read the failure signatures across the whole
run and propose *patterns*, not just per-unit restatements — "three separate
units failed on the same stale-locator shape" is a more useful gotcha than
three near-duplicate entries.

Either way, the output of this phase is always a proposal. A human decides
what graduates from `gotchas-proposed.md` into `gotchas.md`, and separately,
what graduates from an advisory gotcha into a scripted principle after it's
been seen enough times. Nothing here writes `gotchas.md` or `principles.md`
directly — that step is never automatic.
