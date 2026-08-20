import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { saveReportSnapshot, listReportSnapshots, getReportSnapshot } from "./index.js";
import type { ReportSnapshot } from "../types/index.js";

const TEST_DIR = join(import.meta.dirname ?? ".", "__test_history__");

function makeSnapshot(id: string): ReportSnapshot {
  return {
    id,
    timestamp: new Date().toISOString(),
    report: {
      id,
      timestamp: new Date().toISOString(),
      overallScore: 85,
      agents: [],
      perFile: {},
      prioritizedActions: [],
      metadata: { filesAnalyzed: 10, totalFindings: 3, critical: 1, warnings: 1, info: 1 },
    },
  };
}

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".cortex"), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("saveReportSnapshot", () => {
  it("saves snapshot and updates index", () => {
    const snapshot = makeSnapshot("r1");
    saveReportSnapshot(TEST_DIR, snapshot);
    const list = listReportSnapshots(TEST_DIR);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("r1");
  });

  it("appends multiple snapshots", () => {
    saveReportSnapshot(TEST_DIR, makeSnapshot("r1"));
    saveReportSnapshot(TEST_DIR, makeSnapshot("r2"));
    const list = listReportSnapshots(TEST_DIR);
    expect(list).toHaveLength(2);
  });
});

describe("getReportSnapshot", () => {
  it("retrieves a saved snapshot", () => {
    const snapshot = makeSnapshot("r1");
    saveReportSnapshot(TEST_DIR, snapshot);
    const loaded = getReportSnapshot(TEST_DIR, "r1");
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("r1");
  });

  it("returns null for non-existent snapshot", () => {
    expect(getReportSnapshot(TEST_DIR, "nope")).toBeNull();
  });
});

describe("listReportSnapshots", () => {
  it("returns empty array when no history", () => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(join(TEST_DIR, ".cortex"), { recursive: true });
    expect(listReportSnapshots(TEST_DIR)).toEqual([]);
  });
});
