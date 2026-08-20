import type { Command } from "commander";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type AgentType = "opencode" | "claude" | "codex";

const AGENTS: { name: AgentType; label: string }[] = [
  { name: "opencode", label: "OpenCode" },
  { name: "claude", label: "Claude Code" },
  { name: "codex", label: "Codex" },
];

function writeOpenCode(root: string): string {
  const configPath = join(root, "opencode.json");
  let config: Record<string, unknown> = {};
  let created = !existsSync(configPath);

  if (!created) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      config = {};
    }
  }

  if (!config.$schema) {
    config.$schema = "https://opencode.ai/config.json";
  }

  if (!config.mcp || typeof config.mcp !== "object") {
    config.mcp = {};
  }

  const mcp = config.mcp as Record<string, unknown>;
  mcp.cortex = {
    type: "local",
    command: ["cortex-mcp"],
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  return configPath;
}

function writeClaude(root: string): string {
  const configPath = join(root, ".mcp.json");
  let config: Record<string, unknown> = {};
  let created = !existsSync(configPath);

  if (!created) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      config = {};
    }
  }

  if (!config.mcpServers || typeof config.mcpServers !== "object") {
    config.mcpServers = {};
  }

  const servers = config.mcpServers as Record<string, unknown>;
  servers.cortex = {
    command: "cortex-mcp",
    args: [],
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  return configPath;
}

function writeCodexToml(root: string): string {
  const dir = join(root, ".codex");
  const configPath = join(dir, "config.toml");
  let created = !existsSync(configPath);

  let content = "";
  if (!created) {
    try {
      content = readFileSync(configPath, "utf-8");
    } catch {
      content = "";
    }
  }

  const section = "[mcp_servers.cortex]";
  const block = `${section}\ncommand = "cortex-mcp"\nargs = []\n`;

  if (content.includes(section)) {
    const lines = content.split("\n");
    const start = lines.findIndex((l) => l.trim() === section);
    if (start !== -1) {
      let end = start + 1;
      while (end < lines.length && !lines[end].startsWith("[")) end++;
      lines.splice(start, end - start, block.trimEnd());
      content = lines.join("\n");
    } else {
      content += "\n" + block;
    }
  } else {
    if (content && !content.endsWith("\n")) content += "\n\n";
    content += block;
  }

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(configPath, content);
  return configPath;
}

function writeAgent(root: string, agent: AgentType): string {
  switch (agent) {
    case "opencode":
      return writeOpenCode(root);
    case "claude":
      return writeClaude(root);
    case "codex":
      return writeCodexToml(root);
  }
}

function detectAgents(root: string): AgentType[] {
  const found: AgentType[] = [];
  if (existsSync(join(root, "opencode.json")) || existsSync(join(root, ".opencode"))) {
    found.push("opencode");
  }
  if (existsSync(join(root, ".mcp.json")) || existsSync(join(root, ".claude"))) {
    found.push("claude");
  }
  if (existsSync(join(root, ".codex")) || existsSync(join(root, "codex.toml"))) {
    found.push("codex");
  }
  return found;
}

export function setupCommand(program: Command): void {
  program
    .command("setup")
    .description("Configure Cortex MCP server for AI coding agents")
    .option("-r, --root <path>", "Project root", process.cwd())
    .option("-a, --agent <agents>", "Agent(s) to configure: opencode, claude, codex, or all (comma-separated)", "all")
    .action((opts) => {
      const root = opts.root as string;
      const input = (opts.agent as string).toLowerCase();

      let targets: AgentType[];
      if (input === "all") {
        targets = detectAgents(root);
        if (targets.length === 0) {
          targets = ["opencode", "claude", "codex"];
        }
      } else {
        targets = input.split(",").map((s: string) => s.trim()) as AgentType[];
        const invalid = targets.filter((t) => !AGENTS.find((a) => a.name === t));
        if (invalid.length > 0) {
          console.error(`\n  Unknown agent(s): ${invalid.join(", ")}`);
          console.error(`  Supported: ${AGENTS.map((a) => a.name).join(", ")}\n`);
          process.exit(1);
        }
      }

      console.log("\n  CORTEX SETUP");
      console.log("  " + "─".repeat(40));

      for (const agent of targets) {
        try {
          const path = writeAgent(root, agent);
          const label = AGENTS.find((a) => a.name === agent)!.label;
          console.log(`  [${label}] ${path}`);
        } catch (err) {
          const label = AGENTS.find((a) => a.name === agent)!.label;
          console.error(`  [${label}] Failed: ${(err as Error).message}`);
        }
      }

      console.log("");
      if (targets.includes("opencode")) {
        console.log("  Restart OpenCode to use Cortex.");
      }
      if (targets.includes("claude")) {
        console.log("  Restart Claude Code to use Cortex.");
      }
      if (targets.includes("codex")) {
        console.log("  Restart Codex to use Cortex.");
      }
      console.log("");
    });
}
