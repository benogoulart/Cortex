import { describe, it, expect } from "vitest";
import { generatePlan } from "../planner/index.js";
import type { ProjectIndex } from "../types/index.js";

function makeIndex(
  files: { relativePath: string; symbols?: string[]; imports?: string[] }[]
): ProjectIndex {
  return {
    version: "1.0.0",
    project: { name: "test", root: "/test", analyzedAt: new Date().toISOString(), stats: { totalFiles: files.length, totalLines: 1000, typescript: files.length, javascript: 0, json: 0 } },
    files: files.map((f) => ({
      path: `/test/${f.relativePath}`,
      relativePath: f.relativePath,
      language: "typescript" as const,
      lines: 100,
      size: 1000,
      symbols: (f.symbols ?? []).map((s) => ({
        name: s,
        kind: "function" as const,
        line: 1,
        exported: true,
      })),
      imports: f.imports ?? [],
      exports: [],
    })),
    graph: { edges: [] },
  };
}

describe("generatePlan", () => {
  it("generates a plan with phases", () => {
    const index = makeIndex([
      { relativePath: "src/auth.ts", symbols: ["login", "logout"] },
      { relativePath: "src/db.ts", symbols: ["connect"] },
    ]);
    const plan = generatePlan(index, "add user authentication");
    expect(plan.title).toBeTruthy();
    expect(plan.phases.length).toBeGreaterThan(0);
    expect(plan.totalTasks).toBeGreaterThan(0);
    expect(plan.risk).toBeDefined();
  });

  it("identifies affected modules", () => {
    const index = makeIndex([
      { relativePath: "src/auth.ts", symbols: ["login"] },
    ]);
    const plan = generatePlan(index, "implement login");
    expect(plan.affectedModules.length).toBeGreaterThan(0);
  });

  it("generates unique IDs", () => {
    const index = makeIndex([
      { relativePath: "src/a.ts", symbols: ["func"] },
    ]);
    const plan1 = generatePlan(index, "task one");
    const plan2 = generatePlan(index, "task two");
    expect(plan1.id).not.toBe(plan2.id);
  });

  it("includes risk factors", () => {
    const index = makeIndex([
      { relativePath: "src/a.ts", symbols: ["a"] },
      { relativePath: "src/b.ts", symbols: ["b"] },
      { relativePath: "src/c.ts", symbols: ["c"] },
    ]);
    const plan = generatePlan(index, "add payment system");
    expect(plan.riskFactors.length).toBeGreaterThan(0);
  });
});
