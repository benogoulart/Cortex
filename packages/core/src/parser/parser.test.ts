import { describe, it, expect, beforeEach } from "vitest";
import { getParser, setParser } from "./index.js";
import type { FileEntry } from "../types/index.js";

function makeFile(relativePath: string): FileEntry {
  return {
    path: `/test/${relativePath}`,
    relativePath,
    language: "typescript",
    lines: 0,
    size: 0,
    symbols: [],
    imports: [],
    exports: [],
  };
}

beforeEach(() => {
  setParser(null as any);
});

describe("getParser / setParser", () => {
  it("returns a parser instance", async () => {
    const parser = await getParser();
    expect(parser).toBeDefined();
    expect(typeof parser.parseFile).toBe("function");
  });

  it("caches parser instance", async () => {
    const p1 = await getParser();
    const p2 = await getParser();
    expect(p1).toBe(p2);
  });

  it("allows setting a custom parser", async () => {
    const customParser = {
      parseFile(file: FileEntry, content: string): void {
        file.symbols = [{ name: "custom", kind: "function", line: 1, exported: true }];
        file.imports = ["custom-module"];
        file.exports = ["custom"];
      },
    };
    setParser(customParser);

    const parser = await getParser();
    const file = makeFile("src/custom.ts");
    parser.parseFile(file, "anything");

    expect(file.symbols).toHaveLength(1);
    expect(file.symbols[0].name).toBe("custom");
    expect(file.imports).toEqual(["custom-module"]);
    expect(file.exports).toEqual(["custom"]);
  });

  it("parseFile extracts imports from ESM syntax", async () => {
    const parser = await getParser();
    const file = makeFile("src/app.ts");
    parser.parseFile(
      file,
      `import { foo } from "./bar";\nimport fs from "node:fs";\nexport const x = 1;`
    );

    expect(file.imports.length).toBeGreaterThanOrEqual(2);
  });

  it("parseFile extracts exports from ESM syntax", async () => {
    const parser = await getParser();
    const file = makeFile("src/mod.ts");
    parser.parseFile(
      file,
      `export function helper() { return 1; }\nexport const CONST = 42;`
    );

    expect(file.exports.length).toBeGreaterThanOrEqual(1);
  });
});
