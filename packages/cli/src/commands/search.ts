import type { Command } from "commander";
import { loadIndex, searchFiles } from "@cortex/core";
import { resolve } from "node:path";

export function searchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("Search files and symbols by relevance")
    .option("-r, --root <path>", "Project root", process.cwd())
    .option("-n, --limit <number>", "Max results", "15")
    .option("--verbose", "Show score breakdown")
    .action((query: string, opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);

      if (!index) {
        console.error("\n  No index found. Run `cortex init` first.\n");
        process.exit(1);
      }

      const limit = parseInt(opts.limit, 10);
      const results = searchFiles(index, query, limit);

      if (results.length === 0) {
        console.log(`\n  No results for "${query}"\n`);
        return;
      }

      console.log(`\n  Search: "${query}"`);
      console.log("  " + "─".repeat(40));

      for (const result of results) {
        const bar = "█".repeat(Math.min(Math.ceil(result.relevance / 2), 20));
        console.log(`\n  ${result.file} (${result.relevance}) ${bar}`);

        if (result.matchedSymbols.length > 0) {
          for (const sym of result.matchedSymbols.slice(0, 3)) {
            const icon = sym.exported ? "✦" : "·";
            console.log(`    ${icon} ${sym.kind.padEnd(10)} ${sym.name}`);
          }
        }

        if (opts.verbose) {
          const b = result.breakdown;
          console.log(
            `    scores: path=${b.pathScore.toFixed(1)} symbol=${b.symbolScore.toFixed(1)} import=${b.importScore.toFixed(1)} export=${b.exportScore.toFixed(1)} struct=${b.structuralScore.toFixed(1)}`
          );
        }
      }

      console.log("");
    });
}
