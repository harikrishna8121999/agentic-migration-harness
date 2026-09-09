// The single most convincing demonstration in this repo: delete the report
// a "done" unit's evidence is hashed from, then ask CLOSE to recompute that
// evidence. There is no marker file to touch back into existence — the
// hash is of a real report, and without the report there is no hash.
//
// Run: npm run dry-run   (creates at least one done unit)
//      npm run break-it

import { unlink } from "node:fs/promises";
import { protractorToPlaywrightAdapter } from "../adapters/protractor-playwright/adapter.js";
import { listCaseFiles } from "../harness/caseFile.js";

async function main() {
  const caseFiles = await listCaseFiles();
  const done = caseFiles.find((c) => c.status === "done" && c.evidence);

  if (!done || !done.targetFile || !done.evidence) {
    console.log('No completed unit found under tasks/. Run "npm run dry-run" first, then re-run "npm run break-it".');
    process.exitCode = 1;
    return;
  }

  console.log(`Found a completed unit: ${done.unit.id}`);
  console.log(`Its evidence report: ${done.evidence.reportPath}`);
  console.log(`Deleting it...\n`);
  await unlink(done.evidence.reportPath);

  console.log("Now asking CLOSE to recompute evidence for this same unit, exactly as it would on a real close:\n");
  try {
    await protractorToPlaywrightAdapter.recordEvidence(done.unit, done.targetFile, done.evidence.reportPath);
    console.log("Evidence was recomputed. This should not be possible — please file an issue.");
    process.exitCode = 1;
  } catch (err) {
    console.log("CLOSE refused, mechanically:");
    console.log(`  ${(err as Error).message}`);
    console.log(
      "\nThat's the whole point: the evidence is a hash of a report that has to actually exist on disk. " +
        "There is no marker file to `touch` back into being — delete the report, and \"done\" cannot be reproduced."
    );
  }
}

main();
