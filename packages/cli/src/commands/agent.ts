import type { Command } from "commander";
import { loadIndex, runAgent, runAllAgents, loadMemory, buildGraph, analyzeDependencies } from "@cortex/core";
import type { AgentName, AgentResult, ArchitecturalReport, SecurityReport, TestReport } from "@cortex/core";
import { resolve } from "node:path";

const AGENT_LABELS: Record<string, string> = {
  architect: "Architecture Analysis",
  reviewer: "Enhanced Code Review",
  security: "Security Analysis",
  tester: "Test Strategy",
};

function printAgentResult(result: AgentResult): void {
  const label = AGENT_LABELS[result.agent] ?? result.agent;
  const scoreIcon = result.score >= 80 ? "G" : result.score >= 60 ? "Y" : "R";

  console.log(`\n  [${scoreIcon}] ${label} — Score: ${result.score}/100`);
  console.log("  " + "─".repeat(40));
  console.log(`  ${result.summary}`);

  if (result.findings.length === 0) {
    console.log("  No issues found.\n");
    return;
  }

  const critical = result.findings.filter((f) => f.severity === "critical");
  const warnings = result.findings.filter((f) => f.severity === "warning");
  const info = result.findings.filter((f) => f.severity === "info");

  if (critical.length > 0) {
    console.log(`\n  CRITICAL (${critical.length})`);
    for (const f of critical) {
      const loc = f.file ? `${f.file}${f.line ? ":" + f.line : ""}` : "";
      console.log(`    [X] ${f.category} — ${loc}`);
      console.log(`      ${f.message}`);
      if (f.suggestion) console.log(`      → ${f.suggestion}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n  WARNINGS (${warnings.length})`);
    for (const f of warnings) {
      const loc = f.file ? `${f.file}${f.line ? ":" + f.line : ""}` : "";
      console.log(`    [!] ${f.category} — ${loc}`);
      console.log(`      ${f.message}`);
      if (f.suggestion) console.log(`      → ${f.suggestion}`);
    }
  }

  if (info.length > 0) {
    console.log(`\n  INFO (${info.length})`);
    for (const f of info.slice(0, 10)) {
      const loc = f.file ? `${f.file}${f.line ? ":" + f.line : ""}` : "";
      console.log(`    [i] ${f.category} — ${loc}`);
      console.log(`      ${f.message}`);
    }
    if (info.length > 10) {
      console.log(`    ... and ${info.length - 10} more`);
    }
  }

  if ("layers" in result) {
    const report = result as ArchitecturalReport;
    if (report.layers.length > 0) {
      console.log("\n  LAYERS:");
      for (const layer of report.layers) {
        console.log(`    ${layer.name}: ${layer.files.length} files`);
        if (layer.violations.length > 0) {
          console.log(`      ${layer.violations.length} violations`);
        }
      }
    }
    console.log(`\n  Debt Score: ${report.debtScore}/100`);
  }

  if ("owaspCategories" in result) {
    const report = result as SecurityReport;
    if (report.owaspCategories.length > 0) {
      console.log("\n  OWASP CATEGORIES:");
      for (const group of report.owaspCategories) {
        console.log(`    ${group.category}: ${group.findings.length} findings (${group.risk})`);
      }
    }
    if (report.exposedEndpoints.length > 0) {
      console.log("\n  ENDPOINTS:");
      for (const ep of report.exposedEndpoints.slice(0, 5)) {
        console.log(`    ${ep.path} [${ep.sensitivity}] auth=${ep.hasAuth}`);
      }
    }
  }

  if ("coverage" in result) {
    const report = result as TestReport;
    const tested = report.coverage.filter((c) => c.coverageRatio >= 0.8).length;
    const untested = report.coverage.filter((c) => c.coverageRatio === 0).length;
    console.log(`\n  COVERAGE: ${tested} tested, ${untested} untested, ${report.coverage.length} total`);
    if (report.suggestions.length > 0) {
      console.log("\n  TOP SUGGESTIONS:");
      for (const s of report.suggestions.slice(0, 5)) {
        console.log(`    ${s.file} → ${s.symbol} (${s.kind}): ${s.reason}`);
      }
    }
  }

  console.log("");
}

export function agentCommand(program: Command): void {
  const cmd = program
    .command("agent")
    .description("Run specialized analysis agents")
    .option("-r, --root <path>", "Project root", process.cwd())
    .option("-j, --json", "Output as JSON");

  cmd
    .command("architect")
    .description("Analyze architecture — layers, coupling, cycles, debt")
    .action((opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);
      if (!index) {
        console.log("\n  No index found. Run cortex_init first.\n");
        return;
      }
      const graph = buildGraph(index.files);
      const analysis = analyzeDependencies(graph);
      const memory = loadMemory(root);
      const result = runAgent("architect", { index, analysis, memory, root });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printAgentResult(result);
      }
    });

  cmd
    .command("reviewer")
    .description("Enhanced review — graph-aware, convention-aware, cross-file")
    .option("--staged", "Review staged changes")
    .option("-t, --target <ref>", "Git ref to diff against")
    .action((opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);
      if (!index) {
        console.log("\n  No index found. Run cortex_init first.\n");
        return;
      }
      const graph = buildGraph(index.files);
      const analysis = analyzeDependencies(graph);
      const memory = loadMemory(root);
      const result = runAgent("reviewer", { index, analysis, memory, root });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printAgentResult(result);
      }
    });

  cmd
    .command("security")
    .description("Deep security analysis — OWASP mapping, secrets, crypto")
    .action((opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);
      if (!index) {
        console.log("\n  No index found. Run cortex_init first.\n");
        return;
      }
      const graph = buildGraph(index.files);
      const analysis = analyzeDependencies(graph);
      const result = runAgent("security", { index, analysis, root });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printAgentResult(result);
      }
    });

  cmd
    .command("tester")
    .description("Test strategy — coverage mapping, suggestions, critical paths")
    .action((opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);
      if (!index) {
        console.log("\n  No index found. Run cortex_init first.\n");
        return;
      }
      const graph = buildGraph(index.files);
      const analysis = analyzeDependencies(graph);
      const result = runAgent("tester", { index, analysis, root });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printAgentResult(result);
      }
    });

  cmd
    .command("all")
    .description("Run all agents and show combined results")
    .action((opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);
      if (!index) {
        console.log("\n  No index found. Run cortex_init first.\n");
        return;
      }
      const graph = buildGraph(index.files);
      const analysis = analyzeDependencies(graph);
      const memory = loadMemory(root);
      const results = runAllAgents({ index, analysis, memory, root });

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log("\n  CORTEX AGENTS — Full Analysis");
        console.log("  " + "═".repeat(40));
        for (const result of results) {
          printAgentResult(result);
        }
        const avgScore = Math.round(
          results.reduce((sum, r) => sum + r.score, 0) / results.length
        );
        const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
        console.log("  " + "═".repeat(40));
        console.log(`  COMBINED SCORE: ${avgScore}/100 (${totalFindings} total findings)`);
        console.log("");
      }
    });
}
