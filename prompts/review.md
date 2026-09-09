# Job card: REVIEW

This reference automates only the mechanical half of REVIEW
(`harness/checks.ts`) — the half enforcement actually depends on. A fuller
system also gives a model this job card to read the diff plus the mechanical
findings and add advisory commentary a human will see later: does the test
read naturally, is there a better locator strategy, does the migration lose
any nuance the assertion-parity count can't detect on its own.

That model pass is deliberately never allowed to overrule a scripted
finding. The reasoning: an LLM asked to review will always find *something*
to say, and if that something could block the run, the run would never
converge. The one thing that must never happen is what happened once in the
project this repo is based on: a scripted check that was *wrong* (matched
text inside a comment), with no human escape hatch left once "mechanical
findings are final" became policy. The fix was not to weaken the policy —
it was to make the check correct. See `gotchas.md`.

If you add a model pass here, its output is advisory notes only. It never
gates CLOSE.
