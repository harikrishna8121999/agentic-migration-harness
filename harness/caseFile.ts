// The case file: the only memory that survives between phases. It is a JSON
// file under tasks/, one per unit. Nothing here is conversational — every
// phase reads this object fresh and writes it back before handing off.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CaseFile, Unit } from "./types.js";
import { findLatestCommitForUnit } from "./git.js";

const TASKS_DIR = "tasks";

function caseFilePath(unitId: string): string {
  return path.posix.join(TASKS_DIR, `${unitId}.json`);
}

export async function loadCaseFile(unit: Unit): Promise<CaseFile> {
  try {
    const raw = await readFile(caseFilePath(unit.id), "utf8");
    return JSON.parse(raw) as CaseFile;
  } catch {
    return { unit, status: "pending", phase: "preflight", attempts: [] };
  }
}

export async function saveCaseFile(cf: CaseFile): Promise<void> {
  await mkdir(TASKS_DIR, { recursive: true });
  await writeFile(caseFilePath(cf.unit.id), JSON.stringify(cf, null, 2), "utf8");
}

export async function listCaseFiles(): Promise<CaseFile[]> {
  try {
    const files = await readdir(TASKS_DIR);
    const cases: CaseFile[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      cases.push(JSON.parse(await readFile(path.posix.join(TASKS_DIR, f), "utf8")));
    }
    return cases;
  } catch {
    return [];
  }
}

/** Called before a unit is (re)started. If the case file claims "done" but
 * git has no matching commit, that claim is unverifiable — downgrade it to
 * "blocked" instead of trusting a stale or hand-edited file. If the case
 * file claims "dropped" but a human has since recorded an explicit reopen,
 * that reopen wins and the unit becomes eligible to run again. Git stays
 * authoritative for what actually shipped; the reopen record is the escape
 * hatch for a human who fixed the underlying blocker. */
export function reconcileWithGit(cf: CaseFile, targetDir: string): CaseFile {
  const latest = findLatestCommitForUnit(targetDir, cf.unit);

  if (cf.status === "done" && !latest) {
    return {
      ...cf,
      status: "blocked",
      dropReason: "case file claims done but no matching commit was found in git — re-run this unit",
    };
  }

  const reopen = cf.reopens?.at(-1);
  if ((cf.status === "dropped" || cf.status === "blocked") && reopen) {
    const droppedAt = cf.attempts.at(-1)?.at;
    if (!droppedAt || new Date(reopen.at) > new Date(droppedAt)) {
      return { ...cf, status: "pending", phase: "preflight", dropReason: undefined };
    }
  }

  return cf;
}
