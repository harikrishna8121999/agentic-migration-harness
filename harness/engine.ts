// The machine. A deterministic loop over each unit's phases. The model
// (real run) or the dry-run fixture writer produces file content inside
// IMPLEMENT; everything else — whether to retry, drop, block, or commit —
// is decided here, never by anything the model said.
//
// Transition table (see also README's copy of this):
//
//   PREFLIGHT  --pass-->            IMPLEMENT
//   PREFLIGHT  --fail-->            (run aborts before any unit starts)
//   IMPLEMENT  -->                  VERIFY
//   VERIFY     --pass-->            REVIEW
//   VERIFY     --fail, new sig-->   IMPLEMENT   (retry, budget permitting)
//   VERIFY     --fail, same sig-->  DROPPED     (thrash — stop early)
//   VERIFY     --fail, budget out-> DROPPED
//   REVIEW     --pass-->            CLOSE
//   REVIEW     --fail, scripted-->  IMPLEMENT   (retry, budget permitting)
//   REVIEW     --fail, budget out-> BLOCKED     (needs a human)
//   CLOSE      --parity complete--> DONE (commit)
//   CLOSE      --parity incomplete->BLOCKED     (needs a human)

import path from "node:path";
import type { MigrationAdapter } from "./adapter.js";
import { loadCaseFile, reconcileWithGit, saveCaseFile } from "./caseFile.js";
import { reviewPasses, runConventionChecks } from "./checks.js";
import { isThrashing } from "./convergence.js";
import { implementDryRun } from "./dryRun.js";
import { parityIsComplete } from "./evidence.js";
import { commitUnit } from "./git.js";
import { implementWithModel } from "./llm.js";
import type { CaseFile, Unit } from "./types.js";

export const MAX_VERIFY_ATTEMPTS = 3;
export const MAX_REVIEW_ATTEMPTS = 2;

export interface EngineContext {
  dryRun: boolean;
  targetDir: string;
  sourceDir: string;
  adapter: MigrationAdapter;
  onLog: (line: string) => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function runUnit(unit: Unit, ctx: EngineContext): Promise<CaseFile> {
  let cf = reconcileWithGit(await loadCaseFile(unit), ctx.targetDir);

  if (cf.status === "done") {
    ctx.onLog(`already done — skipping`);
    return cf;
  }
  if (cf.status === "dropped" || cf.status === "blocked") {
    ctx.onLog(`${cf.status}: ${cf.dropReason} (reopen with --reopen ${unit.id})`);
    return cf;
  }

  const targetFile = path.posix.join(ctx.targetDir, `${unit.id}.spec.ts`);
  cf.targetFile = targetFile;
  cf.status = "in_progress";

  let implementAttempt = 0;
  let verifyAttempts = 0;
  let reviewAttempts = 0;
  let previousSignature: string | undefined;

  while (true) {
    // ---- IMPLEMENT ----
    // implementAttempt counts every re-entry into this phase, whether the
    // previous loop retried because of a VERIFY failure or a REVIEW
    // failure — both are "try implementing again," and a dry-run fixture
    // keyed only on verify-failure count would keep regenerating the same
    // (already-rejected) attempt when the retry came from REVIEW instead.
    cf.phase = "implement";
    if (ctx.dryRun) {
      await implementDryRun(unit, implementAttempt, targetFile);
    } else {
      await implementWithModel(unit, targetFile);
    }
    cf.attempts.push({ phase: "implement", verdict: "pass", at: nowIso() });
    await saveCaseFile(cf);

    // ---- VERIFY ----
    cf.phase = "verify";
    const verify = await ctx.adapter.verifyUnit(unit, targetFile);
    cf.attempts.push({
      phase: "verify",
      verdict: verify.passed ? "pass" : "fail",
      signature: verify.signature,
      at: nowIso(),
    });
    await saveCaseFile(cf);

    if (!verify.passed) {
      verifyAttempts += 1;
      const thrash = isThrashing(previousSignature, verify.signature);
      previousSignature = verify.signature;

      if (thrash) {
        cf.status = "dropped";
        cf.dropReason = `verify is thrashing — identical failure signature across attempts: "${verify.signature}". Stopped after ${verifyAttempts} attempt(s) instead of spending the rest of the budget.`;
        await saveCaseFile(cf);
        ctx.onLog(`DROPPED — ${cf.dropReason}`);
        return cf;
      }
      if (verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
        cf.status = "dropped";
        cf.dropReason = `verify attempt budget (${MAX_VERIFY_ATTEMPTS}) exhausted. Last failure: "${verify.signature}"`;
        await saveCaseFile(cf);
        ctx.onLog(`DROPPED — ${cf.dropReason}`);
        return cf;
      }
      ctx.onLog(`verify failed (attempt ${verifyAttempts}/${MAX_VERIFY_ATTEMPTS}), new signature — repairing: ${verify.signature}`);
      implementAttempt += 1;
      continue;
    }

    // ---- REVIEW ----
    cf.phase = "review";
    const checks = await runConventionChecks(targetFile, unit);
    const passed = reviewPasses(checks);
    cf.attempts.push({
      phase: "review",
      verdict: passed ? "pass" : "fail",
      at: nowIso(),
    });
    await saveCaseFile(cf);

    if (!passed) {
      reviewAttempts += 1;
      const failedScripted = checks.filter((c) => c.enforcement === "scripted" && !c.passed);
      if (reviewAttempts >= MAX_REVIEW_ATTEMPTS) {
        cf.status = "blocked";
        cf.dropReason = `review failed a scripted check ${reviewAttempts} time(s) — needs a human: ${failedScripted.map((c) => c.message).join("; ")}`;
        await saveCaseFile(cf);
        ctx.onLog(`BLOCKED — ${cf.dropReason}`);
        return cf;
      }
      ctx.onLog(`review failed a scripted check (attempt ${reviewAttempts}/${MAX_REVIEW_ATTEMPTS}) — repairing: ${failedScripted.map((c) => c.message).join("; ")}`);
      implementAttempt += 1;
      continue;
    }

    // ---- CLOSE ----
    cf.phase = "close";
    const evidence = await ctx.adapter.recordEvidence(unit, targetFile, verify.reportPath);
    if (!parityIsComplete(evidence.assertionParity)) {
      cf.status = "blocked";
      cf.dropReason = `assertion parity incomplete: ${evidence.assertionParity.covered}/${evidence.assertionParity.total} covered, ${evidence.assertionParity.dropped.length} explicitly dropped. Add a "// covers <id>" or "// dropped <id>: <reason>" line for every remaining source assertion. Reproduce with: ${ctx.adapter.evidenceCommand(unit)}`;
      await saveCaseFile(cf);
      ctx.onLog(`BLOCKED — ${cf.dropReason}`);
      return cf;
    }

    cf.evidence = evidence;
    cf.status = "done";
    await saveCaseFile(cf);
    const sha = commitUnit(ctx.targetDir, unit, targetFile, "passing");
    ctx.onLog(`DONE — evidence ${evidence.reportHash.slice(0, 12)}… committed ${sha.slice(0, 7)}`);
    return cf;
  }
}
