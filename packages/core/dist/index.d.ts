type Language = "typescript" | "javascript" | "json" | "unknown";
type SymbolKind = "class" | "function" | "variable" | "constant" | "interface" | "type" | "enum" | "method" | "export";
interface Symbol {
    name: string;
    kind: SymbolKind;
    line: number;
    endLine?: number;
    exported: boolean;
}
interface FileEntry {
    path: string;
    relativePath: string;
    language: Language;
    lines: number;
    size: number;
    symbols: Symbol[];
    imports: string[];
    exports: string[];
}
interface DependencyEdge {
    from: string;
    to: string;
    type: "import" | "require" | "dynamic";
}
interface ProjectStats {
    totalFiles: number;
    totalLines: number;
    languages: Record<Language, number>;
}
interface ProjectIndex {
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
interface AnalyzeResult {
    stats: ProjectStats;
    entryPoints: string[];
    architecture: Record<string, string[]>;
    topSymbols: {
        file: string;
        symbols: Symbol[];
    }[];
}
interface SearchResult {
    file: string;
    relevance: number;
    matchedSymbols: Symbol[];
}

interface ScanOptions {
    root: string;
    include?: string[];
    ignore?: string[];
}
declare function scanFiles(options: ScanOptions): Promise<FileEntry[]>;

interface Parser {
    parseFile(file: FileEntry, content: string): void;
}
declare function getParser(): Parser;
declare function setParser(parser: Parser): void;

interface DependencyGraph {
    edges: DependencyEdge[];
    adjacency: Map<string, Set<string>>;
}
declare function buildGraph(files: FileEntry[]): DependencyGraph;
declare function findEntryPoints(graph: DependencyGraph): string[];
declare function findDependencies(graph: DependencyGraph, file: string): string[];
declare function findDependents(graph: DependencyGraph, file: string): string[];

declare function extractSymbols(content: string, language: FileEntry["language"]): Symbol[];

declare const CORTEX_DIR = ".cortex";
declare const INDEX_FILE = "index.json";
interface InitOptions {
    root: string;
    include?: string[];
    ignore?: string[];
}
declare function initIndex(options: InitOptions): Promise<ProjectIndex>;
declare function loadIndex(root: string): ProjectIndex | null;

export { type AnalyzeResult, CORTEX_DIR, type DependencyEdge, type FileEntry, INDEX_FILE, type InitOptions, type Language, type ProjectIndex, type ProjectStats, type SearchResult, type Symbol, type SymbolKind, buildGraph, extractSymbols, findDependencies, findDependents, findEntryPoints, getParser, initIndex, loadIndex, scanFiles, setParser };
