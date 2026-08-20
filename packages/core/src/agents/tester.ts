import type { AgentContext, Agent } from "./types.js";
import type {
  AgentFinding,
  TestReport,
  FileCoverage,
  TestSuggestion,
  FileEntry,
  Symbol,
} from "../types/index.js";
import { buildGraph } from "../graph/index.js";
import type { DependencyGraph } from "../graph/index.js";

let findingCounter = 0;
function fid(): string {
  return `test_${++findingCounter}`;
}

function mapTestCoverage(
  files: FileEntry[],
  graph: DependencyGraph
): FileCoverage[] {
  const sourceFiles = files.filter(
    (f) => !/(?:test|spec|__tests__)/i.test(f.path) && f.language !== "json"
  );
  const testFiles = files.filter((f) => /(?:test|spec|__tests__)/i.test(f.path));

  const coverage: FileCoverage[] = [];

  for (const file of sourceFiles) {
    const testableSymbols = file.symbols.filter(
      (s) =>
        s.kind === "function" ||
        s.kind === "class" ||
        s.kind === "method" ||
        s.kind === "interface"
    );

    const testedSymbols: string[] = [];

    for (const sym of testableSymbols) {
      const isTested = testFiles.some((tf) => {
        const namesMatch = tf.symbols.some(
          (ts) =>
            ts.name === sym.name ||
            ts.name.toLowerCase().includes(sym.name.toLowerCase()) ||
            sym.name.toLowerCase().includes(ts.name.toLowerCase())
        );
        const pathRelevance = tf.path
          .toLowerCase()
          .includes(file.relativePath.split("/").pop()?.split(".")[0]?.toLowerCase() ?? "");

        return namesMatch || pathRelevance;
      });

      if (isTested) testedSymbols.push(sym.name);
    }

    const untestedSymbols = testableSymbols
      .filter((s) => !testedSymbols.includes(s.name))
      .map((s) => s.name);

    coverage.push({
      file: file.relativePath,
      totalSymbols: testableSymbols.length,
      testedSymbols: testedSymbols.length,
      coverageRatio:
        testableSymbols.length === 0
          ? 1
          : testedSymbols.length / testableSymbols.length,
      untestedSymbols,
    });
  }

  return coverage;
}

function findUntestedCriticalPaths(
  coverage: FileCoverage[],
  graph: DependencyGraph
): string[][] {
  const criticalPaths: string[][] = [];

  const untestedHighImpact = coverage
    .filter((c) => c.coverageRatio < 0.3 && c.totalSymbols > 2)
    .map((c) => c.file);

  for (const file of untestedHighImpact) {
    const dependents = graph.reverseAdjacency.get(file) ?? new Set();
    if (dependents.size > 3) {
      const path = [file, ...Array.from(dependents).slice(0, 3) as string[]];
      criticalPaths.push(path);
    }
  }

  return criticalPaths;
}

function suggestTests(
  coverage: FileCoverage[],
  files: FileEntry[]
): TestSuggestion[] {
  const suggestions: TestSuggestion[] = [];

  for (const cov of coverage) {
    if (cov.coverageRatio >= 0.8) continue;

    const file = files.find((f) => f.relativePath === cov.file);
    if (!file) continue;

    for (const symName of cov.untestedSymbols.slice(0, 5)) {
      const sym = file.symbols.find((s) => s.name === symName);
      if (!sym) continue;

      const reason =
        cov.coverageRatio === 0
          ? `No tests exist for this ${sym.kind}`
          : `One of ${cov.untestedSymbols.length} untested symbols`;

      suggestions.push({
        file: cov.file,
        symbol: sym.name,
        kind: sym.kind,
        reason,
      });
    }
  }

  return suggestions;
}

function computeTestQualityScore(coverage: FileCoverage[]): number {
  if (coverage.length === 0) return 100;

  const avgCoverage =
    coverage.reduce((sum, c) => sum + c.coverageRatio, 0) / coverage.length;
  const fullyTested = coverage.filter((c) => c.coverageRatio >= 0.8).length;
  const testRatio = fullyTested / coverage.length;

  return Math.round(avgCoverage * 60 + testRatio * 40);
}

export function analyzeTests(ctx: AgentContext): TestReport {
  const { index } = ctx;
  const findings: AgentFinding[] = [];
  const graph = buildGraph(index.files);

  const coverage = mapTestCoverage(index.files, graph);
  const untestedCriticalPaths = findUntestedCriticalPaths(coverage, graph);
  const suggestions = suggestTests(coverage, index.files);

  const fullyTested = coverage.filter((c) => c.coverageRatio >= 0.8).length;
  const untested = coverage.filter((c) => c.coverageRatio === 0).length;
  const partial = coverage.filter(
    (c) => c.coverageRatio > 0 && c.coverageRatio < 0.8
  ).length;

  for (const path of untestedCriticalPaths) {
    findings.push({
      id: fid(),
      severity: "warning",
      category: "coverage",
      file: path[0],
      message: `Untested critical path: ${path.join(" → ")}`,
      suggestion: "Add integration tests for this dependency chain",
    });
  }

  for (const cov of coverage) {
    if (cov.coverageRatio === 0 && cov.totalSymbols > 3) {
      findings.push({
        id: fid(),
        severity: "warning",
        category: "coverage",
        file: cov.file,
        message: `${cov.totalSymbols} symbols with no test coverage`,
        suggestion: `Add tests for: ${cov.untestedSymbols.slice(0, 3).join(", ")}`,
      });
    }
  }

  if (ctx.memory) {
    const testConventions = ctx.memory.entries.filter(
      (e) => e.tags.some((t) => ["test", "testing", "coverage", "spec"].includes(t))
    );
    for (const entry of testConventions) {
      findings.push({
        id: fid(),
        severity: "info",
        category: "convention",
        message: `Memory: ${entry.text}`,
        suggestion: "Check if this testing convention is being followed",
      });
    }
  }

  const score = computeTestQualityScore(coverage);

  return {
    agent: "tester",
    summary: `Test coverage: ${fullyTested} fully tested, ${partial} partial, ${untested} untested out of ${coverage.length} source files. Score: ${score}/100.`,
    findings,
    score,
    coverage,
    untestedCriticalPaths,
    suggestions,
  };
}

export const testerAgent: Agent = {
  name: "tester",
  analyze: analyzeTests,
};
