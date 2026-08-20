import type { Command } from "commander";
import { loadIndex, generatePlan, savePlan } from "@cortex/core";
import type { ExecutionPlan, PlanPhase } from "@cortex/core";
import { resolve } from "node:path";

const PHASE_ICONS: Record<PlanPhase, string> = {
  discovery: "?",
  architecture: "A",
  implementation: "I",
  testing: "T",
  security: "S",
  deployment: "D",
};

const RISK_ICONS: Record<string, string> = {
  low: "L",
  medium: "M",
  high: "H",
  critical: "C",
};

const PRIORITY_ICONS: Record<string, string> = {
  critical: "!!!",
  high: "!!",
  medium: "!",
  low: ".",
};

export function planCommand(program: Command): void {
  program
    .command("plan <description>")
    .description("Generate a structured execution plan from a task description")
    .option("-r, --root <path>", "Project root", process.cwd())
    .option("-j, --json", "Output as JSON")
    .option("--save", "Save plan to .cortex/plans/")
    .action((description: string, opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);

      if (!index) {
        console.error("\n  No index found. Run `cortex init` first.\n");
        process.exit(1);
      }

      const plan = generatePlan(index, description);

      if (opts.save) {
        savePlan(root, plan);
      }

      if (opts.json) {
        console.log(JSON.stringify(plan, null, 2));
      } else {
        printPlan(plan);
      }
    });
}

function printPlan(plan: ExecutionPlan): void {
  const riskIcon = RISK_ICONS[plan.risk];

  console.log(`\n  ${plan.title.toUpperCase()}`);
  console.log("  " + "─".repeat(40));
  console.log(`  ${plan.description}`);
  console.log(`  Risk: ${riskIcon} ${plan.risk.toUpperCase()}`);
  console.log(`  Complexity: ${plan.estimatedComplexity}/100`);
  console.log(`  Tasks: ${plan.totalTasks}`);

  if (plan.riskFactors.length > 0) {
    console.log("\n  Risk factors:");
    for (const factor of plan.riskFactors) {
      console.log(`    - ${factor}`);
    }
  }

  if (plan.affectedModules.length > 0) {
    console.log("\n  Affected modules:");
    for (const mod of plan.affectedModules) {
      const riskTag = `[${mod.risk}]`;
      console.log(`    ${mod.path} ${riskTag}`);
      console.log(`      ${mod.reason}`);
      if (mod.symbols.length > 0) {
        console.log(`      symbols: ${mod.symbols.join(", ")}`);
      }
    }
  }

  for (const { phase, label, tasks } of plan.phases) {
    const icon = PHASE_ICONS[phase];
    console.log(`\n  ${icon} ${label.toUpperCase()}`);
    console.log("  " + "─".repeat(40));

    for (const task of tasks) {
      const pri = PRIORITY_ICONS[task.priority];
      const check = task.completed ? "x" : " ";
      console.log(`    [${check}] ${pri} ${task.description}`);

      if (task.affectedFiles.length > 0) {
        const files = task.affectedFiles.slice(0, 3).join(", ");
        const more =
          task.affectedFiles.length > 3
            ? ` +${task.affectedFiles.length - 3} more`
            : "";
        console.log(`        files: ${files}${more}`);
      }
    }
  }

  console.log("");
}
