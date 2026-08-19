import type { FileEntry, Symbol, SearchResult, SemanticQuery } from "../types/index.js";

const DEFAULT_WEIGHTS: SemanticQuery["weights"] = {
  path: 10,
  symbol: 7,
  import: 3,
  export: 2,
  structural: 5,
};

export function buildSemanticIndex(files: FileEntry[]): Map<string, { tf: number; df: number }> {
  const docFreq = new Map<string, number>();
  const totalDocs = files.length;

  for (const file of files) {
    const terms = tokenizeFile(file);
    const uniqueTerms = new Set(terms);
    for (const term of uniqueTerms) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }

  const index = new Map<string, { tf: number; df: number }>();
  for (const [term, df] of docFreq) {
    const idf = Math.log((totalDocs / (df + 1)) + 1);
    index.set(term, { tf: 1, df: idf });
  }

  return index;
}

export function parseQuery(query: string): SemanticQuery {
  const terms = query
    .toLowerCase()
    .split(/[\s\-_/\\]+/)
    .filter((t) => t.length > 1);

  return {
    terms,
    weights: { ...DEFAULT_WEIGHTS },
  };
}

export function semanticSearch(
  files: FileEntry[],
  query: SemanticQuery,
  limit: number = 15
): SearchResult[] {
  const results: SearchResult[] = [];

  for (const file of files) {
    const pathScore = scorePath(file, query.terms);
    const symbolScore = scoreSymbols(file, query.terms);
    const importScore = scoreImports(file, query.terms);
    const exportScore = scoreExports(file, query.terms);
    const structuralScore = scoreStructural(file, query.terms);

    const totalScore =
      pathScore * query.weights.path +
      symbolScore * query.weights.symbol +
      importScore * query.weights.import +
      exportScore * query.weights.export +
      structuralScore * query.weights.structural;

    if (totalScore > 0) {
      const matchedSymbols = file.symbols.filter((sym) =>
        query.terms.some(
          (term) =>
            sym.name.toLowerCase().includes(term) ||
            sym.kind.toLowerCase().includes(term)
        )
      );

      results.push({
        file: file.relativePath,
        relevance: Math.round(totalScore * 100) / 100,
        matchedSymbols,
        breakdown: {
          pathScore,
          symbolScore,
          importScore,
          exportScore,
          structuralScore,
        },
      });
    }
  }

  return results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

function scorePath(file: FileEntry, terms: string[]): number {
  const pathLower = file.relativePath.toLowerCase();
  const pathParts = pathLower.split(/[/\\]/);
  let score = 0;

  for (const term of terms) {
    if (pathLower.includes(term)) {
      score += 2;
    }

    for (const part of pathParts) {
      if (part.includes(term)) {
        score += 1;
      }
    }

    const nameWithoutExt = pathParts[pathParts.length - 1]?.replace(/\.\w+$/, "") ?? "";
    if (nameWithoutExt.includes(term)) {
      score += 1.5;
    }
  }

  return Math.min(score, 10);
}

function scoreSymbols(file: FileEntry, terms: string[]): number {
  let score = 0;

  for (const sym of file.symbols) {
    for (const term of terms) {
      if (sym.name.toLowerCase().includes(term)) {
        score += sym.exported ? 3 : 2;
      }

      if (sym.kind === "class" || sym.kind === "interface") {
        score += 0.5;
      }

      if (sym.signature?.toLowerCase().includes(term)) {
        score += 1;
      }
    }
  }

  return Math.min(score, 10);
}

function scoreImports(file: FileEntry, terms: string[]): number {
  let score = 0;

  for (const imp of file.imports) {
    for (const term of terms) {
      if (imp.toLowerCase().includes(term)) {
        score += 1.5;
      }
    }
  }

  return Math.min(score, 10);
}

function scoreExports(file: FileEntry, terms: string[]): number {
  let score = 0;

  for (const exp of file.exports) {
    for (const term of terms) {
      if (exp.toLowerCase().includes(term)) {
        score += 2;
      }
    }
  }

  return Math.min(score, 10);
}

function scoreStructural(file: FileEntry, terms: string[]): number {
  let score = 0;

  const symbolCount = file.symbols.length;
  if (symbolCount > 10) score += 1;
  if (symbolCount > 5) score += 0.5;

  if (file.lines > 100) score += 1;
  if (file.lines > 300) score += 0.5;

  const classSymbols = file.symbols.filter((s) => s.kind === "class");
  if (classSymbols.length > 0) {
    for (const term of terms) {
      for (const cls of classSymbols) {
        if (cls.name.toLowerCase().includes(term)) {
          score += 2;
        }
      }
    }
  }

  return Math.min(score, 10);
}

function tokenizeFile(file: FileEntry): string[] {
  const tokens: string[] = [];

  const pathParts = file.relativePath.toLowerCase().split(/[/\\._-]/);
  tokens.push(...pathParts.filter((p) => p.length > 1));

  for (const sym of file.symbols) {
    const nameTokens = sym.name
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/\s+/);
    tokens.push(...nameTokens);
  }

  for (const imp of file.imports) {
    const impParts = imp.toLowerCase().split(/[/\\._-]/);
    tokens.push(...impParts.filter((p) => p.length > 1));
  }

  return tokens;
}
