// The adapter seam. This is the entire surface a new source/target pair must
// implement to reuse the engine. Only one adapter ships in this repo
// (adapters/protractor-playwright) — the interface is documented here so a
// second adapter can prove it's a real seam, not a hollow abstraction built
// for an audience of one.

import type { Evidence, Principle, Unit } from "./types.js";

export interface MigrationAdapter {
  /** Parse the source file and return every migratable unit. Text-only —
   * the source suite is read as a specification, never executed. This is
   * what "the old test is the spec" means mechanically: no Protractor
   * install, no old WebDriver, just the file on disk. */
  enumerateUnits(sourceFile: string): Promise<Unit[]>;

  /** Run the target test the implement phase wrote, and return a verdict
   * built from the runner's own authoritative result — never re-derived
   * from exit codes or log scraping. */
  verifyUnit(unit: Unit, targetFile: string): Promise<{
    passed: boolean;
    signature?: string;
    reportPath: string;
  }>;

  /** Compute the evidence contract for a unit that just passed verify+review.
   * Must hash the real report at reportPath; must not be satisfiable by
   * touching a marker file instead of producing a real one. */
  recordEvidence(unit: Unit, targetFile: string, reportPath: string): Promise<Evidence>;

  /** Principles specific to this source/target pair (e.g. locator strategy,
   * assertion-style conventions). Merged with the repo-wide principles.md. */
  principles(): Principle[];

  /** The exact command a human (or a gate) can run to reproduce the evidence
   * independently of the harness. Shown in every gate-failure message. */
  evidenceCommand(unit: Unit): string;
}
