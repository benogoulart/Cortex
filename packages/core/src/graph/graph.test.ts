import { describe, it, expect } from "vitest";
import {
  buildGraph,
  findEntryPoints,
  findDependencies,
  findDependents,
  findTransitiveDependencies,
  detectCycles,
  analyzeDependencies,
} from "../graph/index.js";
import type { FileEntry } from "../types/index.js";

function makeFile(
  relativePath: string,
  imports: string[] = [],
  symbols: FileEntry["symbols"] = []
): FileEntry {
  return {
    path: `C:\\project\\${relativePath}`,
    relativePath,
    language: "typescript",
    lines: 100,
    size: 1000,
    symbols,
    imports,
    exports: [],
  };
}

describe("buildGraph", () => {
  it("builds edges from imports", () => {
    const files = [
      makeFile("src/a.ts", ["./b"]),
      makeFile("src/b.ts"),
    ];
    const graph = buildGraph(files);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toBe("src/a.ts");
    expect(graph.adjacency.get("src/a.ts")?.has("src/b.ts")).toBe(true);
  });

  it("resolves relative imports with ..", () => {
    const files = [
      makeFile("src/deep/nested/c.ts", ["../../utils"]),
      makeFile("src/utils.ts"),
    ];
    const graph = buildGraph(files);
    expect(graph.adjacency.get("src/deep/nested/c.ts")?.has("src/utils.ts")).toBe(true);
  });

  it("handles no imports", () => {
    const files = [makeFile("a.ts"), makeFile("b.ts")];
    const graph = buildGraph(files);
    expect(graph.edges).toHaveLength(0);
  });
});

describe("findEntryPoints", () => {
  it("finds files not imported by others", () => {
    const files = [
      makeFile("src/app.ts", ["./service"]),
      makeFile("src/service.ts", ["./repo"]),
      makeFile("src/repo.ts"),
    ];
    const graph = buildGraph(files);
    const entryPoints = findEntryPoints(graph);
    expect(entryPoints).toContain("src/app.ts");
  });
});

describe("findDependencies / findDependents", () => {
  it("returns direct dependencies", () => {
    const files = [
      makeFile("a.ts", ["./b", "./c"]),
      makeFile("b.ts"),
      makeFile("c.ts"),
    ];
    const graph = buildGraph(files);
    const deps = findDependencies(graph, "a.ts");
    expect(deps).toHaveLength(2);
    expect(deps).toContain("b.ts");
    expect(deps).toContain("c.ts");
  });

  it("returns direct dependents", () => {
    const files = [
      makeFile("a.ts", ["./b"]),
      makeFile("b.ts"),
    ];
    const graph = buildGraph(files);
    const dependents = findDependents(graph, "b.ts");
    expect(dependents).toContain("a.ts");
  });

  it("returns empty for unknown file", () => {
    const graph = buildGraph([]);
    expect(findDependencies(graph, "nope.ts")).toEqual([]);
    expect(findDependents(graph, "nope.ts")).toEqual([]);
  });
});

describe("findTransitiveDependencies", () => {
  it("finds transitive deps", () => {
    const files = [
      makeFile("a.ts", ["./b"]),
      makeFile("b.ts", ["./c"]),
      makeFile("c.ts"),
    ];
    const graph = buildGraph(files);
    const transitive = findTransitiveDependencies(graph, "a.ts");
    expect(transitive).toContain("b.ts");
    expect(transitive).toContain("c.ts");
  });

  it("respects maxDepth", () => {
    const files = [
      makeFile("a.ts", ["./b"]),
      makeFile("b.ts", ["./c"]),
      makeFile("c.ts"),
    ];
    const graph = buildGraph(files);
    const transitive = findTransitiveDependencies(graph, "a.ts", 1);
    expect(transitive).toContain("b.ts");
    expect(transitive).not.toContain("c.ts");
  });
});

describe("detectCycles", () => {
  it("detects circular dependencies", () => {
    const files = [
      makeFile("a.ts", ["./b"]),
      makeFile("b.ts", ["./a"]),
    ];
    const graph = buildGraph(files);
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("returns empty for acyclic graph", () => {
    const files = [
      makeFile("a.ts", ["./b"]),
      makeFile("b.ts"),
    ];
    const graph = buildGraph(files);
    const cycles = detectCycles(graph);
    expect(cycles).toHaveLength(0);
  });
});

describe("analyzeDependencies", () => {
  it("returns full analysis", () => {
    const files = [
      makeFile("a.ts", ["./b"]),
      makeFile("b.ts"),
    ];
    const graph = buildGraph(files);
    const analysis = analyzeDependencies(graph);
    expect(analysis).toHaveProperty("cycles");
    expect(analysis).toHaveProperty("impactScores");
    expect(analysis).toHaveProperty("criticalPath");
    expect(analysis).toHaveProperty("transitiveDeps");
  });
});
