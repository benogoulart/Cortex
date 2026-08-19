import type { Command } from "commander";
import { loadIndex, getContext } from "@cortex/core";
import { resolve } from "node:path";

export function contextCommand(program: Command): void {
  program
    .command("context <topic>")
    .description("Get relevant context for a topic with dependency analysis")
    .option("-r, --root <path>", "Project root", process.cwd())
    .option("-d, --depth <number>", "Transitive dependency depth", "3")
    .action((topic: string, opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);

      if (!index) {
        console.error("\n  No index found. Run `cortex init` first.\n");
        process.exit(1);
      }

      const depth = parseInt(opts.depth, 10);
      const { results, analysis } = getContext(index, topic, depth);

      if (results.length === 0) {
        console.log(`\n  No context found for "${topic}"\n`);
        return;
      }

      console.log(`\n  CONTEXT: "${topic}"`);
      console.log("  " + "─".repeat(40));

      console.log("\n  Relevant files:");
      for (const result of results.slice(0, 10)) {
        console.log(`\n  → ${result.file} (relevance: ${result.relevance}, impact: ${result.impactScore})`);

        if (result.matchedSymbols.length > 0) {
          for (const sym of result.matchedSymbols) {
            const icon = sym.exported ? "✦" : "·";
            console.log(`    ${icon} ${sym.kind.padEnd(10)} ${sym.name}`);
          }
        }

        if (result.dependencies.length > 0) {
          console.log(`    Dependencies: ${result.dependencies.slice(0, 5).join(", ")}`);
        }

        if (result.dependents.length > 0) {
          console.log(`    Dependents: ${result.dependents.slice(0, 5).join(", ")}`);
        }

        if (result.transitiveDependencies.length > 0) {
          console.log(`    Transitive deps: ${result.transitiveDependencies.length} total`);
        }
      }

      if (analysis.cycles.length > 0) {
        console.log("\n  WARNING: Circular dependencies detected");
        console.log("  " + "─".repeat(40));
        for (const cycle of analysis.cycles.slice(0, 5)) {
          console.log(`    ${cycle.join(" → ")}`);
        }
      }

      console.log("");
    });
}
