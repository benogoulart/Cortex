import fg from "fast-glob";
import { readFileSync, statSync } from "node:fs";
import { relative, extname } from "node:path";
import ignore from "ignore";
import type { Language, FileEntry } from "../types/index.js";

const EXT_MAP: Record<string, Language> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
};

const DEFAULT_IGNORE = [
  "node_modules",
  "dist",
  "build",
  ".git",
  ".next",
  ".nuxt",
  "coverage",
  "*.min.js",
  "*.min.css",
];

function detectLanguage(filePath: string): Language {
  const ext = extname(filePath);
  return EXT_MAP[ext] ?? "unknown";
}

export interface ScanOptions {
  root: string;
  include?: string[];
  ignore?: string[];
}

export async function scanFiles(options: ScanOptions): Promise<FileEntry[]> {
  const { root, include = ["**/*"], ignore: customIgnore = [] } = options;
  const ignorePatterns = [...DEFAULT_IGNORE, ...customIgnore];
  const ig = ignore().add(ignorePatterns);

  const patterns = include.map((p) => (p.startsWith("!") ? p : `!${p}`));

  const entries = await fg(include, {
    cwd: root,
    absolute: false,
    dot: false,
    ignore: ignorePatterns,
    onlyFiles: true,
  });

  const files: FileEntry[] = [];

  for (const entry of entries) {
    if (ig.ignores(entry)) continue;

    const language = detectLanguage(entry);
    if (language === "unknown") continue;

    const fullPath = `${root}/${entry}`;
    const stat = statSync(fullPath);

    let content: string;
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
      exports: [],
    });
  }

  return files;
}
