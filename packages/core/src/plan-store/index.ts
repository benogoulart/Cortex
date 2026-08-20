import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ExecutionPlan, PlanSnapshot } from "../types/index.js";

export const PLANS_DIR = "plans";

function getPlansDir(root: string): string {
  return join(root, ".cortex", PLANS_DIR);
}

export function savePlan(root: string, plan: ExecutionPlan): PlanSnapshot {
  const dir = getPlansDir(root);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const filePath = join(dir, `${plan.id}.json`);
  writeFileSync(filePath, JSON.stringify(plan, null, 2));

  const snapshot: PlanSnapshot = {
    id: plan.id,
    planId: plan.id,
    title: plan.title,
    taskDescription: plan.taskDescription,
    createdAt: plan.createdAt,
    risk: plan.risk,
    totalTasks: plan.totalTasks,
    estimatedComplexity: plan.estimatedComplexity,
  };

  const listPath = join(dir, "_list.json");
  const existing = existsSync(listPath)
    ? JSON.parse(readFileSync(listPath, "utf-8") as string)
    : [];
  existing.push(snapshot);
  writeFileSync(listPath, JSON.stringify(existing, null, 2));

  return snapshot;
}

export function listPlans(root: string): PlanSnapshot[] {
  const listPath = join(getPlansDir(root), "_list.json");
  if (!existsSync(listPath)) return [];
  try {
    return JSON.parse(readFileSync(listPath, "utf-8"));
  } catch {
    return [];
  }
}

export function getPlan(root: string, planId: string): ExecutionPlan | null {
  const filePath = join(getPlansDir(root), `${planId}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
