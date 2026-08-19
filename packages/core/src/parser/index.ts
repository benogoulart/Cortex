import type { FileEntry } from "../types/index.js";

export type ParseMode = "symbols" | "imports" | "all";

export interface Parser {
  parseFile(file: FileEntry, content: string): void;
}

let parserInstance: Parser | null = null;

export function getParser(): Parser {
  if (!parserInstance) {
    parserInstance = createFallbackParser();
  }
  return parserInstance;
}

export function setParser(parser: Parser): void {
  parserInstance = parser;
}

function createFallbackParser(): Parser {
  return {
    parseFile(file: FileEntry, content: string): void {
      file.symbols = extractSymbolsFallback(content);
      file.imports = extractImportsFallback(content);
      file.exports = extractExportsFallback(content);
    },
  };
}

function extractSymbolsFallback(content: string): FileEntry["symbols"] {
  const symbols: FileEntry["symbols"] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    const classMatch = line.match(
      /^(export\s+)?(abstract\s+)?class\s+(\w+)/
    );
    if (classMatch) {
      symbols.push({
        name: classMatch[3],
        kind: "class",
        line: lineNum,
        exported: !!classMatch[1],
      });
      continue;
    }

    const interfaceMatch = line.match(/^(export\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      symbols.push({
        name: interfaceMatch[2],
        kind: "interface",
        line: lineNum,
        exported: !!interfaceMatch[1],
      });
      continue;
    }

    const typeMatch = line.match(/^(export\s+)?type\s+(\w+)/);
    if (typeMatch) {
      symbols.push({
        name: typeMatch[2],
        kind: "type",
        line: lineNum,
        exported: !!typeMatch[1],
      });
      continue;
    }

    const enumMatch = line.match(/^(export\s+)?(const\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      symbols.push({
        name: enumMatch[3],
        kind: "enum",
        line: lineNum,
        exported: !!enumMatch[1],
      });
      continue;
    }

    const fnMatch = line.match(
      /^(export\s+)?(async\s+)?function\s+(\w+)/
    );
    if (fnMatch) {
      symbols.push({
        name: fnMatch[3],
        kind: "function",
        line: lineNum,
        exported: !!fnMatch[1],
      });
      continue;
    }

    const constMatch = line.match(
      /^(export\s+)?(const|let|var)\s+(\w+)\s*[=:]/
    );
    if (constMatch) {
      symbols.push({
        name: constMatch[3],
        kind: constMatch[2] === "const" ? "constant" : "variable",
        line: lineNum,
        exported: !!constMatch[1],
      });
      continue;
    }
  }

  return symbols;
}

function extractImportsFallback(content: string): string[] {
  const imports: string[] = [];
  const importRegex =
    /^import\s+.*?from\s+['"]([^'"]+)['"]/gm;
  const requireRegex =
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

function extractExportsFallback(content: string): string[] {
  const exports: string[] = [];
  const exportRegex =
    /^export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/gm;

  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  const reExportRegex = /^export\s+\*\s+from\s+['"]([^'"]+)['"]/gm;
  while ((match = reExportRegex.exec(content)) !== null) {
    exports.push(`* from ${match[1]}`);
  }

  return exports;
}
