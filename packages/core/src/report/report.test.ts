import { describe, it, expect, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateUnifiedReport, createSnapshot } from "./index.js";
import type { AgentContext } from "../agents/types.js";
import type { ProjectIndex, DependencyAnalysis, MemoryStore } from "../types/index.js";

const TEST_DIR = join(import.meta.dirname ?? ".", "__test_report__");

function makeContext(): AgentContext {
  mkdirSync(join(TEST_DIR, "src"), { recursive: true });
  writeFileSync(join(TEST_DIR, "src", "app.ts"), "export const x = 1;");
  writeFileSync(join(TEST_DIR, "src", "utils.ts"), "export const y = 2;");

  const index: ProjectIndex = {
    version: "1.0.0",
    project: { name: "test", root: TEST_DIR, analyzedAt: new Date().toISOString(), stats: { totalFiles: 2, totalLines: 2, languages: { typescript: 2, javascript: 0, json: 0, unknown: 0 } } },
    files: [
      { path: join(TEST_DIR, "src/app.ts"), relativePath: "src/app.ts", language: "typescript", lines: 1, size: 10, symbols: [], imports: [], exports: [] },
      { path: join(TEST_DIR, "src/utils.ts"), relativePath: "src/utils.ts", language: "typescript", lines: 1, size: 10, symbols: [], imports: [], exports: [] },
    ],
    graph: { edges: [] },
  };

  const analysis: DependencyAnalysis = {
    cycles: [],
    transitiveDeps: {},
    impactScores: {},
    criticalPath: [],
  };

  const memory: MemoryStore = { version: "1.0.0", entries: [] };

  return { index, analysis, memory, root: TEST_DIR };
}

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("generateUnifiedReport", () => {
  it("returns a report with valid structure", () => {
    const report = generateUnifiedReport(makeContext());
    expect(report.id).toMatch(/^report_/);
    expect(report.timestamp).toBeTruthy();
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.agents).toBeDefined();
    expect(report.metadata).toBeDefined();
  });

  it("has correct metadata counts", () => {
    const report = generateUnifiedReport(makeContext());
    expect(report.metadata.filesAnalyzed).toBe(2);
    expect(report.metadata.totalFindings).toBe(
      report.metadata.critical + report.metadata.warnings + report.metadata.info
    );
  });
});

describe("createSnapshot", () => {
  it("creates a snapshot from a report", () => {
    const report = generateUnifiedReport(makeContext());
    const snapshot = createSnapshot(report);
    expect(snapshot.id).toBe(report.id);
    expect(snapshot.timestamp).toBe(report.timestamp);
    expect(snapshot.report).toBe(report);
  });
});
