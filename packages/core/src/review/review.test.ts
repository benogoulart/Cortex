import { describe, it, expect } from "vitest";
import { parseDiff, reviewDiff } from "./index.js";

const SINGLE_FILE_DIFF = `diff --git a/src/utils.ts b/src/utils.ts
new file mode 100644
--- /dev/null
+++ b/src/utils.ts
@@ -0,0 +1,5 @@
+export function helper() {
+  return true;
+}
+
+export const x = 1;
`;

const MULTI_FILE_DIFF = `diff --git a/src/controller.ts b/src/controller.ts
--- a/src/controller.ts
+++ b/src/controller.ts
@@ -1,3 +1,6 @@
+import { UserRepository } from '../repo/UserRepository';
+import knex from 'knex';
+
 export class UserController {
+  const password = "admin123";
 }
`;

const SECRET_DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,2 +1,3 @@
+const apiKey = "sk-1234567890abcdef";
+const token = "ghp_ABCDEFGHIJKLMNOP";
`;

const XSS_DIFF = `diff --git a/src/render.tsx b/src/render.tsx
--- a/src/render.tsx
+++ b/src/render.tsx
@@ -1,2 +1,3 @@
+element.innerHTML = userInput;
+document.write(content);
`;

const QUALITY_DIFF = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
+const x: any = getData();
+console.log(x);
+// TODO: fix this later
+const longLine = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
`;

const LARGE_DIFF = (() => {
  const lines = [
    "diff --git a/src/big.ts b/src/big.ts",
    "--- a/src/big.ts",
    "+++ b/src/big.ts",
    "@@ -1,0 +1,55 @@",
  ];
  for (let i = 0; i < 55; i++) {
    lines.push("+line" + i + "() { " + "  ".repeat(6) + "deep() { " + "  ".repeat(6) + "deeper() {} } }");
  }
  return lines.join("\n");
})();

describe("parseDiff", () => {
  it("parses a single file diff", () => {
    const result = parseDiff(SINGLE_FILE_DIFF);
    expect(result.summary.files).toHaveLength(1);
    expect(result.summary.files[0].file).toBe("src/utils.ts");
    expect(result.summary.files[0].status).toBe("added");
    expect(result.summary.totalAdditions).toBe(5);
  });

  it("parses a multi-file diff", () => {
    const result = parseDiff(MULTI_FILE_DIFF);
    expect(result.summary.files).toHaveLength(1);
    expect(result.summary.totalAdditions).toBeGreaterThan(0);
  });

  it("returns empty for empty diff", () => {
    const result = parseDiff("");
    expect(result.summary.files).toHaveLength(0);
    expect(result.hunks).toHaveLength(0);
  });
});

describe("reviewDiff", () => {
  it("detects architecture violations", () => {
    const result = reviewDiff(null, MULTI_FILE_DIFF);
    const archFindings = result.findings.filter((f) => f.category === "architecture");
    expect(archFindings.length).toBeGreaterThan(0);
  });

  it("detects hardcoded secrets", () => {
    const result = reviewDiff(null, SECRET_DIFF);
    const secFindings = result.findings.filter((f) => f.category === "security");
    expect(secFindings.length).toBeGreaterThanOrEqual(2);
    expect(secFindings.some((f) => f.message.includes("API key"))).toBe(true);
    expect(secFindings.some((f) => f.message.includes("secret"))).toBe(true);
  });

  it("detects XSS patterns", () => {
    const result = reviewDiff(null, XSS_DIFF);
    const secFindings = result.findings.filter((f) => f.category === "security");
    expect(secFindings.some((f) => f.message.includes("innerHTML"))).toBe(true);
  });

  it("detects quality issues", () => {
    const result = reviewDiff(null, QUALITY_DIFF);
    const qualityFindings = result.findings.filter((f) => f.category === "quality");
    expect(qualityFindings.some((f) => f.message.includes("any"))).toBe(true);
    expect(qualityFindings.some((f) => f.message.includes("Console"))).toBe(true);
    expect(qualityFindings.some((f) => f.message.includes("TODO"))).toBe(true);
  });

  it("detects complexity in large additions", () => {
    const result = reviewDiff(null, LARGE_DIFF);
    const complexityFindings = result.findings.filter((f) => f.category === "complexity");
    expect(complexityFindings.length).toBeGreaterThan(0);
  });

  it("calculates score correctly", () => {
    const cleanResult = reviewDiff(null, SINGLE_FILE_DIFF);
    expect(cleanResult.score).toBeGreaterThan(80);
    expect(cleanResult.score).toBeLessThanOrEqual(100);

    const dirtyResult = reviewDiff(null, SECRET_DIFF + MULTI_FILE_DIFF);
    expect(dirtyResult.score).toBeLessThan(80);
  });

  it("returns correct stats", () => {
    const result = reviewDiff(null, SECRET_DIFF);
    expect(result.stats.totalFindings).toBe(result.findings.length);
    expect(result.stats.critical + result.stats.warnings + result.stats.info).toBe(
      result.findings.length
    );
  });
});
