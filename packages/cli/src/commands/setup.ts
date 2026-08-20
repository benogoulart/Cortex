import type { Command } from "commander";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CORTEX_SERVER = {
  command: "cortex-mcp",
  args: [] as string[],
};

function findConfigPath(root: string): string {
  const opencodeJson = join(root, "opencode.json");
  const opencodeDir = join(root, ".opencode", "config.json");

  if (existsSync(opencodeJson)) return opencodeJson;
  if (existsSync(opencodeDir)) return opencodeDir;
  return opencodeJson;
}

export function setupCommand(program: Command): void {
  program
    .command("setup")
    .description("Configure MCP server for OpenCode in this project")
    .option("-r, --root <path>", "Project root", process.cwd())
    .action((opts) => {
      const root = opts.root;
      const configPath = findConfigPath(root);

      let config: Record<string, unknown> = {};
      let created = false;

      if (existsSync(configPath)) {
        try {
          config = JSON.parse(readFileSync(configPath, "utf-8"));
        } catch {
          config = {};
        }
      } else {
        created = true;
      }

      if (!config.mcpServers || typeof config.mcpServers !== "object") {
        config.mcpServers = {};
      }

      const servers = config.mcpServers as Record<string, unknown>;
      servers.cortex = CORTEX_SERVER;

      const dir = configPath.split(/[\\/]/).slice(0, -1).join("/");
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(configPath, JSON.stringify(config, null, 2));

      console.log(`\n  CORTEX SETUP`);
      console.log("  " + "─".repeat(40));
      console.log(`  ${created ? "Created" : "Updated"} ${configPath}`);
      console.log(`  Added cortex MCP server`);
      console.log(`\n  Restart OpenCode to use Cortex.\n`);
    });
}
