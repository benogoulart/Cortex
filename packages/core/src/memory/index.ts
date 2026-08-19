import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { MemoryEntry, MemoryCategory, MemoryStore } from "../types/index.js";

export const MEMORY_FILE = "memory.json";
export const MEMORY_VERSION = "0.3.0";

const CATEGORY_KEYWORDS: Record<MemoryCategory, string[]> = {
  decision: ["use ", "chose ", "decided ", "will ", "switched to ", "migrated to ", "adopted "],
  convention: ["always ", "never ", "must ", "should ", "format ", "style ", "naming ", "convention"],
  pattern: ["pattern ", "idiom ", "approach ", "technique ", "use the ", "use a "],
  mistake: ["avoid ", "don't ", "do not ", "mistake ", "pitfall ", "warning ", "careful ", "broken "],
  task: ["todo ", "fix ", "implement ", "add ", "create ", "update ", "refactor ", "need to "],
  note: [],
};

export function detectCategory(text: string): MemoryCategory {
  const lower = text.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.startsWith(kw) || lower.includes(kw)) {
        return category as MemoryCategory;
      }
    }
  }

  return "note";
}

export function extractTags(text: string): string[] {
  const tags: string[] = [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const stopWords = new Set([
    "this", "that", "with", "from", "have", "been", "were", "they",
    "their", "there", "will", "would", "could", "should", "about",
    "which", "when", "what", "them", "than", "some", "just",
    "also", "into", "over", "such", "only", "other", "very",
  ]);

  for (const word of words) {
    if (!stopWords.has(word) && !tags.includes(word)) {
      tags.push(word);
    }
  }

  return tags.slice(0, 5);
}

export function loadMemory(root: string): MemoryStore {
  const memoryPath = join(root, ".cortex", MEMORY_FILE);
  if (!existsSync(memoryPath)) {
    return { version: MEMORY_VERSION, entries: [] };
  }
  try {
    return JSON.parse(readFileSync(memoryPath, "utf-8"));
  } catch {
    return { version: MEMORY_VERSION, entries: [] };
  }
}

export function saveMemory(root: string, store: MemoryStore): void {
  const cortexDir = join(root, ".cortex");
  if (!existsSync(cortexDir)) {
    const { mkdirSync } = require("node:fs");
    mkdirSync(cortexDir, { recursive: true });
  }

  store.version = MEMORY_VERSION;
  writeFileSync(join(cortexDir, MEMORY_FILE), JSON.stringify(store, null, 2));
}

export function addMemoryEntry(
  root: string,
  text: string,
  category?: MemoryCategory,
  contextFiles?: string[]
): MemoryEntry {
  const store = loadMemory(root);
  const id = generateId();
  const detectedCategory = category ?? detectCategory(text);
  const tags = extractTags(text);

  const entry: MemoryEntry = {
    id,
    text: text.trim(),
    category: detectedCategory,
    tags,
    createdAt: new Date().toISOString(),
    context: contextFiles ?? [],
  };

  store.entries.push(entry);
  saveMemory(root, store);

  return entry;
}

export function deleteMemoryEntry(root: string, id: string): boolean {
  const store = loadMemory(root);
  const before = store.entries.length;
  store.entries = store.entries.filter((e) => e.id !== id);

  if (store.entries.length < before) {
    saveMemory(root, store);
    return true;
  }
  return false;
}

export function getMemoryEntry(root: string, id: string): MemoryEntry | undefined {
  const store = loadMemory(root);
  return store.entries.find((e) => e.id === id);
}

export function searchMemory(
  root: string,
  query: string,
  limit?: number
): MemoryEntry[] {
  const store = loadMemory(root);
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const scored = store.entries.map((entry) => {
    let score = 0;
    const textLower = entry.text.toLowerCase();

    for (const term of terms) {
      if (textLower.includes(term)) {
        score += 3;
      }

      if (entry.category === term) {
        score += 5;
      }

      for (const tag of entry.tags) {
        if (tag.includes(term)) {
          score += 2;
        }
      }

      for (const ctx of entry.context) {
        if (ctx.toLowerCase().includes(term)) {
          score += 1;
        }
      }
    }

    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit ?? 20)
    .map((s) => s.entry);
}

export function listMemory(
  root: string,
  category?: MemoryCategory
): MemoryEntry[] {
  const store = loadMemory(root);
  let entries = store.entries;

  if (category) {
    entries = entries.filter((e) => e.category === category);
  }

  return entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "mem_";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
