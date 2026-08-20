import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ReportSnapshot } from "../types/index.js";

export const HISTORY_DIR = "history";

function getHistoryDir(root: string): string {
  return join(root, ".cortex", HISTORY_DIR);
}

export function saveReportSnapshot(root: string, snapshot: ReportSnapshot): void {
  const dir = getHistoryDir(root);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const filePath = join(dir, `${snapshot.id}.json`);
  writeFileSync(filePath, JSON.stringify(snapshot, null, 2));

  const indexPath = join(dir, "_index.json");
  const existing = existsSync(indexPath)
    ? JSON.parse(readFileSync(indexPath, "utf-8") as string)
    : [];
  existing.push({ id: snapshot.id, timestamp: snapshot.timestamp });
  writeFileSync(indexPath, JSON.stringify(existing, null, 2));
}

export function listReportSnapshots(root: string): { id: string; timestamp: string }[] {
  const indexPath = join(getHistoryDir(root), "_index.json");
  if (!existsSync(indexPath)) return [];
  try {
    return JSON.parse(readFileSync(indexPath, "utf-8"));
  } catch {
    return [];
  }
}

export function getReportSnapshot(root: string, snapshotId: string): ReportSnapshot | null {
  const filePath = join(getHistoryDir(root), `${snapshotId}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
