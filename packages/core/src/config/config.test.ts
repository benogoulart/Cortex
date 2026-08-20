import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, saveConfig, DEFAULT_CONFIG } from "./index.js";

const TEST_DIR = join(import.meta.dirname ?? ".", "__test_config__");

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".cortex"), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("returns default config when no config file exists", () => {
    const config = loadConfig(TEST_DIR);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("loads user config and merges with defaults", () => {
    writeFileSync(
      join(TEST_DIR, ".cortex", "config.json"),
      JSON.stringify({ include: ["*.ts"] })
    );
    const config = loadConfig(TEST_DIR);
    expect(config.include).toEqual(["*.ts"]);
    expect(config.ignore).toEqual(DEFAULT_CONFIG.ignore);
    expect(config.layers).toEqual(DEFAULT_CONFIG.layers);
  });

  it("deep merges nested objects", () => {
    writeFileSync(
      join(TEST_DIR, ".cortex", "config.json"),
      JSON.stringify({ searchWeights: { path: 10 } })
    );
    const config = loadConfig(TEST_DIR);
    expect(config.searchWeights.path).toBe(10);
    expect(config.searchWeights.symbol).toBe(DEFAULT_CONFIG.searchWeights.symbol);
    expect(config.searchWeights.import).toBe(DEFAULT_CONFIG.searchWeights.import);
    expect(config.searchWeights.export).toBe(DEFAULT_CONFIG.searchWeights.export);
    expect(config.searchWeights.structural).toBe(DEFAULT_CONFIG.searchWeights.structural);
  });

  it("deep merges layers", () => {
    writeFileSync(
      join(TEST_DIR, ".cortex", "config.json"),
      JSON.stringify({ layers: { custom: ["/custom/"] } })
    );
    const config = loadConfig(TEST_DIR);
    expect(config.layers.custom).toEqual(["/custom/"]);
    expect(config.layers.api).toEqual(DEFAULT_CONFIG.layers.api);
  });

  it("returns default config on invalid JSON", () => {
    writeFileSync(join(TEST_DIR, ".cortex", "config.json"), "not json");
    const config = loadConfig(TEST_DIR);
    expect(config).toEqual(DEFAULT_CONFIG);
  });
});

describe("saveConfig", () => {
  it("saves config to .cortex/config.json", () => {
    const config = { ...DEFAULT_CONFIG, include: ["*.tsx"] };
    saveConfig(TEST_DIR, config);
    const loaded = loadConfig(TEST_DIR);
    expect(loaded.include).toEqual(["*.tsx"]);
  });
});
