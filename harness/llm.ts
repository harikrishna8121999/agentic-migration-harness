// The only file in harness/ that talks to a model. Everything it needs is
// assembled here from static files (prompts, playbooks, principles,
// gotchas) plus the one unit being migrated — this is "working context" per
// the README: curated and bounded, not an accumulating conversation. This
// call is stateless; the case file, not chat history, is what the next
// phase or retry will see.
//
// Two providers are supported, chosen by whichever key is present
// (ANTHROPIC_API_KEY takes priority if both are set) — proof that the
// harness layer doesn't care which execution engine is behind IMPLEMENT.
// Everything above this file (the loop, the gates, the evidence contract)
// is identical either way.

import Anthropic from "@anthropic-ai/sdk";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { protractorToPlaywrightAdapter } from "../adapters/protractor-playwright/adapter.js";
import type { Unit } from "./types.js";

async function readIfExists(p: string): Promise<string> {
  try {
    return await readFile(p, "utf8");
  } catch {
    return "";
  }
}

async function assembleContext(unit: Unit): Promise<string> {
  const [jobCard, playbook, principles, gotchas, source] = await Promise.all([
    readIfExists("prompts/implement.md"),
    readIfExists("playbooks/migrate-one-test.md"),
    readIfExists("principles.md"),
    readIfExists("gotchas.md"),
    readFile(unit.sourceFile, "utf8"),
  ]);

  const adapterPrinciples = protractorToPlaywrightAdapter
    .principles()
    .map((p) => `- [${p.enforcement}] ${p.text}`)
    .join("\n");

  return [
    jobCard,
    "\n## Principles (repo-wide)\n" + principles,
    "\n## Principles (this adapter)\n" + adapterPrinciples,
    "\n## Gotchas\n" + gotchas,
    "\n## Playbook\n" + playbook,
    `\n## Unit to migrate`,
    `id: ${unit.id}`,
    `tag to embed exactly once in the new test's title: ${unit.tag}`,
    `source assertions to account for (each needs its own "// covers <id>" or "// dropped <id>: <reason>" line in the new file): ${unit.sourceAssertions.join(", ") || "(none found)"}`,
    `\n## Source file (${unit.sourceFile}) — read-only, never executed`,
    "```\n" + source + "\n```",
    "\nReturn only the full contents of the new Playwright test file, as a single fenced ```typescript code block. No prose outside the block.",
  ].join("\n");
}

async function callAnthropic(prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.HARNESS_MODEL ?? "claude-sonnet-5";
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

/** OpenRouter speaks an OpenAI-compatible /chat/completions endpoint, not
 * the Anthropic Messages API — so this is a plain fetch, not the Anthropic
 * SDK pointed at a different URL. That's the whole adapter: one function,
 * same prompt in, same fenced-code-block contract out. */
async function callOpenRouter(prompt: string): Promise<string> {
  const model = process.env.HARNESS_MODEL;
  if (!model) {
    throw new Error(
      'OPENROUTER_API_KEY is set but HARNESS_MODEL is not. OpenRouter needs an explicit "<provider>/<model>" slug ' +
        '(e.g. HARNESS_MODEL="anthropic/claude-3.5-sonnet" or HARNESS_MODEL="openai/gpt-4o-mini") — see https://openrouter.ai/models'
    );
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter request failed: ${res.status} ${res.statusText} — ${await res.text()}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

async function callModel(prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) return callAnthropic(prompt);
  if (process.env.OPENROUTER_API_KEY) return callOpenRouter(prompt);
  throw new Error("Neither ANTHROPIC_API_KEY nor OPENROUTER_API_KEY is set.");
}

export async function implementWithModel(unit: Unit, targetFile: string): Promise<void> {
  const prompt = await assembleContext(unit);
  const text = await callModel(prompt);

  const match = text.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
  if (!match) {
    throw new Error(`model response for ${unit.id} did not contain a fenced code block`);
  }

  await mkdir(path.dirname(targetFile), { recursive: true });
  await writeFile(targetFile, match[1], "utf8");
}
