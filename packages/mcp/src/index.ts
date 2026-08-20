import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import {
  initIndex,
  loadIndex,
  searchFiles,
  getContext,
  buildGraph,
  findDependencies,
  findDependents,
  findTransitiveDependencies,
  findTransitiveDependents,
  analyzeDependencies,
  addMemoryEntry,
  searchMemory,
  listMemory,
  getMemoryEntry,
  deleteMemoryEntry,
  generatePlan,
  getDiff,
  getStagedDiff,
  reviewDiff,
  runAgent,
  runAllAgents,
  loadMemory,
  loadConfig,
  generateUnifiedReport,
  createSnapshot,
  saveReportSnapshot,
  listReportSnapshots,
  getReportSnapshot,
  savePlan,
  listPlans,
  getPlan,
} from "@cortex/core";

function resolveRoot(root?: string): string {
  return root ?? process.cwd();
}

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

serveStdio(() => {
  const server = new McpServer({ name: "cortex", version: "1.0.0" });

  server.registerTool(
    "cortex_init",
    {
      description: "Index a project with tree-sitter AST parsing and dependency graph",
      inputSchema: z.object({
        root: z.string().optional().describe("Project root directory (defaults to cwd)"),
      }),
    },
    async ({ root }) => {
      const dir = resolveRoot(root);
      const index = await initIndex({ root: dir });
      return json({
        message: "Index created successfully",
        files: index.files.length,
        stats: index.project.stats,
      });
    }
  );

  server.registerTool(
    "cortex_status",
    {
      description: "Show project index status and statistics",
      inputSchema: z.object({
        root: z.string().optional().describe("Project root directory"),
      }),
    },
    async ({ root }) => {
      const dir = resolveRoot(root);
      const index = loadIndex(dir);
      if (!index) {
        return text("No index found. Run cortex_init first.");
      }
      return json({
        files: index.files.length,
        stats: index.project.stats,
        version: index.version,
      });
    }
  );

  server.registerTool(
    "cortex_analyze",
    {
      description: "Analyze project dependencies — cycles, impact scores, critical path",
      inputSchema: z.object({
        root: z.string().optional().describe("Project root directory"),
      }),
    },
    async ({ root }) => {
      const dir = resolveRoot(root);
      const index = loadIndex(dir);
      if (!index) {
        return text("No index found. Run cortex_init first.");
      }
      const graph = buildGraph(index.files);
      const analysis = analyzeDependencies(graph);
      return json(analysis);
    }
  );

  server.registerTool(
    "cortex_search",
    {
      description: "Semantic search across indexed files and symbols",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
        root: z.string().optional().describe("Project root directory"),
        limit: z.number().int().optional().describe("Max results"),
      }),
    },
    async ({ query, root, limit }) => {
      const dir = resolveRoot(root);
      const index = loadIndex(dir);
      if (!index) {
        return text("No index found. Run cortex_init first.");
      }
      const results = searchFiles(index, query, limit);
      return json(results);
    }
  );

  server.registerTool(
    "cortex_context",
    {
      description: "Search with dependency context — find relevant files and their relationships",
      inputSchema: z.object({
        topic: z.string().describe("Topic to get context for"),
        root: z.string().optional().describe("Project root directory"),
        maxDepth: z.number().int().optional().describe("Dependency depth"),
      }),
    },
    async ({ topic, root, maxDepth }) => {
      const dir = resolveRoot(root);
      const index = loadIndex(dir);
      if (!index) {
        return text("No index found. Run cortex_init first.");
      }
      const result = getContext(index, topic, maxDepth);
      return json(result);
    }
  );

  server.registerTool(
    "cortex_remember",
    {
      description: "Save a memory entry about the project",
      inputSchema: z.object({
        text: z.string().describe("Memory text to save"),
        root: z.string().optional().describe("Project root directory"),
        category: z.enum(["decision", "convention", "pattern", "mistake", "task", "note"]).optional().describe("Memory category"),
        contextFiles: z.array(z.string()).optional().describe("Related file paths"),
      }),
    },
    async ({ text: memoryText, root, category, contextFiles }) => {
      const dir = resolveRoot(root);
      const entry = addMemoryEntry(dir, memoryText, category, contextFiles);
      return json(entry);
    }
  );

  server.registerTool(
    "cortex_memory_search",
    {
      description: "Search project memories",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
        root: z.string().optional().describe("Project root directory"),
        limit: z.number().int().optional().describe("Max results"),
      }),
    },
    async ({ query, root, limit }) => {
      const dir = resolveRoot(root);
      const results = searchMemory(dir, query, limit);
      return json(results);
    }
  );

  server.registerTool(
    "cortex_memory_list",
    {
      description: "List all project memories",
      inputSchema: z.object({
        root: z.string().optional().describe("Project root directory"),
        category: z.enum(["decision", "convention", "pattern", "mistake", "task", "note"]).optional().describe("Filter by category"),
      }),
    },
    async ({ root, category }) => {
      const dir = resolveRoot(root);
      const results = listMemory(dir, category);
      return json(results);
    }
  );

  server.registerTool(
    "cortex_memory_get",
    {
      description: "Get a specific memory entry by ID",
      inputSchema: z.object({
        id: z.string().describe("Memory entry ID"),
        root: z.string().optional().describe("Project root directory"),
      }),
    },
    async ({ id, root }) => {
      const dir = resolveRoot(root);
      const entry = getMemoryEntry(dir, id);
      if (!entry) {
        return text(`Memory entry ${id} not found.`);
      }
      return json(entry);
    }
  );

  server.registerTool(
    "cortex_memory_delete",
    {
      description: "Delete a memory entry by ID",
      inputSchema: z.object({
        id: z.string().describe("Memory entry ID"),
        root: z.string().optional().describe("Project root directory"),
      }),
    },
    async ({ id, root }) => {
      const dir = resolveRoot(root);
      const deleted = deleteMemoryEntry(dir, id);
      return text(deleted ? `Memory ${id} deleted.` : `Memory ${id} not found.`);
    }
  );

  server.registerTool(
    "cortex_plan",
    {
      description: "Generate an execution plan for a task with risk assessment and phased breakdown",
      inputSchema: z.object({
        description: z.string().describe("Task description"),
        root: z.string().optional().describe("Project root directory"),
      }),
    },
    async ({ description, root }) => {
      const dir = resolveRoot(root);
      const index = loadIndex(dir);
      if (!index) {
        return text("No index found. Run cortex_init first.");
      }
      const plan = generatePlan(index, description);
      return json(plan);
    }
  );

  server.registerTool(
    "cortex_review",
    {
      description: "Review git diff for architecture violations, security issues, and missing tests",
      inputSchema: z.object({
        root: z.string().optional().describe("Project root directory"),
        staged: z.boolean().optional().describe("Review staged changes"),
        target: z.string().optional().describe("Git ref to diff against"),
      }),
    },
    async ({ root, staged, target }) => {
      const dir = resolveRoot(root);
      const index = loadIndex(dir);
      const diffOutput = staged
        ? getStagedDiff(dir)
        : getDiff(dir, target ?? "HEAD");
      if (!diffOutput.trim()) {
        return text("No changes to review.");
      }
      const result = reviewDiff(index, diffOutput);
      return json(result);
    }
  );

  server.registerTool(
    "cortex_dependencies",
    {
      description: "Get dependency information for a specific file",
      inputSchema: z.object({
        file: z.string().describe("File path to analyze"),
        root: z.string().optional().describe("Project root directory"),
      }),
    },
    async ({ file, root }) => {
      const dir = resolveRoot(root);
      const index = loadIndex(dir);
      if (!index) {
        return text("No index found. Run cortex_init first.");
      }
      const graph = buildGraph(index.files);
      const deps = findDependencies(graph, file);
      const dependents = findDependents(graph, file);
      const transitiveDeps = findTransitiveDependencies(graph, file);
      const transitiveDependents = findTransitiveDependents(graph, file);
      return json({
        file,
        directDependencies: deps,
        directDependents: dependents,
        transitiveDependencies: transitiveDeps,
        transitiveDependents: transitiveDependents,
      });
    }
  );

  server.registerTool(
    "cortex_agent_architect",
    {
      description: "Deep architectural analysis — layers, coupling metrics, fitness functions, debt score",
      inputSchema: z.object({
        root: z.string().optional().describe("Project root directory"),
      }),
    },
    async ({ root }) => {
      const dir = resolveRoot(root);
      const index = loadIndex(dir);
      if (!index) return text("No index found. Run cortex_init first.");
      const graph = buildGraph(index.files);
      const analysis = analyzeDependencies(graph);
      const memory = loadMemory(dir);
      const result = runAgent("architect", { index, analysis, memory, root: dir });
      return json(result);
    }
  );

  server.registerTool(
    "cortex_agent_reviewer",
    {
      description: "Enhanced review — graph-aware, convention-aware, cross-file analysis",
      inputSchema: z.object({
        root: z.string().optional().describe("Project root directory"),
      }),
    },
    async ({ root }) => {
      const dir = resolveRoot(root);
      const index = loadIndex(dir);
      if (!index) return text("No index found. Run cortex_init first.");
      const graph = buildGraph(index.files);
      const analysis = analyzeDependencies(graph);
      const memory = loadMemory(dir);
      const result = runAgent("reviewer", { index, analysis, memory, root: dir });
      return json(result);
    }
  );

  server.registerTool(
    "cortex_agent_security",
    {
      description: "Security analysis — OWASP mapping, secrets, crypto weaknesses, auth gaps",
      inputSchema: z.object({
        root: z.string().optional().describe("Project root directory"),
      }),
    },
    async ({ root }) => {
      const dir = resolveRoot(root);
      const index = loadIndex(dir);
      if (!index) return text("No index found. Run cortex_init first.");
      const graph = buildGraph(index.files);
      const analysis = analyzeDependencies(graph);
      const memory = loadMemory(dir);
      const result = runAgent("security", { index, analysis, memory, root: dir });
      return json(result);
    }
  );

  server.registerTool(
    "cortex_agent_tester",
    {
      description: "Test strategy — coverage mapping, untested paths, test suggestions",
      inputSchema: z.object({
        root: z.string().optional().describe("Project root directory"),
      }),
    },
    async ({ root }) => {
      const dir = resolveRoot(root);
      const index = loadIndex(dir);
      if (!index) return text("No index found. Run cortex_init first.");
      const graph = buildGraph(index.files);
      const analysis = analyzeDependencies(graph);
      const memory = loadMemory(dir);
      const result = runAgent("tester", { index, analysis, memory, root: dir });
      return json(result);
    }
  );

  server.registerTool(
    "cortex_agent_all",
    {
      description: "Run all agents (architect, reviewer, security, tester) and aggregate results",
      inputSchema: z.object({
        root: z.string().optional().describe("Project root directory"),
      }),
    },
    async ({ root }) => {
      const dir = resolveRoot(root);
      const index = loadIndex(dir);
      if (!index) return text("No index found. Run cortex_init first.");
      const graph = buildGraph(index.files);
      const analysis = analyzeDependencies(graph);
      const memory = loadMemory(dir);
      const results = runAllAgents({ index, analysis, memory, root: dir });
      const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
      return json({ agents: results, combinedScore: avgScore });
    }
  );

  server.registerTool(
    "cortex_report",
    {
      description: "Run all agents and produce a unified report with cross-agent correlation",
      inputSchema: z.object({
        root: z.string().optional().describe("Project root directory"),
        save: z.boolean().optional().describe("Save report snapshot to .cortex/history/"),
      }),
    },
    async ({ root, save }) => {
      const dir = resolveRoot(root);
      const index = loadIndex(dir);
      if (!index) return text("No index found. Run cortex_init first.");
      const graph = buildGraph(index.files);
      const analysis = analyzeDependencies(graph);
      const memory = loadMemory(dir);
      const report = generateUnifiedReport({ index, analysis, memory, root: dir });
      if (save) {
        const snapshot = createSnapshot(report);
        saveReportSnapshot(dir, snapshot);
      }
      return json(report);
    }
  );

  server.registerTool(
    "cortex_history",
    {
      description: "List past report snapshots and saved plans",
      inputSchema: z.object({
        root: z.string().optional().describe("Project root directory"),
        type: z.enum(["reports", "plans"]).optional().describe("Filter by type"),
      }),
    },
    async ({ root, type }) => {
      const dir = resolveRoot(root);
      const reports = type !== "plans" ? listReportSnapshots(dir) : [];
      const plans = type !== "reports" ? listPlans(dir) : [];
      return json({ reports, plans });
    }
  );

  server.registerTool(
    "cortex_config_get",
    {
      description: "Read the current Cortex configuration",
      inputSchema: z.object({
        root: z.string().optional().describe("Project root directory"),
      }),
    },
    async ({ root }) => {
      const dir = resolveRoot(root);
      const config = loadConfig(dir);
      return json(config);
    }
  );

  return server;
});
