# Job card: CLOSE

No model runs this phase. CLOSE's job is to compute the evidence contract
(`harness/evidence.ts`) and, only if it's complete, commit. There is nothing
here for a model to decide — a migration is done because a hash of a real
report exists and every source assertion is accounted for, not because
anyone asserts it is.

`scripts/break-it.ts` is the demonstration: delete the report CLOSE would
hash, and watch it refuse to recompute evidence for a "done" unit.
