export type Language = "typescript" | "javascript" | "json" | "unknown";

export type SymbolKind =
  | "class"
  | "function"
  | "variable"
  | "constant"
  | "interface"
  | "type"
  | "enum"
  | "method"
  | "export";

export interface Symbol {
  name: string;
  kind: SymbolKind;
  line: number;
  endLine?: number;
  exported: boolean;
  signature?: string;
}

export interface FileEntry {
  path: string;
  relativePath: string;
  language: Language;
  lines: number;
  size: number;
  symbols: Symbol[];
  imports: string[];
  exports: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: "import" | "require" | "dynamic";
}

export interface ProjectStats {
  totalFiles: number;
  totalLines: number;
  languages: Record<Language, number>;
}

export interface ProjectIndex {
  version: string;
  project: {
    name: string;
    root: string;
    analyzedAt: string;
    stats: ProjectStats;
  };
  files: FileEntry[];
  graph: {
    edges: DependencyEdge[];
  };
}

export interface AnalyzeResult {
  stats: ProjectStats;
  entryPoints: string[];
  architecture: Record<string, string[]>;
  topSymbols: { file: string; symbols: Symbol[] }[];
}

export interface SearchResult {
  file: string;
  relevance: number;
  matchedSymbols: Symbol[];
  breakdown: {
    pathScore: number;
    symbolScore: number;
    importScore: number;
    exportScore: number;
    structuralScore: number;
  };
}

export interface ContextResult {
  file: string;
  relevance: number;
  matchedSymbols: Symbol[];
  dependencies: string[];
  dependents: string[];
  transitiveDependencies: string[];
  impactScore: number;
}

export interface DependencyAnalysis {
  cycles: string[][];
  transitiveDeps: Map<string, string[]>;
  impactScores: Map<string, number>;
  criticalPath: string[];
}

export interface SemanticQuery {
  terms: string[];
  weights: {
    path: number;
    symbol: number;
    import: number;
    export: number;
    structural: number;
  };
}

export type MemoryCategory =
  | "decision"
  | "convention"
  | "pattern"
  | "mistake"
  | "task"
  | "note";

export interface MemoryEntry {
  id: string;
  text: string;
  category: MemoryCategory;
  tags: string[];
  createdAt: string;
  context: string[];
}

export interface MemoryStore {
  version: string;
  entries: MemoryEntry[];
}

export type PlanPhase =
  | "discovery"
  | "architecture"
  | "implementation"
  | "testing"
  | "security"
  | "deployment";

export type TaskPriority = "critical" | "high" | "medium" | "low";

export interface PlanTask {
  id: string;
  description: string;
  phase: PlanPhase;
  priority: TaskPriority;
  affectedFiles: string[];
  dependsOn: string[];
  completed: boolean;
}

export interface AffectedModule {
  path: string;
  reason: string;
  risk: "low" | "medium" | "high";
  symbols: string[];
}

export interface ExecutionPlan {
  id: string;
  title: string;
  description: string;
  taskDescription: string;
  createdAt: string;
  risk: "low" | "medium" | "high" | "critical";
  riskFactors: string[];
  affectedModules: AffectedModule[];
  phases: {
    phase: PlanPhase;
    label: string;
    tasks: PlanTask[];
  }[];
  totalTasks: number;
  estimatedComplexity: number;
}
