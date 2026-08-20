import type { Command } from "commander";
import { listReportSnapshots, listPlans } from "@cortex/core";
import { resolve } from "node:path";

export function historyCommand(program: Command): void {
  const cmd = program
    .command("history")
    .description("Show project history — reports and plans")
    .option("-r, --root <path>", "Project root", process.cwd());

  cmd
    .command("reports")
    .description("List past report snapshots")
    .option("-j, --json", "Output as JSON")
    .action((opts) => {
      const root = resolve(opts.root);
      const snapshots = listReportSnapshots(root);

      if (opts.json) {
        console.log(JSON.stringify(snapshots, null, 2));
        return;
      }

      if (snapshots.length === 0) {
        console.log("\n  No report snapshots found. Run `cortex report --save` first.\n");
        return;
      }

      console.log("\n  REPORT HISTORY");
      console.log("  " + "─".repeat(42));
      for (const snap of snapshots) {
        const date = new Date(snap.timestamp).toLocaleString();
        console.log(`    ${snap.id}  ${date}`);
      }
      console.log("");
    });

  cmd
    .command("plans")
    .description("List saved plans")
    .option("-j, --json", "Output as JSON")
    .action((opts) => {
      const root = resolve(opts.root);
      const plans = listPlans(root);

      if (opts.json) {
        console.log(JSON.stringify(plans, null, 2));
        return;
      }

      if (plans.length === 0) {
        console.log("\n  No saved plans found. Run `cortex plan --save` first.\n");
        return;
      }

      console.log("\n  PLAN HISTORY");
      console.log("  " + "─".repeat(42));
      for (const plan of plans) {
        const date = new Date(plan.createdAt).toLocaleString();
        console.log(`    ${plan.planId}`);
        console.log(`      ${plan.title} [${plan.risk}]`);
        console.log(`      ${date} | ${plan.totalTasks} tasks | complexity ${plan.estimatedComplexity}/100`);
      }
      console.log("");
    });
}
