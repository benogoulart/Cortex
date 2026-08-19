import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ProjectIndex, FileEntry, ProjectStats, Language } from "./types/index.js";
import { scanFiles } from "./indexer/index.js";
import { getParser } from "./parser/index.js";
import { buildGraph, findEntryPoints } from "./graph/index.js";

export const CORTEX_DIR = ".cortex";
export const INDEX_FILE = "index.json";

export interface InitOptions {
  root: string;
  include?: string[];
  ignore?: string[];
}

export async function initIndex(options: InitOptions): Promise<ProjectIndex> {
  const { root, include, ignore } = options;

  const files = await scanFiles({ root, include, ignore });
  const parser = getParser();

  for (const file of files) {
    const content = readFileSync(file.path, "utf-8");
    parser.parseFile(file, content);
  }

  const graph = buildGraph(files);
  const stats = computeStats(files);

  const projectName = root.split("/").pop() ?? "unknown";

  const index: ProjectIndex = {
    version: "0.1.0",
    project: {
      name: projectName,
      root,
      analyzedAt: new Date().toISOString(),
      stats,
    },
    files,
    graph: {
      edges: graph.edges,
    },
  };

  const cortexDir = join(root, CORTEX_DIR);
  if (!existsSync(cortexDir)) {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(cortexDir, { recursive: true });
  }

  writeFileSync(join(cortexDir, INDEX_FILE), JSON.stringify(index, null, 2));

  return index;
}

export function loadIndex(root: string): ProjectIndex | null {
  const indexPath = join(root, CORTEX_DIR, INDEX_FILE);
  if (!existsSync(indexPath)) return null;
  return JSON.parse(readFileSync(indexPath, "utf-8"));
}

function computeStats(files: FileEntry[]): ProjectStats {
  const languages: Record<Language, number> = {
    typescript: 0,
    javascript: 0,
    json: 0,
    unknown: 0,
  };

  let totalLines = 0;

  for (const file of files) {
    languages[file.language]++;
    totalLines += file.lines;
  }

  return {
    totalFiles: files.length,
    totalLines,
    languages,
  };
}

export { scanFiles } from "./indexer/index.js";
export { getParser, setParser } from "./parser/index.js";
export { buildGraph, findEntryPoints, findDependencies, findDependents } from "./graph/index.js";
export { extractSymbols } from "./symbols/index.js";
export type { ProjectIndex, FileEntry, Symbol, DependencyEdge, ProjectStats, Language, SymbolKind, AnalyzeResult, SearchResult } from "./types/index.js";
