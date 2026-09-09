// Entry point. Reads flags, runs PREFLIGHT, enumerates units, walks each one
// through engine.runUnit, then prints a summary loud enough that nothing
// dropped or blocked can go unnoticed.

import "dotenv/config"; // loads .env into process.env before any gate reads it — first import on purpose
import { readdir } from "node:fs/promises";
import path from "node:path";
import { protractorToPlaywrightAdapter } from "../adapters/protractor-playwright/adapter.js";
import { listCaseFiles, saveCaseFile } from "./caseFile.js";
import { makeDryRunAdapter } from "./dryRun.js";
import { runUnit } from "./engine.js";
import { runPreflight } from "./gates.js";
import { hasUncommittedChanges } from "./git.js";
import { proposeGotchas } from "./retrospective.js";
import type { CaseFile } from "./types.js";

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

async function listSpecFiles(sourceDir: string): Promise<string[]> {
  const entries = await readdir(sourceDir);
  return entries.filter((f) => f.endsWith(".spec.js")).map((f) => path.posix.join(sourceDir, f));
}

function printSummary(results: CaseFile[], adapter: typeof protractorToPlaywrightAdapter, targetDir: string): void {
  console.log("\n=== run summary ===");
  const byStatus = { done: 0, dropped: 0, blocked: 0, other: 0 };
  for (const cf of results) {
    if (cf.status === "done") byStatus.done += 1;
    else if (cf.status === "dropped") byStatus.dropped += 1;
    else if (cf.status === "blocked") byStatus.blocked += 1;
    else byStatus.other += 1;
  }
  console.log(`done: ${byStatus.done}  dropped: ${byStatus.dropped}  blocked: ${byStatus.blocked}`);

  const troubled = results.filter((cf) => cf.status === "dropped" || cf.status === "blocked");
  if (troubled.length > 0) {
    console.log("\nnothing here is silent — every dropped/blocked unit, with its reason:");
    for (const cf of troubled) {
      console.log(`  [${cf.status}] ${cf.unit.id}: ${cf.dropReason}`);
      console.log(`    reproduce: ${adapter.evidenceCommand(cf.unit)}`);
    }
  }

  if (hasUncommittedChanges(targetDir)) {
    console.log(
      `\nnote: ${targetDir} has uncommitted changes — these belong to units that never reached CLOSE. ` +
        `They are not lost (they're on disk), but they are not durable progress until a unit finishes and commits.`
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  // Deliberately left relative to the current working directory, not
  // resolved to an absolute path — resolving would bake this machine's
  // absolute path (and username, on most systems) into every case file
  // this run writes. Node resolves relative paths against cwd for every fs
  // and child_process call the harness makes, so this loses nothing.
  const sourceDir = argValue(args, "--source-dir") ?? "example/legacy-tests";
  const targetDir = argValue(args, "--target-dir") ?? "example/migrated-tests";
  const reopenId = argValue(args, "--reopen");
  const reopenReason = argValue(args, "--reason") ?? "manually reopened";

  console.log(`\n=== agent-migration-harness — ${dryRun ? "DRY RUN (no API key, no browser)" : "real run"} ===`);

  console.log("\n-- preflight --");
  const gateResults = await runPreflight({ dryRun, targetDir });
  let anyGateFailed = false;
  for (const g of gateResults) {
    console.log(`${g.pass ? "PASS" : "FAIL"}  ${g.id} — ${g.message}`);
    if (!g.pass) {
      anyGateFailed = true;
      console.log(`        fix: ${g.remediation}`);
    }
  }
  if (anyGateFailed) {
    console.log("\npreflight failed — fix the above and re-run. Nothing else has happened yet.");
    process.exitCode = 1;
    return;
  }

  if (reopenId) {
    const cfs = await listCaseFiles();
    const found = cfs.find((c) => c.unit.id === reopenId);
    if (!found) {
      console.log(`\nno case file found for unit "${reopenId}" — nothing to reopen.`);
      process.exitCode = 1;
      return;
    }
    found.reopens = [...(found.reopens ?? []), { at: new Date().toISOString(), reason: reopenReason }];
    await saveCaseFile(found);
    console.log(`\nreopened ${reopenId}: ${reopenReason}`);
  }

  const realAdapter = protractorToPlaywrightAdapter;
  const adapter = dryRun ? makeDryRunAdapter(realAdapter) : realAdapter;

  console.log("\n-- enumerating units --");
  const legacyFiles = await listSpecFiles(sourceDir);
  const unitsPerFile = await Promise.all(legacyFiles.map((f) => adapter.enumerateUnits(f)));
  const units = unitsPerFile.flat();
  console.log(`found ${units.length} unit(s) across ${legacyFiles.length} file(s) in ${sourceDir}`);

  console.log("\n-- running units --");
  const results: CaseFile[] = [];
  for (const unit of units) {
    console.log(`\n> ${unit.id}  ("${unit.sourceName}")`);
    const cf = await runUnit(unit, {
      dryRun,
      targetDir,
      sourceDir,
      adapter,
      onLog: (line) => console.log(`  ${line}`),
    });
    results.push(cf);
  }

  printSummary(results, realAdapter, targetDir);

  const proposed = await proposeGotchas(results);
  if (proposed > 0) {
    console.log(`\nretrospective: proposed ${proposed} gotcha candidate(s) in gotchas-proposed.md — a human curates these into gotchas.md, never automatic.`);
  }
}

main().catch((err) => {
  console.error("\nharness crashed:", err);
  process.exitCode = 1;
});
