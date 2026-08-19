import type { Command } from "commander";
import { searchMemory, listMemory, getMemoryEntry, deleteMemoryEntry } from "@cortex/core";
import type { MemoryCategory } from "@cortex/core";
import { resolve } from "node:path";

const CATEGORY_ICONS: Record<string, string> = {
  decision: "D",
  convention: "C",
  pattern: "P",
  mistake: "!",
  task: "T",
  note: "N",
};

export function memoryCommand(program: Command): void {
  const cmd = program
    .command("memory")
    .description("Manage project memory (decisions, conventions, patterns)");

  cmd
    .command("search <query>", { isDefault: true })
    .description("Search through project memory")
    .option("-r, --root <path>", "Project root", process.cwd())
    .option("-n, --limit <number>", "Max results", "20")
    .option("-c, --category <type>", "Filter by category")
    .action((query: string, opts) => {
      const root = resolve(opts.root);
      const limit = parseInt(opts.limit, 10);
      const results = searchMemory(root, query, limit);

      if (results.length === 0) {
        console.log(`\n  No memory entries found for "${query}"\n`);
        return;
      }

      console.log(`\n  MEMORY: "${query}"`);
      console.log("  " + "─".repeat(40));

      for (const entry of results) {
        const icon = CATEGORY_ICONS[entry.category] ?? "?";
        const date = new Date(entry.createdAt).toLocaleDateString();
        console.log(`\n  [${entry.category}] ${entry.id} — ${date}`);
        console.log(`    ${entry.text}`);

        if (entry.tags.length > 0) {
          console.log(`    tags: ${entry.tags.join(", ")}`);
        }

        if (entry.context.length > 0) {
          console.log(`    context: ${entry.context.join(", ")}`);
        }
      }

      console.log("");
    });

  cmd
    .command("list")
    .description("List all memory entries")
    .option("-r, --root <path>", "Project root", process.cwd())
    .option("-c, --category <type>", "Filter by category")
    .action((opts) => {
      const root = resolve(opts.root);
      const category = opts.category as MemoryCategory | undefined;
      const entries = listMemory(root, category);

      if (entries.length === 0) {
        console.log("\n  No memory entries found.\n");
        return;
      }

      const filterLabel = category ? ` (${category})` : "";
      console.log(`\n  MEMORY${filterLabel}`);
      console.log("  " + "─".repeat(40));

      for (const entry of entries) {
        const icon = CATEGORY_ICONS[entry.category] ?? "?";
        const date = new Date(entry.createdAt).toLocaleDateString();
        console.log(`\n  [${entry.category}] ${entry.id} — ${date}`);
        console.log(`    ${entry.text}`);
      }

      console.log(`\n  Total: ${entries.length} entries\n`);
    });

  cmd
    .command("show <id>")
    .description("Show a specific memory entry")
    .option("-r, --root <path>", "Project root", process.cwd())
    .action((id: string, opts) => {
      const root = resolve(opts.root);
      const entry = getMemoryEntry(root, id);

      if (!entry) {
        console.log(`\n  Memory entry "${id}" not found.\n`);
        return;
      }

      const icon = CATEGORY_ICONS[entry.category] ?? "?";

      console.log("\n  MEMORY ENTRY");
      console.log("  " + "─".repeat(40));
      console.log(`  ID:         ${entry.id}`);
      console.log(`  Category:   ${entry.category}`);
      console.log(`  Created:    ${new Date(entry.createdAt).toLocaleString()}`);
      console.log(`\n  ${entry.text}`);

      if (entry.tags.length > 0) {
        console.log(`\n  Tags:       ${entry.tags.join(", ")}`);
      }

      if (entry.context.length > 0) {
        console.log(`  Context:    ${entry.context.join(", ")}`);
      }

      console.log("");
    });

  cmd
    .command("delete <id>")
    .description("Delete a memory entry")
    .option("-r, --root <path>", "Project root", process.cwd())
    .action((id: string, opts) => {
      const root = resolve(opts.root);
      const deleted = deleteMemoryEntry(root, id);

      if (deleted) {
        console.log(`\n  Memory entry "${id}" deleted.\n`);
      } else {
        console.log(`\n  Memory entry "${id}" not found.\n`);
      }
    });
}
