// Shared vocabulary for the engine. Read this file first — everything else
// in harness/ is a function over these types.

/** The six phases a unit passes through. Order matters; see engine.ts TRANSITIONS. */
export type Phase =
  | "preflight"
  | "implement"
  | "verify"
  | "review"
  | "close"
  | "retrospective";

/** Where a unit sits in the run. Terminal states: done, dropped, blocked. */
export type UnitStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "dropped"
  | "blocked"
  | "deferred";

/** A single migratable item — one test method in the source suite. This is
 * the unit of delegation: small enough that it has its own verdict, so a
 * crash or a stuck retry never holds up its neighbors. */
export interface Unit {
  id: string;
  /** Grep-verifiable tag embedded in the migrated test's title, e.g. "[migrated:login_003]".
   * The machine validates this tag rather than trusting the model wrote it. */
  tag: string;
  sourceFile: string;
  sourceName: string;
  /** Assertions found in the source, for the parity check in the evidence contract. */
  sourceAssertions: string[];
}

/** What a phase reports back to the engine. The engine — never the model —
 * turns this into a transition. */
export interface PhaseResult {
  verdict: "pass" | "fail" | "gate-fail";
  /** Machine-readable reason, used for the failure-signature diff in retries. */
  signature?: string;
  notes: string[];
}

/** One retry attempt's record, kept so convergence can be judged across attempts. */
export interface Attempt {
  phase: Phase;
  verdict: PhaseResult["verdict"];
  signature?: string;
  at: string; // ISO timestamp
}

/** The case file: the only memory that survives between phases. Phases share
 * no conversational history — this object, serialized to disk, is the whole
 * of what the next phase gets to see. */
export interface CaseFile {
  unit: Unit;
  status: UnitStatus;
  phase: Phase;
  attempts: Attempt[];
  /** Set once CLOSE succeeds. Absence of this is what break-it.ts demonstrates. */
  evidence?: Evidence;
  /** Populated when status is "dropped" or "blocked" — never silent. */
  dropReason?: string;
  targetFile?: string;
  /** Explicit human escape hatch: git history of a drop stays intact, but a
   * reopen record after it lets the unit be attempted again. */
  reopens?: { at: string; reason: string }[];
}

/** The success contract for one unit. Every field here must be independently
 * checkable by a script — none of them is "the model said so." */
export interface Evidence {
  /** sha256 of the raw Playwright JSON report, not a hand-written marker file. */
  reportHash: string;
  reportPath: string;
  assertionParity: { covered: number; total: number; dropped: DroppedAssertion[] };
  conventionsPassed: boolean;
  recordedAt: string;
}

export interface DroppedAssertion {
  sourceAssertion: string;
  reason: string;
}

/** A principle is either enforced by a script (the engine refuses to proceed)
 * or advisory (shown to the model and the human reviewer, never gates). See
 * principles.md and the discussion of why a check must be one or the other. */
export interface Principle {
  id: string;
  text: string;
  enforcement: "scripted" | "advisory";
}

/** One landmine, learned the hard way. Curated by a human from the
 * retrospective phase's proposals — never auto-appended. */
export interface Gotcha {
  id: string;
  text: string;
  seenCount: number;
}
