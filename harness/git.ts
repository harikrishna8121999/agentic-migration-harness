// Git as durable state. Commits are the ledger; every resume reconciles the
// case file against git before trusting it. Subject line convention:
//
//   migrate(<unit.id>): <status> <unit.tag>
//
// e.g. "migrate(login_003): passing [migrated:login_003]"
//
// This is parseable on the way back in, which is what makes a corrupted or
// deleted case file rebuildable instead of fatal.
//
// All git commands here run from the harness's own working directory
// (process.cwd()), not from targetDir — targetFile paths are already
// relative to that cwd. This is correct as long as the target lives inside
// the same repo the harness is invoked from, which is true for the bundled
// example. A harness pointed at a genuinely separate target repo elsewhere
// on disk would need these commands run with cwd set to that repo's root
// instead — see the README note on the adapter seam for where that would
// plug in.

import { execFileSync } from "node:child_process";
import type { Unit } from "./types.js";

export function commitUnit(_targetDir: string, unit: Unit, targetFile: string, status: "passing" | "dropped"): string {
  const subject = `migrate(${unit.id}): ${status} ${unit.tag}`;
  execFileSync("git", ["add", targetFile]);
  execFileSync("git", ["commit", "-m", subject, "--allow-empty"]);
  return execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();
}

/** Newest matching commit wins. This is what lets a human fix the underlying
 * blocker and have the *next* commit for a unit supersede an earlier
 * "dropped" one, rather than the drop being permanent just because it was
 * git history. */
export function findLatestCommitForUnit(_targetDir: string, unit: Unit): { subject: string; sha: string } | undefined {
  let log: string;
  try {
    log = execFileSync("git", ["log", "--format=%H\t%s", "--all"]).toString();
  } catch {
    return undefined;
  }
  const needle = unit.tag;
  const lines = log.split("\n").filter((l) => l.includes(needle));
  if (lines.length === 0) return undefined;
  const [sha, ...rest] = lines[0].split("\t"); // git log --all is newest-first
  return { sha, subject: rest.join("\t") };
}

export function hasUncommittedChanges(targetDir: string): boolean {
  try {
    const out = execFileSync("git", ["status", "--porcelain", "--", targetDir]).toString();
    return out.trim().length > 0;
  } catch {
    return false;
  }
}
