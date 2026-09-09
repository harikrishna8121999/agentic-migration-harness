// Mechanical review checks: no model in the decision path. Each check
// declares its own enforcement — "scripted" gates the run, "advisory" only
// annotates the case file. This split exists because of a real incident (see
// gotchas.md): a scripted duplicate-text check once matched a pattern inside
// a *comment*, sent a correct change back through a full rework round, and
// was "fixed" by editing the comment rather than the code. The rule survives
// as policy here: a scripted check must be provably correct on the exact
// thing it inspects, or it must not be scripted at all.

import { readFile } from "node:fs/promises";
import type { Unit } from "./types.js";

export interface CheckResult {
  id: string;
  enforcement: "scripted" | "advisory";
  passed: boolean;
  message: string;
  remediation?: string;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function runConventionChecks(targetFile: string, unit: Unit): Promise<CheckResult[]> {
  const raw = await readFile(targetFile, "utf8");
  const code = stripComments(raw);
  const results: CheckResult[] = [];

  // scripted — the tag binds the machine's unit identity to the model's
  // chosen test title. Exactly one occurrence, checked against the real
  // file, not trusted from the model's report.
  const tagCount = (raw.match(new RegExp(escapeRegExp(unit.tag), "g")) ?? []).length;
  results.push({
    id: "tag-present-once",
    enforcement: "scripted",
    passed: tagCount === 1,
    message:
      tagCount === 1
        ? `tag ${unit.tag} present exactly once`
        : `tag ${unit.tag} appears ${tagCount} times in ${targetFile}, expected exactly 1`,
    remediation: `Edit the test title in ${targetFile} so it contains ${unit.tag} exactly once.`,
  });

  // scripted — matched against code with comments stripped, so a leftover
  // ".only(" inside a comment can never trip this. This is the fix for the
  // false-positive story above, applied to a different check with the same
  // shape of bug.
  const hasOnly = /\.only\s*\(/.test(code);
  results.push({
    id: "no-test-only",
    enforcement: "scripted",
    passed: !hasOnly,
    message: hasOnly
      ? `test.only(...) left in ${targetFile} — would silently skip every sibling test`
      : "no test.only(...) found",
    remediation: `Remove .only from ${targetFile}.`,
  });

  // advisory — a generic locator string is a smell, not a defect; a human
  // or the next review round should look, but it must never block CLOSE on
  // its own. Demoting genuinely generic patterns to advisory is part of the
  // same policy as the two scripted checks above.
  const genericLocator = /getByText\(\s*['"](ok|submit|save|yes|continue)['"]/i.test(code);
  results.push({
    id: "generic-locator-name",
    enforcement: "advisory",
    passed: !genericLocator,
    message: genericLocator
      ? `a generic locator string was used in ${targetFile}; confirm it is unambiguous against the live page`
      : "no generic locator strings flagged",
    remediation: `Re-check the flagged locator in ${targetFile} against the running app; prefer role+name or a test id.`,
  });

  return results;
}

/** REVIEW fails only on a scripted check; advisory failures are recorded but
 * never block. This function is the whole of the policy from checks.ts's
 * point of view — the engine calls it and does not re-derive the rule. */
export function reviewPasses(results: CheckResult[]): boolean {
  return results.every((r) => r.enforcement !== "scripted" || r.passed);
}
