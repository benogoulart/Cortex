import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ProjectIndex, FileEntry, ProjectStats, Language, SearchResult, ContextResult, DependencyAnalysis, MemoryEntry, MemoryCategory, MemoryStore, ExecutionPlan, PlanTask, PlanPhase, AffectedModule, TaskPriority, ReviewResult, ReviewFinding, ReviewSeverity, ReviewCategory, DiffSummary, DiffHunk } from "./types/index.js";
import { scanFiles } from "./indexer/index.js";
import { getParser } from "./parser/index.js";
import { buildGraph, findEntryPoints, analyzeDependencies, buildContext } from "./graph/index.js";
import { parseQuery, semanticSearch, buildSemanticIndex } from "./search/index.js";
import { generatePlan } from "./planner/index.js";
import { getDiff, getStagedDiff, parseDiff, reviewDiff } from "./review/index.js";

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

  const projectName = root.split("/").pop() ?? root.split("\\").pop() ?? "unknown";

  const index: ProjectIndex = {
    version: "0.6.0",
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

export function searchFiles(
  index: ProjectIndex,
  query: string,
  limit?: number
): SearchResult[] {
  const semanticQuery = parseQuery(query);
  return semanticSearch(index.files, semanticQuery, limit);
}

export function getContext(
  index: ProjectIndex,
  topic: string,
  maxDepth: number = 3
): {
  results: ContextResult[];
  analysis: DependencyAnalysis;
} {
  const graph = buildGraph(index.files);
  const semanticQuery = parseQuery(topic);
  const searchResults = semanticSearch(index.files, semanticQuery, 10);

  const relevantFiles = searchResults.map((r) => {
    const file = index.files.find((f) => f.relativePath === r.file)!;
    return {
      file,
      relevance: r.relevance,
      matchedSymbols: r.matchedSymbols,
    };
  });

  const results = buildContext(index.files, graph, relevantFiles, maxDepth);
  const analysis = analyzeDependencies(graph);

  return { results, analysis };
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
export {
  buildGraph,
  findEntryPoints,
  findDependencies,
  findDependents,
  findTransitiveDependencies,
  findTransitiveDependents,
  detectCycles,
  computeImpactScores,
  computeCriticalPath,
  analyzeDependencies,
} from "./graph/index.js";
export { extractSymbols } from "./symbols/index.js";
export { parseQuery, semanticSearch, buildSemanticIndex } from "./search/index.js";
export { generatePlan } from "./planner/index.js";
export { getDiff, getStagedDiff, parseDiff, reviewDiff } from "./review/index.js";
export {
  loadMemory,
  saveMemory,
  addMemoryEntry,
  deleteMemoryEntry,
  getMemoryEntry,
  searchMemory,
  listMemory,
  detectCategory,
  extractTags,
  MEMORY_FILE,
  MEMORY_VERSION,
} from "./memory/index.js";
export type {
  ProjectIndex,
  FileEntry,
  Symbol,
  DependencyEdge,
  ProjectStats,
  Language,
  SymbolKind,
  AnalyzeResult,
  SearchResult,
  ContextResult,
  DependencyAnalysis,
  SemanticQuery,
  MemoryEntry,
  MemoryCategory,
  MemoryStore,
  ExecutionPlan,
  PlanTask,
  PlanPhase,
  AffectedModule,
  TaskPriority,
  ReviewResult,
  ReviewFinding,
  ReviewSeverity,
  ReviewCategory,
  DiffSummary,
  DiffHunk,
} from "./types/index.js";
