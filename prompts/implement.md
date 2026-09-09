# Job card: IMPLEMENT

You are migrating exactly one test method from a legacy Protractor suite to
Playwright. You will not see any other unit, any conversation history, or
any prior attempt's reasoning — only this job card, the principles,
gotchas, playbook, and the one source test below.

Your job:

1. Write a single Playwright test file that reproduces the same user-facing
   behavior as the source test.
2. The new test's title must contain the given tag exactly once, verbatim.
   The machine checks this mechanically — do not paraphrase or drop it.
3. For every source assertion listed, add either:
   - `// covers <id>` if your new test asserts the equivalent condition, or
   - `// dropped <id>: <a real reason>` if it genuinely cannot be ported
     (e.g. the demo app has no equivalent feature). Do not drop an assertion
     because it's inconvenient — only because it's actually impossible.
4. Do not invent infrastructure. If a page object or helper you need doesn't
   exist yet, write the test directly against the page for now — scope
   creep here is exactly what makes a "small" migration unreviewable.
5. If this is a retry, the previous attempt's failure signature is available
   to you — repair that specific failure, don't rewrite the test from
   scratch.

Return only the file's full contents in one fenced code block. Nothing
outside it — the harness parses the block directly.
