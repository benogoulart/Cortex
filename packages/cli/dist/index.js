#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";

// src/commands/init.ts
import { initIndex } from "@cortex/core";
import { resolve } from "path";
function initCommand(program2) {
  program2.command("init").description("Scan codebase and create index").option("-r, --root <path>", "Project root", process.cwd()).option("-i, --include <patterns>", "File patterns to include", "**/*").option("--ignore <patterns>", "Additional patterns to ignore", "").action(async (opts) => {
    const root = resolve(opts.root);
    console.log(`
  Scanning ${root}...
`);
    const include = opts.include.split(",").map((s) => s.trim());
    const ignore = opts.ignore ? opts.ignore.split(",").map((s) => s.trim()) : [];
    try {
      const index = await initIndex({ root, include, ignore });
      const { stats } = index.project;
      console.log("  cortex initialized\n");
      console.log(`  Files:      ${stats.totalFiles}`);
      console.log(`  Lines:      ${stats.totalLines.toLocaleString()}`);
      console.log(`  TypeScript: ${stats.languages.typescript}`);
      console.log(`  JavaScript: ${stats.languages.javascript}`);
      console.log(`  JSON:       ${stats.languages.json}`);
      console.log(`
  Index saved to .cortex/index.json
`);
    } catch (err) {
      console.error("  Error:", err.message);
      process.exit(1);
    }
  });
}

// src/commands/analyze.ts
import { loadIndex, findEntryPoints, buildGraph } from "@cortex/core";
import { resolve as resolve2 } from "path";
function analyzeCommand(program2) {
  program2.command("analyze").description("Analyze project and show insights").option("-r, --root <path>", "Project root", process.cwd()).action((opts) => {
    const root = resolve2(opts.root);
    const index = loadIndex(root);
    if (!index) {
      console.error("\n  No index found. Run `cortex init` first.\n");
      process.exit(1);
    }
    const { files } = index;
    const stats = index.project.stats;
    const graph = buildGraph(files);
    const entryPoints = findEntryPoints(graph);
    console.log("\n  PROJECT ANALYSIS");
    console.log("  " + "\u2500".repeat(40));
    console.log(`
  Name:       ${index.project.name}`);
    console.log(`  Analyzed:   ${new Date(index.project.analyzedAt).toLocaleString()}`);
    console.log("\n  STATS");
    console.log("  " + "\u2500".repeat(40));
    console.log(`  Files:      ${stats.totalFiles}`);
    console.log(`  Lines:      ${stats.totalLines.toLocaleString()}`);
    console.log(`  TypeScript: ${stats.languages.typescript}`);
    console.log(`  JavaScript: ${stats.languages.javascript}`);
    console.log(`  JSON:       ${stats.languages.json}`);
    console.log("\n  ARCHITECTURE");
    console.log("  " + "\u2500".repeat(40));
    const directories = /* @__PURE__ */ new Map();
    for (const file of files) {
      const dir = file.relativePath.split("/")[0];
      directories.set(dir, (directories.get(dir) ?? 0) + 1);
    }
    const sortedDirs = [...directories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [dir, count] of sortedDirs) {
      const bar = "\u2588".repeat(Math.min(Math.ceil(count / 2), 20));
      console.log(`  ${dir.padEnd(20)} ${String(count).padStart(4)} ${bar}`);
    }
    console.log("\n  ENTRY POINTS");
    console.log("  " + "\u2500".repeat(40));
    if (entryPoints.length === 0) {
      console.log("  (none detected)");
    } else {
      for (const ep of entryPoints.slice(0, 5)) {
        console.log(`  \u2192 ${ep}`);
      }
      if (entryPoints.length > 5) {
        console.log(`  ... and ${entryPoints.length - 5} more`);
      }
    }
    console.log("\n  SYMBOLS (Top 10)");
    console.log("  " + "\u2500".repeat(40));
    const allSymbols = files.filter((f) => f.symbols.length > 0).sort((a, b) => b.symbols.length - a.symbols.length).slice(0, 10);
    for (const file of allSymbols) {
      console.log(`
  ${file.relativePath}`);
      for (const sym of file.symbols.slice(0, 5)) {
        const icon = sym.exported ? "\u2726" : "\xB7";
        console.log(`    ${icon} ${sym.kind.padEnd(10)} ${sym.name}`);
      }
      if (file.symbols.length > 5) {
        console.log(`    ... and ${file.symbols.length - 5} more`);
      }
    }
    console.log("\n");
  });
}

// src/commands/status.ts
import { loadIndex as loadIndex2 } from "@cortex/core";
import { resolve as resolve3 } from "path";
function statusCommand(program2) {
  program2.command("status").description("Show index status").option("-r, --root <path>", "Project root", process.cwd()).action((opts) => {
    const root = resolve3(opts.root);
    const index = loadIndex2(root);
    if (!index) {
      console.error("\n  No index found. Run `cortex init` first.\n");
      process.exit(1);
    }
    const { project } = index;
    const stats = project.stats;
    console.log("\n  LENS STATUS");
    console.log("  " + "\u2500".repeat(40));
    console.log(`  Version:    ${index.version}`);
    console.log(`  Project:    ${project.name}`);
    console.log(`  Root:       ${project.root}`);
    console.log(`  Analyzed:   ${new Date(project.analyzedAt).toLocaleString()}`);
    console.log(`
  Index contains:`);
    console.log(`    Files:    ${stats.totalFiles}`);
    console.log(`    Lines:    ${stats.totalLines.toLocaleString()}`);
    console.log(`    Edges:    ${index.graph.edges.length}`);
    console.log("");
  });
}

// src/commands/search.ts
import { loadIndex as loadIndex3 } from "@cortex/core";
import { resolve as resolve4 } from "path";
function searchCommand(program2) {
  program2.command("search <query>").description("Search files and symbols").option("-r, --root <path>", "Project root", process.cwd()).action((query, opts) => {
    const root = resolve4(opts.root);
    const index = loadIndex3(root);
    if (!index) {
      console.error("\n  No index found. Run `cortex init` first.\n");
      process.exit(1);
    }
    const lowerQuery = query.toLowerCase();
    const matchedFiles = index.files.map((file) => {
      let score = 0;
      if (file.relativePath.toLowerCase().includes(lowerQuery)) {
        score += 10;
      }
      const matchedSymbols = file.symbols.filter(
        (sym) => sym.name.toLowerCase().includes(lowerQuery)
      );
      score += matchedSymbols.length * 5;
      if (file.path.toLowerCase().includes(lowerQuery)) {
        score += 3;
      }
      return { file, score, matchedSymbols };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 15);
    if (matchedFiles.length === 0) {
      console.log(`
  No results for "${query}"
`);
      return;
    }
    console.log(`
  Search: "${query}"`);
    console.log("  " + "\u2500".repeat(40));
    for (const { file, score, matchedSymbols } of matchedFiles) {
      const bar = "\u2588".repeat(Math.min(Math.ceil(score / 3), 20));
      console.log(`
  ${file.relativePath} (${score}) ${bar}`);
      if (matchedSymbols.length > 0) {
        for (const sym of matchedSymbols.slice(0, 3)) {
          const icon = sym.exported ? "\u2726" : "\xB7";
          console.log(`    ${icon} ${sym.kind.padEnd(10)} ${sym.name} (line ${sym.line})`);
        }
      }
    }
    console.log("");
  });
}

// src/commands/context.ts
import { loadIndex as loadIndex4, buildGraph as buildGraph2, findDependencies, findDependents } from "@cortex/core";
import { resolve as resolve5 } from "path";
function contextCommand(program2) {
  program2.command("context <topic>").description("Get relevant context for a topic").option("-r, --root <path>", "Project root", process.cwd()).action((topic, opts) => {
    const root = resolve5(opts.root);
    const index = loadIndex4(root);
    if (!index) {
      console.error("\n  No index found. Run `cortex init` first.\n");
      process.exit(1);
    }
    const lowerTopic = topic.toLowerCase();
    const graph = buildGraph2(index.files);
    const relevantFiles = index.files.map((file) => {
      let relevance = 0;
      if (file.relativePath.toLowerCase().includes(lowerTopic)) {
        relevance += 10;
      }
      const matchedSymbols = file.symbols.filter(
        (sym) => sym.name.toLowerCase().includes(lowerTopic) || sym.kind.toLowerCase().includes(lowerTopic)
      );
      relevance += matchedSymbols.length * 5;
      for (const imp of file.imports) {
        if (imp.toLowerCase().includes(lowerTopic)) {
          relevance += 3;
        }
      }
      return { file, relevance, matchedSymbols };
    }).filter((r) => r.relevance > 0).sort((a, b) => b.relevance - a.relevance);
    if (relevantFiles.length === 0) {
      console.log(`
  No context found for "${topic}"
`);
      return;
    }
    console.log(`
  CONTEXT: "${topic}"`);
    console.log("  " + "\u2500".repeat(40));
    console.log("\n  Relevant files:");
    for (const { file, matchedSymbols } of relevantFiles.slice(0, 10)) {
      console.log(`
  \u2192 ${file.relativePath}`);
      if (matchedSymbols.length > 0) {
        for (const sym of matchedSymbols) {
          const icon = sym.exported ? "\u2726" : "\xB7";
          console.log(`    ${icon} ${sym.kind.padEnd(10)} ${sym.name}`);
        }
      }
    }
    const primaryFile = relevantFiles[0]?.file;
    if (primaryFile) {
      const deps = findDependencies(graph, primaryFile.relativePath);
      const dependents = findDependents(graph, primaryFile.relativePath);
      if (deps.length > 0) {
        console.log("\n  Dependencies (this file imports):");
        for (const dep of deps) {
          console.log(`    \u2190 ${dep}`);
        }
      }
      if (dependents.length > 0) {
        console.log("\n  Dependents (files that import this):");
        for (const dep of dependents) {
          console.log(`    \u2192 ${dep}`);
        }
      }
    }
    console.log("");
  });
}

// src/index.ts
var program = new Command();
program.name("cortex").description("Developer intelligence for your codebase").version("0.1.0");
initCommand(program);
analyzeCommand(program);
statusCommand(program);
searchCommand(program);
contextCommand(program);
program.parse();
