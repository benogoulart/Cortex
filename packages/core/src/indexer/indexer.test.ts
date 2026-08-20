import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scanFiles } from "./index.js";

const TEST_DIR = join(import.meta.dirname ?? ".", "__test_indexer__");

beforeEach(() => {
  mkdirSync(join(TEST_DIR, "src"), { recursive: true });
  mkdirSync(join(TEST_DIR, "node_modules"), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("scanFiles", () => {
  it("scans TypeScript files", async () => {
    writeFileSync(join(TEST_DIR, "src", "app.ts"), "export const x = 1;");
    const files = await scanFiles({ root: TEST_DIR, include: ["src/**/*"] });
    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe("src/app.ts");
    expect(files[0].language).toBe("typescript");
  });

  it("scans JavaScript files", async () => {
    writeFileSync(join(TEST_DIR, "src", "lib.js"), "module.exports = {};");
    const files = await scanFiles({ root: TEST_DIR, include: ["src/**/*"] });
    expect(files).toHaveLength(1);
    expect(files[0].language).toBe("javascript");
  });

  it("ignores node_modules by default", async () => {
    writeFileSync(join(TEST_DIR, "node_modules", "pkg.js"), "export default {};");
    writeFileSync(join(TEST_DIR, "src", "app.ts"), "export const x = 1;");
    const files = await scanFiles({ root: TEST_DIR, include: ["**/*"] });
    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe("src/app.ts");
  });

  it("skips unknown file types", async () => {
    writeFileSync(join(TEST_DIR, "src", "readme.md"), "# Hello");
    writeFileSync(join(TEST_DIR, "src", "app.ts"), "export const x = 1;");
    const files = await scanFiles({ root: TEST_DIR, include: ["src/**/*"] });
    expect(files).toHaveLength(1);
  });

  it("returns correct file metadata", async () => {
    const content = "export const a = 1;\nexport const b = 2;\n";
    writeFileSync(join(TEST_DIR, "src", "data.ts"), content);
    const files = await scanFiles({ root: TEST_DIR, include: ["src/**/*"] });
    expect(files[0].lines).toBe(3);
    expect(files[0].size).toBeGreaterThan(0);
    expect(files[0].symbols).toEqual([]);
    expect(files[0].imports).toEqual([]);
    expect(files[0].exports).toEqual([]);
  });

  it("returns empty for no matching files", async () => {
    const files = await scanFiles({ root: TEST_DIR, include: ["src/**/*"] });
    expect(files).toHaveLength(0);
  });
});
