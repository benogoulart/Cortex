import type { FileEntry, Symbol, SymbolKind } from "../types/index.js";

export interface SymbolExtractor {
  extract(content: string, language: FileEntry["language"]): Symbol[];
}

const TS_KEYWORDS = new Set([
  "function",
  "class",
  "interface",
  "type",
  "enum",
  "const",
  "let",
  "var",
  "async",
  "export",
  "default",
  "abstract",
  "extends",
  "implements",
  "new",
  "return",
  "if",
  "else",
  "for",
  "while",
  "switch",
  "case",
  "try",
  "catch",
  "finally",
  "throw",
  "import",
  "from",
  "of",
  "in",
]);

export function extractSymbols(
  content: string,
  language: FileEntry["language"]
): Symbol[] {
  const symbols: Symbol[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (language === "typescript" || language === "javascript") {
      const found = extractFromLine(line, lineNum);
      if (found) symbols.push(found);
    }
  }

  return symbols;
}

function extractFromLine(line: string, lineNum: number): Symbol | null {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
    return null;
  }

  const classMatch = trimmed.match(
    /^(export\s+)?(abstract\s+)?class\s+(\w+)/
  );
  if (classMatch) {
    return {
      name: classMatch[3],
      kind: "class",
      line: lineNum,
      exported: !!classMatch[1],
    };
  }

  const interfaceMatch = trimmed.match(/^(export\s+)?interface\s+(\w+)/);
  if (interfaceMatch) {
    return {
      name: interfaceMatch[2],
      kind: "interface",
      line: lineNum,
      exported: !!interfaceMatch[1],
    };
  }

  const typeMatch = trimmed.match(/^(export\s+)?type\s+(\w+)/);
  if (typeMatch) {
    return {
      name: typeMatch[2],
      kind: "type",
      line: lineNum,
      exported: !!typeMatch[1],
    };
  }

  const enumMatch = trimmed.match(/^(export\s+)?(const\s+)?enum\s+(\w+)/);
  if (enumMatch) {
    return {
      name: enumMatch[3],
      kind: "enum",
      line: lineNum,
      exported: !!enumMatch[1],
    };
  }

  const fnMatch = trimmed.match(
    /^(export\s+)?(async\s+)?function\s+(\w+)/
  );
  if (fnMatch) {
    return {
      name: fnMatch[3],
      kind: "function",
      line: lineNum,
      exported: !!fnMatch[1],
    };
  }

  const constMatch = trimmed.match(
    /^(export\s+)?(const|let|var)\s+(\w+)\s*[=:]/
  );
  if (constMatch) {
    return {
      name: constMatch[3],
      kind: constMatch[2] === "const" ? "constant" : "variable",
      line: lineNum,
      exported: !!constMatch[1],
    };
  }

  return null;
}
