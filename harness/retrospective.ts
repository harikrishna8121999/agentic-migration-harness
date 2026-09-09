// RETROSPECTIVE proposes; it never writes gotchas.md directly. A human
// reads gotchas-proposed.md and decides what's worth keeping — the same
// discipline the original project found necessary after seeing that
// thousands of lines of auto-generated guidance scored worse than a few
// hundred hand-curated ones.

import { appendFile } from "node:fs/promises";
import type { CaseFile } from "./types.js";

const PROPOSALS_FILE = "gotchas-proposed.md";

export async function proposeGotchas(caseFiles: CaseFile[]): Promise<number> {
  const troubled = caseFiles.filter((cf) => cf.status === "dropped" || cf.status === "blocked");
  if (troubled.length === 0) return 0;

  const lines = troubled.map(
    (cf) => `- [ ] **${cf.unit.id}** (${cf.status}): ${cf.dropReason ?? "no reason recorded"} — proposed ${new Date().toISOString()}`
  );

  await appendFile(PROPOSALS_FILE, "\n" + lines.join("\n") + "\n", "utf8");
  return troubled.length;
}
