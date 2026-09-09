// The evidence contract. A migration is "done" only if this file says so,
// and this file only says so from things a script can independently verify —
// never from a claim the model made about its own work.

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { DroppedAssertion, Evidence, Unit } from "./types.js";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Hash the real, machine-readable test report — not a marker file a model
 * (or a careless script) could `touch` into existing. If reportPath doesn't
 * exist, this throws; there is deliberately no fallback. */
export async function hashReport(reportPath: string): Promise<string> {
  await stat(reportPath); // throws ENOENT if the report was never produced
  const buf = await readFile(reportPath);
  return createHash("sha256").update(buf).digest("hex");
}

/** Every source assertion must be mechanically accounted for: covered by a
 * `// covers <assertion-id>` comment in the target, or explicitly
 * `// dropped <assertion-id>: <reason>`. Assertions with neither are simply
 * missing from the count — that's what stops a quiet, unlogged omission. */
export function computeAssertionParity(
  unit: Unit,
  targetSource: string
): Evidence["assertionParity"] {
  let covered = 0;
  const dropped: DroppedAssertion[] = [];

  for (const assertion of unit.sourceAssertions) {
    const id = escapeRegExp(assertion);
    const dropMatch = targetSource.match(new RegExp(`dropped\\s+${id}:\\s*(.+)`));
    if (dropMatch) {
      dropped.push({ sourceAssertion: assertion, reason: dropMatch[1].trim() });
      continue;
    }
    if (new RegExp(`covers\\s+${id}\\b`).test(targetSource)) {
      covered += 1;
    }
  }

  return { covered, total: unit.sourceAssertions.length, dropped };
}

export function parityIsComplete(parity: Evidence["assertionParity"]): boolean {
  return parity.covered + parity.dropped.length === parity.total;
}
