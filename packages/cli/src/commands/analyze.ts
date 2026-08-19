import type { Command } from "commander";
import { loadIndex, findEntryPoints, buildGraph, analyzeDependencies } from "@cortex/core";
import { resolve } from "node:path";

export function analyzeCommand(program: Command): void {
  program
    .command("analyze")
    .description("Analyze project and show insights")
    .option("-r, --root <path>", "Project root", process.cwd())
    .action((opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);

      if (!index) {
        console.error("\n  No index found. Run `cortex init` first.\n");
        process.exit(1);
      }

      const { files } = index;
      const stats = index.project.stats;
      const graph = buildGraph(files);
      const entryPoints = findEntryPoints(graph);
      const analysis = analyzeDependencies(graph);

      console.log("\n  PROJECT ANALYSIS");
      console.log("  " + "─".repeat(40));

      console.log(`\n  Name:       ${index.project.name}`);
      console.log(`  Analyzed:   ${new Date(index.project.analyzedAt).toLocaleString()}`);
      console.log(`  Version:    ${index.version}`);

      console.log("\n  STATS");
      console.log("  " + "─".repeat(40));
      console.log(`  Files:      ${stats.totalFiles}`);
      console.log(`  Lines:      ${stats.totalLines.toLocaleString()}`);
      console.log(`  TypeScript: ${stats.languages.typescript}`);
      console.log(`  JavaScript: ${stats.languages.javascript}`);
      console.log(`  JSON:       ${stats.languages.json}`);

      console.log("\n  ARCHITECTURE");
      console.log("  " + "─".repeat(40));

      const directories = new Map<string, number>();
      for (const file of files) {
        const dir = file.relativePath.split("/")[0];
        directories.set(dir, (directories.get(dir) ?? 0) + 1);
      }

      const sortedDirs = [...directories.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      for (const [dir, count] of sortedDirs) {
        const bar = "█".repeat(Math.min(Math.ceil(count / 2), 20));
        console.log(`  ${dir.padEnd(20)} ${String(count).padStart(4)} ${bar}`);
      }

      console.log("\n  ENTRY POINTS");
      console.log("  " + "─".repeat(40));
      if (entryPoints.length === 0) {
        console.log("  (none detected)");
      } else {
        for (const ep of entryPoints.slice(0, 5)) {
          console.log(`  → ${ep}`);
        }
        if (entryPoints.length > 5) {
          console.log(`  ... and ${entryPoints.length - 5} more`);
        }
      }

      console.log("\n  DEPENDENCY HEALTH");
      console.log("  " + "─".repeat(40));
      console.log(`  Total edges:     ${index.graph.edges.length}`);
      console.log(`  Cycles:          ${analysis.cycles.length}`);

      if (analysis.cycles.length > 0) {
        for (const cycle of analysis.cycles.slice(0, 3)) {
          console.log(`    ⚠ ${cycle.join(" → ")}`);
        }
      }

      if (analysis.criticalPath.length > 0) {
        console.log(`  Critical path:   ${analysis.criticalPath.length} files`);
        for (const cp of analysis.criticalPath.slice(0, 3)) {
          console.log(`    → ${cp}`);
        }
      }

      console.log("\n  SYMBOLS (Top 10)");
      console.log("  " + "─".repeat(40));

      const allSymbols = files
        .filter((f) => f.symbols.length > 0)
        .sort((a, b) => b.symbols.length - a.symbols.length)
        .slice(0, 10);

      for (const file of allSymbols) {
        console.log(`\n  ${file.relativePath}`);
        for (const sym of file.symbols.slice(0, 5)) {
          const icon = sym.exported ? "✦" : "·";
          console.log(`    ${icon} ${sym.kind.padEnd(10)} ${sym.name}`);
        }
        if (file.symbols.length > 5) {
          console.log(`    ... and ${file.symbols.length - 5} more`);
        }
      }

      console.log("\n");
    });
}
