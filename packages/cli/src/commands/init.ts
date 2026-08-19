import type { Command } from "commander";
import { initIndex } from "@cortex/core";
import { resolve } from "node:path";

export function initCommand(program: Command): void {
  program
    .command("init")
    .description("Scan codebase and create index")
    .option("-r, --root <path>", "Project root", process.cwd())
    .option("-i, --include <patterns>", "File patterns to include", "**/*")
    .option("--ignore <patterns>", "Additional patterns to ignore", "")
    .action(async (opts) => {
      const root = resolve(opts.root);
      console.log(`\n  Scanning ${root}...\n`);

      const include = opts.include.split(",").map((s: string) => s.trim());
      const ignore = opts.ignore
        ? opts.ignore.split(",").map((s: string) => s.trim())
        : [];

      try {
        const index = await initIndex({ root, include, ignore });
        const { stats } = index.project;

        console.log("  cortex initialized\n");
        console.log(`  Files:      ${stats.totalFiles}`);
        console.log(`  Lines:      ${stats.totalLines.toLocaleString()}`);
        console.log(`  TypeScript: ${stats.languages.typescript}`);
        console.log(`  JavaScript: ${stats.languages.javascript}`);
        console.log(`  JSON:       ${stats.languages.json}`);
        console.log(`\n  Index saved to .cortex/index.json\n`);
      } catch (err) {
        console.error("  Error:", (err as Error).message);
        process.exit(1);
      }
    });
}
