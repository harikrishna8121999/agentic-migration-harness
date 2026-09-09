// Preflight gates: mechanical, environment-level checks that run once before
// the run starts. No LLM in this file. Every failure carries the exact
// command that fixes it — a gate that just says "no" is an obstacle, not a
// guardrail.

import { execFileSync } from "node:child_process";
import { access, constants, mkdir } from "node:fs/promises";

export interface GateResult {
  id: string;
  pass: boolean;
  message: string;
  remediation?: string;
}

export interface GateContext {
  dryRun: boolean;
  targetDir: string;
}

type Gate = (ctx: GateContext) => Promise<GateResult>;

const gitAvailable: Gate = async () => {
  try {
    execFileSync("git", ["--version"], { stdio: "pipe" });
    return { id: "git-available", pass: true, message: "git is on PATH" };
  } catch {
    return {
      id: "git-available",
      pass: false,
      message: "git was not found on PATH",
      remediation: "Install git and ensure it is on PATH: https://git-scm.com/downloads",
    };
  }
};

const targetDirWritable: Gate = async (ctx) => {
  // Creating a fresh target directory is harmless — only a genuine
  // permission problem should fail this gate, not "it doesn't exist yet".
  try {
    await mkdir(ctx.targetDir, { recursive: true });
    await access(ctx.targetDir, constants.W_OK);
    return { id: "target-dir-writable", pass: true, message: `${ctx.targetDir} is writable` };
  } catch {
    return {
      id: "target-dir-writable",
      pass: false,
      message: `${ctx.targetDir} could not be created or is not writable`,
      remediation: `mkdir -p ${ctx.targetDir} && chmod u+w ${ctx.targetDir}`,
    };
  }
};

const apiKeyPresent: Gate = async (ctx) => {
  if (ctx.dryRun) {
    return { id: "api-key-present", pass: true, message: "skipped — dry run needs no API key" };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { id: "api-key-present", pass: true, message: "ANTHROPIC_API_KEY is set" };
  }
  if (process.env.OPENROUTER_API_KEY) {
    if (!process.env.HARNESS_MODEL) {
      return {
        id: "api-key-present",
        pass: false,
        message: "OPENROUTER_API_KEY is set but HARNESS_MODEL is not",
        remediation: 'Set HARNESS_MODEL to an explicit "<provider>/<model>" slug, e.g. HARNESS_MODEL="anthropic/claude-3.5-sonnet" — see https://openrouter.ai/models',
      };
    }
    return { id: "api-key-present", pass: true, message: `OPENROUTER_API_KEY is set (model: ${process.env.HARNESS_MODEL})` };
  }
  return {
    id: "api-key-present",
    pass: false,
    message: "Neither ANTHROPIC_API_KEY nor OPENROUTER_API_KEY is set",
    remediation: 'Put one of them in .env (see .env.example)  (see README: "Real run")',
  };
};

const browserInstalled: Gate = async (ctx) => {
  if (ctx.dryRun) {
    return { id: "browser-installed", pass: true, message: "skipped — dry run needs no browser" };
  }
  try {
    // shell: true because on Windows `npx` is a .cmd shim — execFileSync
    // can't exec it directly without going through a shell. All arguments
    // here are fixed strings this repo controls, never external input.
    execFileSync("npx", ["playwright", "--version"], { stdio: "pipe", shell: true });
    return { id: "browser-installed", pass: true, message: "playwright CLI is available" };
  } catch {
    return {
      id: "browser-installed",
      pass: false,
      message: "Playwright is not installed",
      remediation: "npx playwright install --with-deps chromium",
    };
  }
};

export const PREFLIGHT_GATES: Gate[] = [gitAvailable, targetDirWritable, apiKeyPresent, browserInstalled];

export async function runPreflight(ctx: GateContext): Promise<GateResult[]> {
  const results: GateResult[] = [];
  for (const gate of PREFLIGHT_GATES) {
    results.push(await gate(ctx));
  }
  return results;
}
