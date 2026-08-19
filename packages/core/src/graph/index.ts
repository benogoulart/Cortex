import type { FileEntry, DependencyEdge, DependencyAnalysis, ContextResult, Symbol } from "../types/index.js";

export interface DependencyGraph {
  edges: DependencyEdge[];
  adjacency: Map<string, Set<string>>;
  reverseAdjacency: Map<string, Set<string>>;
}

export function buildGraph(files: FileEntry[]): DependencyGraph {
  const edges: DependencyEdge[] = [];
  const adjacency = new Map<string, Set<string>>();
  const reverseAdjacency = new Map<string, Set<string>>();

  for (const file of files) {
    for (const imp of file.imports) {
      const resolved = resolveImport(imp, file.relativePath);
      if (resolved) {
        edges.push({
          from: file.relativePath,
          to: resolved,
          type: "import",
        });

        if (!adjacency.has(file.relativePath)) {
          adjacency.set(file.relativePath, new Set());
        }
        adjacency.get(file.relativePath)!.add(resolved);

        if (!reverseAdjacency.has(resolved)) {
          reverseAdjacency.set(resolved, new Set());
        }
        reverseAdjacency.get(resolved)!.add(file.relativePath);
      }
    }
  }

  return { edges, adjacency, reverseAdjacency };
}

function resolveImport(importPath: string, fromFile: string): string | null {
  if (importPath.startsWith(".")) {
    const dir = fromFile.split("/").slice(0, -1).join("/");
    const resolved = normalizePath(`${dir}/${importPath}`);
    return resolved;
  }

  if (importPath.startsWith("@/") || importPath.startsWith("~/")) {
    return importPath;
  }

  return null;
}

function normalizePath(path: string): string {
  const parts = path.split("/");
  const normalized: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      normalized.pop();
    } else if (part !== "." && part !== "") {
      normalized.push(part);
    }
  }

  let result = normalized.join("/");

  if (!result.match(/\.\w+$/)) {
    for (const ext of [".ts", ".tsx", ".js", ".jsx", ".json", "/index.ts", "/index.js"]) {
      result = result + ext;
      break;
    }
  }

  return result;
}

export function findEntryPoints(graph: DependencyGraph): string[] {
  const allFroms = new Set(graph.edges.map((e) => e.from));
  const allTos = new Set(graph.edges.map((e) => e.to));

  const entryPoints: string[] = [];
  for (const from of allFroms) {
    if (!allTos.has(from)) {
      entryPoints.push(from);
    }
  }

  return entryPoints;
}

export function findDependencies(
  graph: DependencyGraph,
  file: string
): string[] {
  const deps = graph.adjacency.get(file);
  return deps ? Array.from(deps) : [];
}

export function findDependents(
  graph: DependencyGraph,
  file: string
): string[] {
  const deps = graph.reverseAdjacency.get(file);
  return deps ? Array.from(deps) : [];
}

export function findTransitiveDependencies(
  graph: DependencyGraph,
  file: string,
  maxDepth: number = 10
): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function dfs(current: string, depth: number) {
    if (depth >= maxDepth) return;
    const deps = graph.adjacency.get(current);
    if (!deps) return;

    for (const dep of deps) {
      if (!visited.has(dep)) {
        visited.add(dep);
        result.push(dep);
        dfs(dep, depth + 1);
      }
    }
  }

  dfs(file, 0);
  return result;
}

export function findTransitiveDependents(
  graph: DependencyGraph,
  file: string,
  maxDepth: number = 10
): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function dfs(current: string, depth: number) {
    if (depth >= maxDepth) return;
    const deps = graph.reverseAdjacency.get(current);
    if (!deps) return;

    for (const dep of deps) {
      if (!visited.has(dep)) {
        visited.add(dep);
        result.push(dep);
        dfs(dep, depth + 1);
      }
    }
  }

  dfs(file, 0);
  return result;
}

export function detectCycles(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string) {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart).concat(node));
      }
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const deps = graph.adjacency.get(node);
    if (deps) {
      for (const dep of deps) {
        dfs(dep);
      }
    }

    path.pop();
    inStack.delete(node);
  }

  for (const [node] of graph.adjacency) {
    dfs(node);
  }

  return cycles;
}

export function computeImpactScores(graph: DependencyGraph): Map<string, number> {
  const scores = new Map<string, number>();

  for (const [node] of graph.adjacency) {
    const dependents = findTransitiveDependents(graph, node);
    scores.set(node, dependents.length);
  }

  for (const [node] of graph.reverseAdjacency) {
    if (!scores.has(node)) {
      scores.set(node, 0);
    }
    const deps = findTransitiveDependencies(graph, node);
    const currentScore = scores.get(node) ?? 0;
    scores.set(node, currentScore + deps.length * 0.5);
  }

  return scores;
}

export function computeCriticalPath(graph: DependencyGraph): string[] {
  const entryPoints = findEntryPoints(graph);
  if (entryPoints.length === 0) return [];

  const scores = computeImpactScores(graph);

  let bestPath: string[] = [];
  let bestScore = -1;

  for (const ep of entryPoints) {
    const transitiveDeps = findTransitiveDependencies(graph, ep);
    let score = 0;
    for (const dep of transitiveDeps) {
      score += scores.get(dep) ?? 0;
    }

    if (score > bestScore) {
      bestScore = score;
      bestPath = [ep, ...transitiveDeps];
    }
  }

  return bestPath;
}

export function analyzeDependencies(graph: DependencyGraph): DependencyAnalysis {
  const cycles = detectCycles(graph);
  const impactScores = computeImpactScores(graph);
  const criticalPath = computeCriticalPath(graph);

  const transitiveDeps = new Map<string, string[]>();
  for (const [node] of graph.adjacency) {
    transitiveDeps.set(node, findTransitiveDependencies(graph, node));
  }

  return {
    cycles,
    transitiveDeps,
    impactScores,
    criticalPath,
  };
}

export function buildContext(
  files: FileEntry[],
  graph: DependencyGraph,
  relevantFiles: { file: FileEntry; relevance: number; matchedSymbols: Symbol[] }[],
  maxDepth: number = 3
): ContextResult[] {
  const results: ContextResult[] = [];
  const impactScores = computeImpactScores(graph);

  for (const { file, relevance, matchedSymbols } of relevantFiles) {
    const directDeps = findDependencies(graph, file.relativePath);
    const directDependents = findDependents(graph, file.relativePath);

    const transitiveDeps = findTransitiveDependencies(graph, file.relativePath, maxDepth);

    const impactScore = impactScores.get(file.relativePath) ?? 0;

    results.push({
      file: file.relativePath,
      relevance,
      matchedSymbols,
      dependencies: directDeps,
      dependents: directDependents,
      transitiveDependencies: transitiveDeps,
      impactScore,
    });
  }

  return results;
}
