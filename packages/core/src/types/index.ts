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
}
