import type { FileEntry, DependencyEdge } from "../types/index.js";

export interface DependencyGraph {
  edges: DependencyEdge[];
  adjacency: Map<string, Set<string>>;
}

export function buildGraph(files: FileEntry[]): DependencyGraph {
  const edges: DependencyEdge[] = [];
  const adjacency = new Map<string, Set<string>>();

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
      }
    }
  }

  return { edges, adjacency };
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
  const dependents: string[] = [];
  for (const [from, tos] of graph.adjacency) {
    if (tos.has(file)) {
      dependents.push(from);
    }
  }
  return dependents;
}
