import { describe, it, expect, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgent, listAgents, runAgent, runAllAgents } from "./index.js";
import type { AgentContext } from "./types.js";
import type { ProjectIndex, DependencyAnalysis, MemoryStore } from "../types/index.js";

const TEST_DIR = join(import.meta.dirname ?? ".", "__test_agents__");

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

describe("listAgents", () => {
  it("returns all agent names", () => {
    const names = listAgents();
    expect(names).toContain("architect");
    expect(names).toContain("reviewer");
    expect(names).toContain("security");
    expect(names).toContain("tester");
    expect(names).toHaveLength(4);
  });
});

describe("getAgent", () => {
  it("returns agent by name", () => {
    expect(getAgent("architect")).toBeDefined();
    expect(getAgent("security")).toBeDefined();
  });

  it("returns undefined for unknown agent", () => {
    expect(getAgent("unknown" as any)).toBeUndefined();
  });
});

describe("runAgent", () => {
  it("runs a known agent", () => {
    const result = runAgent("architect", makeContext());
    expect(result.agent).toBe("architect");
    expect(typeof result.summary).toBe("string");
    expect(Array.isArray(result.findings)).toBe(true);
    expect(typeof result.score).toBe("number");
  });

  it("returns error for unknown agent", () => {
    const result = runAgent("unknown" as any, makeContext());
    expect(result.score).toBe(0);
    expect(result.summary).toContain("Unknown");
  });
});

describe("runAllAgents", () => {
  it("runs all agents and returns results", () => {
    const results = runAllAgents(makeContext());
    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r.agent).toBeTruthy();
      expect(typeof r.summary).toBe("string");
      expect(Array.isArray(r.findings)).toBe(true);
    }
  });
});
