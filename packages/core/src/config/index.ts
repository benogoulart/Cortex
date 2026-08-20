import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { CortexConfig } from "../types/index.js";

export const CONFIG_FILE = "config.json";

export const DEFAULT_CONFIG: CortexConfig = {
  include: ["**/*"],
  ignore: [
    "node_modules/**",
    "dist/**",
    "build/**",
    ".git/**",
    "*.min.js",
    "*.min.css",
  ],
  layers: {
    presentation: ["/views/", "/components/", "/pages/", "/ui/"],
    api: ["/controllers/", "/routes/", "/handlers/", "/endpoints/"],
    service: ["/services/", "/usecases/", "/managers/"],
    data: ["/repositories/", "/models/", "/entities/", "/schemas/"],
    infra: ["/config/", "/utils/", "/helpers/", "/lib/", "/shared/"],
  },
  securityPatterns: [
    { pattern: "(?:password|passwd|pwd)\\s*[:=]\\s*['\"][^'\"]+['\"]", type: "hardcoded-password", owasp: "A07:2021" },
    { pattern: "(?:api[_-]?key|apikey)\\s*[:=]\\s*['\"][^'\"]+['\"]", type: "hardcoded-api-key", owasp: "A07:2021" },
    { pattern: "(?:secret|token)\\s*[:=]\\s*['\"][^'\"]+['\"]", type: "hardcoded-secret", owasp: "A07:2021" },
  ],
  searchWeights: {
    path: 3,
    symbol: 5,
    import: 2,
    export: 1,
    structural: 2,
  },
  reviewRules: [],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
      result[key] = deepMerge(targetVal, sourceVal);
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }
  return result;
}

export function loadConfig(root: string): CortexConfig {
  const configPath = join(root, ".cortex", CONFIG_FILE);
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    return deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, raw) as unknown as CortexConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(root: string, config: CortexConfig): void {
  const cortexDir = join(root, ".cortex");
  if (!existsSync(cortexDir)) {
    mkdirSync(cortexDir, { recursive: true });
  }
  writeFileSync(join(cortexDir, CONFIG_FILE), JSON.stringify(config, null, 2));
}
