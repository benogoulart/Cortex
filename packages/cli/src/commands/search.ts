import type { Command } from "commander";
import { loadIndex } from "@cortex/core";
import { resolve } from "node:path";

export function searchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("Search files and symbols")
    .option("-r, --root <path>", "Project root", process.cwd())
    .action((query: string, opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);

      if (!index) {
        console.error("\n  No index found. Run `cortex init` first.\n");
        process.exit(1);
      }

      const lowerQuery = query.toLowerCase();

      const matchedFiles = index.files
        .map((file) => {
          let score = 0;

          if (file.relativePath.toLowerCase().includes(lowerQuery)) {
            score += 10;
          }

          const matchedSymbols = file.symbols.filter((sym) =>
            sym.name.toLowerCase().includes(lowerQuery)
          );
          score += matchedSymbols.length * 5;

          if (file.path.toLowerCase().includes(lowerQuery)) {
            score += 3;
          }

          return { file, score, matchedSymbols };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);

      if (matchedFiles.length === 0) {
        console.log(`\n  No results for "${query}"\n`);
        return;
      }

      console.log(`\n  Search: "${query}"`);
      console.log("  " + "─".repeat(40));

      for (const { file, score, matchedSymbols } of matchedFiles) {
        const bar = "█".repeat(Math.min(Math.ceil(score / 3), 20));
        console.log(`\n  ${file.relativePath} (${score}) ${bar}`);

        if (matchedSymbols.length > 0) {
          for (const sym of matchedSymbols.slice(0, 3)) {
            const icon = sym.exported ? "✦" : "·";
            console.log(`    ${icon} ${sym.kind.padEnd(10)} ${sym.name} (line ${sym.line})`);
          }
        }
      }

      console.log("");
    });
}
