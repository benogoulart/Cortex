// src/index.ts
import { readFileSync as readFileSync2, writeFileSync, existsSync } from "fs";
import { join } from "path";

// src/indexer/index.ts
import fg from "fast-glob";
import { readFileSync, statSync } from "fs";
import { extname } from "path";
import ignore from "ignore";
var EXT_MAP = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json"
};
var DEFAULT_IGNORE = [
  "node_modules",
  "dist",
  "build",
  ".git",
  ".next",
  ".nuxt",
  "coverage",
  "*.min.js",
  "*.min.css"
];
function detectLanguage(filePath) {
  const ext = extname(filePath);
  return EXT_MAP[ext] ?? "unknown";
}
async function scanFiles(options) {
  const { root, include = ["**/*"], ignore: customIgnore = [] } = options;
  const ignorePatterns = [...DEFAULT_IGNORE, ...customIgnore];
  const ig = ignore().add(ignorePatterns);
  const patterns = include.map((p) => p.startsWith("!") ? p : `!${p}`);
  const entries = await fg(include, {
    cwd: root,
    absolute: false,
    dot: false,
    ignore: ignorePatterns,
    onlyFiles: true
  });
  const files = [];
  for (const entry of entries) {
    if (ig.ignores(entry)) continue;
    const language = detectLanguage(entry);
    if (language === "unknown") continue;
    const fullPath = `${root}/${entry}`;
    const stat = statSync(fullPath);
    let content;
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }
    const lines = content.split("\n").length;
    files.push({
      path: fullPath,
      relativePath: entry,
      language,
      lines,
      size: stat.size,
      symbols: [],
      imports: [],
      exports: []
    });
  }
  return files;
}

// src/parser/index.ts
var parserInstance = null;
function getParser() {
  if (!parserInstance) {
    parserInstance = createFallbackParser();
  }
  return parserInstance;
}
function setParser(parser) {
  parserInstance = parser;
}
function createFallbackParser() {
  return {
    parseFile(file, content) {
      file.symbols = extractSymbolsFallback(content);
      file.imports = extractImportsFallback(content);
      file.exports = extractExportsFallback(content);
    }
  };
}
function extractSymbolsFallback(content) {
  const symbols = [];
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
        exported: !!classMatch[1]
      });
      continue;
    }
    const interfaceMatch = line.match(/^(export\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      symbols.push({
        name: interfaceMatch[2],
        kind: "interface",
        line: lineNum,
        exported: !!interfaceMatch[1]
      });
      continue;
    }
    const typeMatch = line.match(/^(export\s+)?type\s+(\w+)/);
    if (typeMatch) {
      symbols.push({
        name: typeMatch[2],
        kind: "type",
        line: lineNum,
        exported: !!typeMatch[1]
      });
      continue;
    }
    const enumMatch = line.match(/^(export\s+)?(const\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      symbols.push({
        name: enumMatch[3],
        kind: "enum",
        line: lineNum,
        exported: !!enumMatch[1]
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
        exported: !!fnMatch[1]
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
        exported: !!constMatch[1]
      });
      continue;
    }
  }
  return symbols;
}
function extractImportsFallback(content) {
  const imports = [];
  const importRegex = /^import\s+.*?from\s+['"]([^'"]+)['"]/gm;
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}
function extractExportsFallback(content) {
  const exports = [];
  const exportRegex = /^export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/gm;
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

// src/graph/index.ts
function buildGraph(files) {
  const edges = [];
  const adjacency = /* @__PURE__ */ new Map();
  for (const file of files) {
    for (const imp of file.imports) {
      const resolved = resolveImport(imp, file.relativePath);
      if (resolved) {
        edges.push({
          from: file.relativePath,
          to: resolved,
          type: "import"
        });
        if (!adjacency.has(file.relativePath)) {
          adjacency.set(file.relativePath, /* @__PURE__ */ new Set());
        }
        adjacency.get(file.relativePath).add(resolved);
      }
    }
  }
  return { edges, adjacency };
}
function resolveImport(importPath, fromFile) {
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
function normalizePath(path) {
  const parts = path.split("/");
  const normalized = [];
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
function findEntryPoints(graph) {
  const allFroms = new Set(graph.edges.map((e) => e.from));
  const allTos = new Set(graph.edges.map((e) => e.to));
  const entryPoints = [];
  for (const from of allFroms) {
    if (!allTos.has(from)) {
      entryPoints.push(from);
    }
  }
  return entryPoints;
}
function findDependencies(graph, file) {
  const deps = graph.adjacency.get(file);
  return deps ? Array.from(deps) : [];
}
function findDependents(graph, file) {
  const dependents = [];
  for (const [from, tos] of graph.adjacency) {
    if (tos.has(file)) {
      dependents.push(from);
    }
  }
  return dependents;
}

// src/symbols/index.ts
function extractSymbols(content, language) {
  const symbols = [];
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
function extractFromLine(line, lineNum) {
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
      exported: !!classMatch[1]
    };
  }
  const interfaceMatch = trimmed.match(/^(export\s+)?interface\s+(\w+)/);
  if (interfaceMatch) {
    return {
      name: interfaceMatch[2],
      kind: "interface",
      line: lineNum,
      exported: !!interfaceMatch[1]
    };
  }
  const typeMatch = trimmed.match(/^(export\s+)?type\s+(\w+)/);
  if (typeMatch) {
    return {
      name: typeMatch[2],
      kind: "type",
      line: lineNum,
      exported: !!typeMatch[1]
    };
  }
  const enumMatch = trimmed.match(/^(export\s+)?(const\s+)?enum\s+(\w+)/);
  if (enumMatch) {
    return {
      name: enumMatch[3],
      kind: "enum",
      line: lineNum,
      exported: !!enumMatch[1]
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
      exported: !!fnMatch[1]
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
      exported: !!constMatch[1]
    };
  }
  return null;
}

// src/index.ts
var CORTEX_DIR = ".cortex";
var INDEX_FILE = "index.json";
async function initIndex(options) {
  const { root, include, ignore: ignore2 } = options;
  const files = await scanFiles({ root, include, ignore: ignore2 });
  const parser = getParser();
  for (const file of files) {
    const content = readFileSync2(file.path, "utf-8");
    parser.parseFile(file, content);
  }
  const graph = buildGraph(files);
  const stats = computeStats(files);
  const projectName = root.split("/").pop() ?? "unknown";
  const index = {
    version: "0.1.0",
    project: {
      name: projectName,
      root,
      analyzedAt: (/* @__PURE__ */ new Date()).toISOString(),
      stats
    },
    files,
    graph: {
      edges: graph.edges
    }
  };
  const cortexDir = join(root, CORTEX_DIR);
  if (!existsSync(cortexDir)) {
    const { mkdirSync } = await import("fs");
    mkdirSync(cortexDir, { recursive: true });
  }
  writeFileSync(join(cortexDir, INDEX_FILE), JSON.stringify(index, null, 2));
  return index;
}
function loadIndex(root) {
  const indexPath = join(root, CORTEX_DIR, INDEX_FILE);
  if (!existsSync(indexPath)) return null;
  return JSON.parse(readFileSync2(indexPath, "utf-8"));
}
function computeStats(files) {
  const languages = {
    typescript: 0,
    javascript: 0,
    json: 0,
    unknown: 0
  };
  let totalLines = 0;
  for (const file of files) {
    languages[file.language]++;
    totalLines += file.lines;
  }
  return {
    totalFiles: files.length,
    totalLines,
    languages
  };
}
export {
  CORTEX_DIR,
  INDEX_FILE,
  buildGraph,
  extractSymbols,
  findDependencies,
  findDependents,
  findEntryPoints,
  getParser,
  initIndex,
  loadIndex,
  scanFiles,
  setParser
};
