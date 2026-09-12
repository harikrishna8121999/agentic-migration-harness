# agent-migration-harness

📝 [Read the blog post](https://dev.to/harikrishnavshetty/i-built-a-hands-free-ai-harness-for-migrating-legacy-tests-3pab)

A reference harness that migrates a legacy browser-test suite to Playwright,
one test at a time, with mechanical proof that the migrated test really
passes. The model does the work inside each phase; code — never the model —
decides what happens between them: retries, drops, commits, and the final
verdict.

This is a generic reimplementation of a pattern built for an internal
project, illustrated here with a small bundled example (a Protractor suite
migrating to Playwright, against a demo app also bundled in this repo).
Nothing here needs an account, a VPN, or a secret.

This repo's own git history is a real run, not a mockup: `git log` shows a
model (via OpenRouter) migrating all four example tests, two of them timing
out on the first attempt for a genuine reason (a missing login precondition
in the source suite — see `gotchas.md`), a source fix, and a clean re-run.
`example/migrated-tests/` is that run's actual output, committed as-is. A
fresh run of your own will attempt every unit again from scratch — case
files under `tasks/` are gitignored on purpose (see "Layout" below), so only
git commits, not the harness's own bookkeeping, persist across a clone.

## 60-second dry run

No API key, no browser. This walks the entire loop against real files and
prints every gate:

```
npm install
npm run dry-run
```

You'll see four units run through PREFLIGHT → IMPLEMENT → VERIFY → REVIEW →
CLOSE: one passes cleanly, one fails once and recovers on retry, one thrashes
and gets dropped (loudly, with a reason), and one fails REVIEW's scripted
check before passing on a second attempt. Only IMPLEMENT and VERIFY are
faked in dry-run mode (no model, no browser) — everything else (the
mechanical checks, the evidence hashing, the assertion-parity count, the git
commit) is the real code a real run uses.

## Read a finished case file first

Before running anything, look at
[`examples/finished-task/`](examples/finished-task/) — a case file committed
straight from a real dry run. It's the actual paperwork the machine
produces: the unit, every attempt, and the evidence that let CLOSE commit it.
Reading it costs nothing and is half the point of this repo.

## Real run

Needs a model API key and Playwright's browsers. Copy `.env.example` to
`.env` and fill in exactly one provider — either `ANTHROPIC_API_KEY`, or
`OPENROUTER_API_KEY` plus `HARNESS_MODEL` (an explicit
`"<provider>/<model>"` slug, since OpenRouter proxies many models — see
[openrouter.ai/models](https://openrouter.ai/models)). This is the one part
of the harness that talks to a specific model backend
(`harness/llm.ts`) — everything else is identical regardless of which
provider you pick, which is the whole point of keeping the harness
engine-agnostic.

```
cp .env.example .env    # then edit .env
npx playwright install --with-deps chromium
npm run demo-app &        # serves the example app on :4000
npm run harness            # no --dry-run: IMPLEMENT calls the model, VERIFY launches a real browser
```

## Break it

The single most convincing thing in this repo. Run the dry run, then:

```
npm run break-it
```

It deletes the evidence report behind a "done" unit and asks CLOSE to
recompute that evidence anyway. There's no marker file to fake — watch it
refuse.

## Layout

```
harness/          the engine: loop, gates, checks, evidence, case files, git
adapters/          the one seam this repo implements (Protractor → Playwright)
prompts/           one job card per phase
playbooks/         one recipe per operation
principles.md      short; each rule marked scripted or advisory
gotchas.md         seeded landmines, curated by hand
scripts/           break-it.ts — the mechanical demo, no model involved
example/           the demo app and the legacy suite it migrates from
examples/          a committed, finished case file
tasks/             generated at runtime — case files and evidence reports land here
```

The four layers (machine / instructions / checks / paperwork) are kept in
physically separate directories on purpose — the layering is the lesson.

## The adapter seam

`harness/adapter.ts` defines the whole interface a new source/target pair
needs: enumerate units, verify one unit, declare principles, and produce the
exact command that reproduces a unit's evidence. Only one adapter ships
here. The interface is documented rather than wrapped in a plugin framework
— a second adapter should prove the seam is real; building for an audience
of one adapter would make the abstraction hollow.

## What's simplified here, on purpose

This is teaching material, not a feature-complete port of the original
system. Left out or reduced: per-phase model routing, rate-limit handling,
usage telemetry, ticket-system integration, and live locator confirmation
during IMPLEMENT (the original explored the running app before writing an
assertion; this reference's real-run IMPLEMENT is a single model call
without that exploration loop — see `principles.md` rule 4 for where that
would plug back in).

## Concepts index

Each idea below is a design decision in this code, not just a paragraph.

| Idea | Where it lives |
|---|---|
| Ground truth instead of evals — the old test is the spec | `adapters/protractor-playwright/adapter.ts`, `enumerateUnits` (reads the source as text, never executes it) |
| Unit of delegation: one test, one verdict | `harness/engine.ts`, `runUnit` |
| The grep-verifiable tag, machine-validated | `harness/checks.ts`, `tag-present-once` |
| Working context vs. inter-phase memory vs. durable progress vs. learned memory | `harness/llm.ts` (working context), `harness/caseFile.ts` (inter-phase), `harness/git.ts` (durable), `gotchas.md` + `harness/retrospective.ts` (learned) |
| Git as authoritative state, with a human escape hatch | `harness/caseFile.ts`, `reconcileWithGit` |
| Converging vs. thrashing retries | `harness/convergence.ts` |
| A scripted check must be correct, or it must be advisory | `harness/checks.ts`, `gotchas.md` (the comment-matching incident) |
| The evidence contract — real report hash, real assertion parity | `harness/evidence.ts`, `scripts/break-it.ts` |
| Every gate failure carries its remediation command | `harness/gates.ts` |

[A companion blog post](https://dev.to/harikrishnavshetty/i-built-a-hands-free-ai-harness-for-migrating-legacy-tests-3pab)
walks through why each of these decisions was made, including the ones that
reversed an earlier approach.
