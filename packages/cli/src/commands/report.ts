import type { Command } from "commander";
import { loadIndex, loadMemory, buildGraph, analyzeDependencies, generateUnifiedReport, createSnapshot, saveReportSnapshot } from "@cortex/core";
import { resolve } from "node:path";

export function reportCommand(program: Command): void {
  program
    .command("report")
    .description("Run all agents and produce a unified report")
    .option("-r, --root <path>", "Project root", process.cwd())
    .option("-j, --json", "Output as JSON")
    .option("--save", "Save report to .cortex/history/")
    .action((opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);
      if (!index) {
        console.error("\n  No index found. Run `cortex init` first.\n");
        process.exit(1);
      }
      const graph = buildGraph(index.files);
      const analysis = analyzeDependencies(graph);
      const memory = loadMemory(root);
      const report = generateUnifiedReport({ index, analysis, memory, root });

      if (opts.save) {
        const snapshot = createSnapshot(report);
        saveReportSnapshot(root, snapshot);
      }

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        printReport(report);
      }
    });
}

function printReport(report: Awaited<ReturnType<typeof generateUnifiedReport>>): void {
  const scoreIcon = report.overallScore >= 80 ? "G" : report.overallScore >= 60 ? "Y" : "R";

  console.log(`\n  CORTEX REPORT`);
  console.log("  " + "═".repeat(42));
  console.log(`  Overall Score: [${scoreIcon}] ${report.overallScore}/100`);
  console.log(`  Files: ${report.metadata.filesAnalyzed} | Findings: ${report.metadata.totalFindings} (C:${report.metadata.critical} W:${report.metadata.warnings} I:${report.metadata.info})`);

  for (const result of report.agents) {
    const agentIcon = result.score >= 80 ? "G" : result.score >= 60 ? "Y" : "R";
    console.log(`\n  [${agentIcon}] ${result.agent.toUpperCase()} — ${result.score}/100`);
    console.log("  " + "─".repeat(42));
    console.log(`  ${result.summary}`);
  }

  if (report.prioritizedActions.length > 0) {
    console.log(`\n  TOP ACTIONS`);
    console.log("  " + "─".repeat(42));
    for (const action of report.prioritizedActions.slice(0, 10)) {
      const sev = action.severity === "critical" ? "X" : action.severity === "warning" ? "!" : "i";
      const loc = action.file ? ` ${action.file}` : "";
      console.log(`    [${sev}] ${action.category}${loc}`);
      console.log(`      ${action.message}`);
      if (action.suggestion) console.log(`      → ${action.suggestion}`);
    }
  }

  console.log("");
}
