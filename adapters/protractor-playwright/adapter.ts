// The one adapter this repo ships: Protractor (source, read as text only —
// never executed) to Playwright (target, executed for real in a real run).
// This is the concrete instance of the seam documented in harness/adapter.ts.

import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { MigrationAdapter } from "../../harness/adapter.js";
import { computeAssertionParity, hashReport } from "../../harness/evidence.js";
import type { Evidence, Principle, Unit } from "../../harness/types.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Returns the substring from the opening brace at `openIndex` through its
 * matching close brace. Naive brace counting is enough for the small,
 * hand-written fixtures in example/legacy-tests — this is a teaching repo,
 * not a JS parser. */
function extractBraceBody(src: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(openIndex, i + 1);
    }
  }
  throw new Error(`unbalanced braces starting at index ${openIndex}`);
}

export async function enumerateUnits(sourceFile: string): Promise<Unit[]> {
  const src = await readFile(sourceFile, "utf8");
  const units: Unit[] = [];
  const itRe = /it\(\s*(['"])(.*?)\1\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = itRe.exec(src))) {
    const sourceName = match[2];
    const openBraceIndex = match.index + match[0].length - 1;
    const body = extractBraceBody(src, openBraceIndex);
    const id = slugify(sourceName);
    const tag = `[migrated:${id}]`;

    const assertions: string[] = [];
    const assertRe = /\/\/\s*assert:\s*(\S+)/g;
    let assertMatch: RegExpExecArray | null;
    while ((assertMatch = assertRe.exec(body))) {
      assertions.push(`${id}:${assertMatch[1]}`);
    }

    units.push({ id, tag, sourceFile, sourceName, sourceAssertions: assertions });
  }

  return units;
}

function summarizeFailure(report: any): string | undefined {
  for (const suite of report.suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          if (result.status !== "passed" && result.error) {
            const location = result.error.location
              ? `${result.error.location.file}:${result.error.location.line}`
              : spec.file;
            const message = String(result.error.message ?? "").split("\n")[0];
            return `${location} ${message}`;
          }
        }
      }
    }
  }
  return undefined;
}

export async function verifyUnit(
  unit: Unit,
  targetFile: string
): Promise<{ passed: boolean; signature?: string; reportPath: string }> {
  const reportPath = path.posix.join("tasks", "reports", `${unit.id}.json`);
  await mkdir(path.dirname(reportPath), { recursive: true });

  try {
    execFileSync("npx", ["playwright", "test", targetFile, "--reporter=json"], {
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath },
      stdio: "pipe",
    });
  } catch {
    // Playwright exits non-zero on a failing suite. The report file is what
    // we trust, not this exit code — read on regardless.
  }

  const report = JSON.parse(await readFile(reportPath, "utf8"));
  // The tool's own verdict field, not a re-derivation from the exit code:
  // stats.unexpected is Playwright's authoritative failed-test count.
  const passed = report.stats?.unexpected === 0 && report.stats?.expected > 0;
  return { passed, reportPath, signature: passed ? undefined : summarizeFailure(report) };
}

export async function recordEvidence(unit: Unit, targetFile: string, reportPath: string): Promise<Evidence> {
  const reportHash = await hashReport(reportPath);
  const targetSource = await readFile(targetFile, "utf8");
  const assertionParity = computeAssertionParity(unit, targetSource);
  return {
    reportHash,
    reportPath,
    assertionParity,
    conventionsPassed: true, // CLOSE only calls this after REVIEW already passed
    recordedAt: new Date().toISOString(),
  };
}

export function principles(): Principle[] {
  return [
    {
      id: "confirm-locators-live",
      text: "Do not port a Protractor by.css/by.id selector faithfully. Load the running app and confirm the equivalent Playwright locator resolves to exactly one element before writing the assertion.",
      enforcement: "advisory",
    },
    {
      id: "no-manual-waits",
      text: "Do not port Protractor's implicit waits or add sleep()/waitForTimeout(). Use Playwright's auto-waiting expect(locator).toBeVisible()-style assertions instead.",
      enforcement: "advisory",
    },
  ];
}

export function evidenceCommand(unit: Unit): string {
  return `npx playwright test --grep "${unit.tag.replace(/[[\]]/g, "\\$&")}"`;
}

export const protractorToPlaywrightAdapter: MigrationAdapter = {
  enumerateUnits,
  verifyUnit,
  recordEvidence,
  principles,
  evidenceCommand,
};
