import type { Command } from "commander";
import { addMemoryEntry, detectCategory } from "@cortex/core";
import type { MemoryCategory } from "@cortex/core";
import { resolve } from "node:path";

const CATEGORY_ICONS: Record<MemoryCategory, string> = {
  decision: "D",
  convention: "C",
  pattern: "P",
  mistake: "!",
  task: "T",
  note: "N",
};

export function rememberCommand(program: Command): void {
  program
    .command("remember <text>")
    .description("Save a decision, convention, pattern or mistake to project memory")
    .option("-r, --root <path>", "Project root", process.cwd())
    .option("-c, --category <type>", "Category: decision, convention, pattern, mistake, task, note")
    .option("--context <files>", "Related file paths (comma-separated)")
    .action((text: string, opts) => {
      const root = resolve(opts.root);
      const category = opts.category as MemoryCategory | undefined;
      const contextFiles = opts.context
        ? opts.context.split(",").map((s: string) => s.trim())
        : undefined;

      const entry = addMemoryEntry(root, text, category, contextFiles);
      const detectedCat = category ?? detectCategory(text);
      const icon = CATEGORY_ICONS[detectedCat];

      console.log("\n  Memory saved");
      console.log("  " + "─".repeat(40));
      console.log(`  Category:   ${detectedCat}`);
      console.log(`  ID:         ${entry.id}`);
      console.log(`  Created:    ${new Date(entry.createdAt).toLocaleString()}`);

      if (entry.tags.length > 0) {
        console.log(`  Tags:       ${entry.tags.join(", ")}`);
      }

      if (entry.context.length > 0) {
        console.log(`  Context:    ${entry.context.join(", ")}`);
      }

      console.log("");
    });
}
