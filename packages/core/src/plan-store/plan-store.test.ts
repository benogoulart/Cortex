import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { savePlan, listPlans, getPlan } from "./index.js";
import type { ExecutionPlan } from "../types/index.js";

const TEST_DIR = join(import.meta.dirname ?? ".", "__test_planstore__");

function makePlan(id: string): ExecutionPlan {
  return {
    id,
    title: `Plan ${id}`,
    description: "Test plan",
    taskDescription: "Do something",
    createdAt: new Date().toISOString(),
    risk: "low",
    riskFactors: [],
    affectedModules: [],
    phases: [],
    totalTasks: 0,
    estimatedComplexity: 1,
  };
}

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".cortex"), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("savePlan", () => {
  it("saves plan and returns snapshot", () => {
    const plan = makePlan("p1");
    const snapshot = savePlan(TEST_DIR, plan);
    expect(snapshot.planId).toBe("p1");
    expect(snapshot.title).toBe("Plan p1");
  });

  it("appends to plan list", () => {
    savePlan(TEST_DIR, makePlan("p1"));
    savePlan(TEST_DIR, makePlan("p2"));
    const list = listPlans(TEST_DIR);
    expect(list).toHaveLength(2);
  });
});

describe("getPlan", () => {
  it("retrieves a saved plan", () => {
    const plan = makePlan("p1");
    savePlan(TEST_DIR, plan);
    const loaded = getPlan(TEST_DIR, "p1");
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("p1");
  });

  it("returns null for non-existent plan", () => {
    expect(getPlan(TEST_DIR, "nope")).toBeNull();
  });
});

describe("listPlans", () => {
  it("returns empty array when no plans", () => {
    expect(listPlans(TEST_DIR)).toEqual([]);
  });
});
