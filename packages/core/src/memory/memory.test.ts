import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  loadMemory,
  saveMemory,
  addMemoryEntry,
  deleteMemoryEntry,
  getMemoryEntry,
  searchMemory,
  listMemory,
  detectCategory,
  extractTags,
} from "../memory/index.js";

const TEST_DIR = join(import.meta.dirname ?? ".", "__test_memory__");

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".cortex"), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("detectCategory", () => {
  it("detects decision", () => {
    expect(detectCategory("use PostgreSQL as the database")).toBe("decision");
  });

  it("detects convention", () => {
    expect(detectCategory("always follow naming conventions")).toBe("convention");
  });

  it("detects mistake", () => {
    expect(detectCategory("avoid using eval()")).toBe("mistake");
  });

  it("defaults to note", () => {
    expect(detectCategory("random text")).toBe("note");
  });
});

describe("extractTags", () => {
  it("extracts meaningful words", () => {
    const tags = extractTags("use repository pattern for database access");
    expect(tags.length).toBeGreaterThan(0);
    expect(tags).toContain("repository");
    expect(tags).toContain("pattern");
  });

  it("filters stop words", () => {
    const tags = extractTags("this is a test with some words");
    expect(tags).not.toContain("this");
    expect(tags).not.toContain("with");
  });
});

describe("addMemoryEntry / loadMemory", () => {
  it("adds and loads an entry", () => {
    const entry = addMemoryEntry(TEST_DIR, "Always use TypeScript strict mode");
    expect(entry.text).toBe("Always use TypeScript strict mode");
    expect(entry.id).toMatch(/^mem_/);

    const store = loadMemory(TEST_DIR);
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0].text).toBe("Always use TypeScript strict mode");
  });

  it("auto-detects category", () => {
    const entry = addMemoryEntry(TEST_DIR, "always follow naming conventions");
    expect(entry.category).toBe("convention");
  });

  it("respects explicit category", () => {
    const entry = addMemoryEntry(TEST_DIR, "some text", "decision");
    expect(entry.category).toBe("decision");
  });
});

describe("deleteMemoryEntry", () => {
  it("deletes existing entry", () => {
    const entry = addMemoryEntry(TEST_DIR, "test entry");
    expect(deleteMemoryEntry(TEST_DIR, entry.id)).toBe(true);
    expect(getMemoryEntry(TEST_DIR, entry.id)).toBeUndefined();
  });

  it("returns false for non-existent", () => {
    expect(deleteMemoryEntry(TEST_DIR, "mem_nonexistent")).toBe(false);
  });
});

describe("searchMemory", () => {
  it("finds matching entries", () => {
    addMemoryEntry(TEST_DIR, "Use PostgreSQL as the database");
    addMemoryEntry(TEST_DIR, "Use React for frontend");
    const results = searchMemory(TEST_DIR, "database");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].text).toContain("PostgreSQL");
  });

  it("returns empty for no match", () => {
    addMemoryEntry(TEST_DIR, "Use React");
    const results = searchMemory(TEST_DIR, "xyznonexistent");
    expect(results).toHaveLength(0);
  });
});

describe("listMemory", () => {
  it("lists all entries", () => {
    addMemoryEntry(TEST_DIR, "first");
    addMemoryEntry(TEST_DIR, "second");
    const entries = listMemory(TEST_DIR);
    expect(entries).toHaveLength(2);
  });

  it("filters by category", () => {
    addMemoryEntry(TEST_DIR, "always use strict mode");
    addMemoryEntry(TEST_DIR, "avoid eval()", undefined, []);
    const conventions = listMemory(TEST_DIR, "convention");
    expect(conventions.every((e) => e.category === "convention")).toBe(true);
  });
});
