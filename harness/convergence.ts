// A flat retry cap can't tell "one fix away from green" from "looping
// forever" — it kills both at the same count. Diffing the failure signature
// between attempts can: a new signature means the last fix worked and a
// different problem surfaced (progress, keep going); an identical signature
// means nothing changed (thrash, stop now rather than burning the rest of
// the budget).

function normalize(signature: string): string {
  return signature
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    // strip volatile bits that differ run-to-run but don't mean the failure
    // is actually different: timestamps, line:col pairs, temp paths.
    .replace(/\d{4}-\d{2}-\d{2}t[\d:.]+z?/g, "<ts>")
    .replace(/:\d+:\d+/g, ":<pos>");
}

export function isThrashing(previous: string | undefined, current: string | undefined): boolean {
  if (!previous || !current) return false;
  return normalize(previous) === normalize(current);
}
