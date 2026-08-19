import type { Command } from "commander";
import { loadIndex, buildGraph, findDependencies, findDependents } from "@cortex/core";
import { resolve } from "node:path";

export function contextCommand(program: Command): void {
  program
    .command("context <topic>")
    .description("Get relevant context for a topic")
    .option("-r, --root <path>", "Project root", process.cwd())
    .action((topic: string, opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);

      if (!index) {
        console.error("\n  No index found. Run `cortex init` first.\n");
        process.exit(1);
      }

      const lowerTopic = topic.toLowerCase();
      const graph = buildGraph(index.files);

      const relevantFiles = index.files
        .map((file) => {
          let relevance = 0;

          if (file.relativePath.toLowerCase().includes(lowerTopic)) {
            relevance += 10;
          }

          const matchedSymbols = file.symbols.filter(
            (sym) =>
              sym.name.toLowerCase().includes(lowerTopic) ||
              sym.kind.toLowerCase().includes(lowerTopic)
          );
          relevance += matchedSymbols.length * 5;

          for (const imp of file.imports) {
            if (imp.toLowerCase().includes(lowerTopic)) {
              relevance += 3;
            }
          }

          return { file, relevance, matchedSymbols };
        })
        .filter((r) => r.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance);

      if (relevantFiles.length === 0) {
        console.log(`\n  No context found for "${topic}"\n`);
        return;
      }

      console.log(`\n  CONTEXT: "${topic}"`);
      console.log("  " + "─".repeat(40));

      console.log("\n  Relevant files:");
      for (const { file, matchedSymbols } of relevantFiles.slice(0, 10)) {
        console.log(`\n  → ${file.relativePath}`);
        if (matchedSymbols.length > 0) {
          for (const sym of matchedSymbols) {
            const icon = sym.exported ? "✦" : "·";
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
            console.log(`    ← ${dep}`);
          }
        }

        if (dependents.length > 0) {
          console.log("\n  Dependents (files that import this):");
          for (const dep of dependents) {
            console.log(`    → ${dep}`);
          }
        }
      }

      console.log("");
    });
}
