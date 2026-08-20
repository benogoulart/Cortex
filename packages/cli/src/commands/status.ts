import type { Command } from "commander";
import { loadIndex } from "@cortex/core";
import { resolve } from "node:path";

export function statusCommand(program: Command): void {
  program
    .command("status")
    .description("Show index status")
    .option("-r, --root <path>", "Project root", process.cwd())
    .option("-j, --json", "Output as JSON")
    .action((opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);

      if (!index) {
        console.error("\n  No index found. Run `cortex init` first.\n");
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(index, null, 2));
        return;
      }

      const { project } = index;
      const stats = project.stats;

      console.log("\n  CORTEX STATUS");
      console.log("  " + "─".repeat(40));
      console.log(`  Version:    ${index.version}`);
      console.log(`  Project:    ${project.name}`);
      console.log(`  Root:       ${project.root}`);
      console.log(`  Analyzed:   ${new Date(project.analyzedAt).toLocaleString()}`);
      console.log(`\n  Index contains:`);
      console.log(`    Files:    ${stats.totalFiles}`);
      console.log(`    Lines:    ${stats.totalLines.toLocaleString()}`);
      console.log(`    Edges:    ${index.graph.edges.length}`);
      console.log("");
    });
}
