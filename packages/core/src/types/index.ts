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

export type ReviewSeverity = "critical" | "warning" | "info";

export type ReviewCategory =
  | "architecture"
  | "security"
  | "testing"
  | "complexity"
  | "quality";

export interface ReviewFinding {
  id: string;
  severity: ReviewSeverity;
  category: ReviewCategory;
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export interface DiffHunk {
  file: string;
  additions: number;
  deletions: number;
  lines: { type: "add" | "remove" | "context"; content: string; lineNum: number }[];
}

export interface DiffSummary {
  files: { file: string; additions: number; deletions: number; status: "added" | "modified" | "deleted" | "renamed" }[];
  totalAdditions: number;
  totalDeletions: number;
}

export interface ReviewResult {
  summary: DiffSummary;
  findings: ReviewFinding[];
  score: number;
  stats: {
    filesChanged: number;
    totalFindings: number;
    critical: number;
    warnings: number;
    info: number;
  };
}

export type AgentName = "architect" | "reviewer" | "security" | "tester";

export interface AgentFinding {
  id: string;
  severity: ReviewSeverity;
  category: string;
  file?: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export interface AgentResult {
  agent: AgentName;
  summary: string;
  findings: AgentFinding[];
  score: number;
  metadata?: Record<string, unknown>;
}

export interface LayerInfo {
  name: string;
  files: string[];
  violations: LayerViolation[];
}

export interface LayerViolation {
  file: string;
  line?: number;
  fromLayer: string;
  toLayer: string;
  message: string;
}

export interface CouplingMetrics {
  instability: Record<string, number>;
  afferentCoupling: Record<string, number>;
  efferentCoupling: Record<string, number>;
}

export interface ArchitecturalReport extends AgentResult {
  layers: LayerInfo[];
  metrics: CouplingMetrics;
  debtScore: number;
}

export interface SecurityFinding extends AgentFinding {
  owaspCategory?: string;
  entropy?: number;
}

export interface OwaspGroup {
  category: string;
  findings: SecurityFinding[];
  risk: "low" | "medium" | "high" | "critical";
}

export interface EndpointInfo {
  path: string;
  hasAuth: boolean;
  sensitivity: "public" | "internal" | "admin";
}

export interface SecurityReport extends AgentResult {
  owaspCategories: OwaspGroup[];
  exposedEndpoints: EndpointInfo[];
  riskScore: number;
}

export interface FileCoverage {
  file: string;
  totalSymbols: number;
  testedSymbols: number;
  coverageRatio: number;
  untestedSymbols: string[];
}

export interface TestSuggestion {
  file: string;
  symbol: string;
  kind: SymbolKind;
  reason: string;
}

export interface TestReport extends AgentResult {
  coverage: FileCoverage[];
  untestedCriticalPaths: string[][];
  suggestions: TestSuggestion[];
}

export interface CortexConfig {
  include: string[];
  ignore: string[];
  layers: Record<string, string[]>;
  securityPatterns: { pattern: string; type: string; owasp: string }[];
  searchWeights: {
    path: number;
    symbol: number;
    import: number;
    export: number;
    structural: number;
  };
  reviewRules: { pattern: string; message: string; severity: ReviewSeverity }[];
}

export interface UnifiedReport {
  id: string;
  timestamp: string;
  overallScore: number;
  agents: AgentResult[];
  perFile: Record<string, AgentFinding[]>;
  prioritizedActions: AgentFinding[];
  metadata: {
    filesAnalyzed: number;
    totalFindings: number;
    critical: number;
    warnings: number;
    info: number;
  };
}

export interface ReportSnapshot {
  id: string;
  timestamp: string;
  report: UnifiedReport;
}

export interface PlanSnapshot {
  id: string;
  planId: string;
  title: string;
  taskDescription: string;
  createdAt: string;
  risk: "low" | "medium" | "high" | "critical";
  totalTasks: number;
  estimatedComplexity: number;
}
