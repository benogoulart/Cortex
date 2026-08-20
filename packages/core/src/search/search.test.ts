import { describe, it, expect } from "vitest";
import { parseQuery, semanticSearch } from "../search/index.js";
import type { FileEntry } from "../types/index.js";

function makeFile(
  relativePath: string,
  symbols: FileEntry["symbols"] = [],
  imports: string[] = [],
  exports: string[] = []
): FileEntry {
  return {
    path: `C:\\project\\${relativePath}`,
    relativePath,
    language: "typescript",
    lines: 100,
    size: 1000,
    symbols,
    imports,
    exports,
  };
}

describe("parseQuery", () => {
  it("splits query into terms", () => {
    const q = parseQuery("auth service");
    expect(q.terms).toEqual(["auth", "service"]);
  });

  it("filters short terms", () => {
    const q = parseQuery("a auth");
    expect(q.terms).toEqual(["auth"]);
  });

  it("lowercases terms", () => {
    const q = parseQuery("AuthService");
    expect(q.terms).toEqual(["authservice"]);
  });
});

describe("semanticSearch", () => {
  const files = [
    makeFile(
      "src/auth/AuthService.ts",
      [
        { name: "AuthService", kind: "class", line: 1, exported: true },
        { name: "validate", kind: "function", line: 10, exported: true },
      ],
      ["./UserRepository"],
      ["AuthService"]
    ),
    makeFile(
      "src/utils/helpers.ts",
      [
        { name: "formatDate", kind: "function", line: 1, exported: true },
      ],
      [],
      ["formatDate"]
    ),
  ];

  it("returns matching files sorted by relevance", () => {
    const query = parseQuery("auth");
    const results = semanticSearch(files, query);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].file).toContain("auth");
  });

  it("matches symbol names", () => {
    const query = parseQuery("validate");
    const results = semanticSearch(files, query);
    expect(results.some((r) => r.file.includes("AuthService"))).toBe(true);
  });

  it("respects limit", () => {
    const query = parseQuery("auth");
    const results = semanticSearch(files, query, 1);
    expect(results).toHaveLength(1);
  });

  it("returns empty for no match", () => {
    const files: FileEntry[] = [];
    const query = parseQuery("xyznonexistent");
    const results = semanticSearch(files, query);
    expect(results).toHaveLength(0);
  });
});
