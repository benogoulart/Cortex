import type { Command } from "commander";
import { loadIndex, getDiff, getStagedDiff, reviewDiff } from "@cortex/core";
import type { ReviewResult, ReviewSeverity, ReviewCategory, ReviewFinding } from "@cortex/core";
import { resolve } from "node:path";

const SEVERITY_ICONS: Record<ReviewSeverity, string> = {
  critical: "X",
  warning: "!",
  info: "i",
};

const CATEGORY_LABELS: Record<ReviewCategory, string> = {
  architecture: "Architecture",
  security: "Security",
  testing: "Testing",
  complexity: "Complexity",
  quality: "Quality",
};

export function reviewCommand(program: Command): void {
  program
    .command("review")
    .description("Review git diff for architecture, security and test issues")
    .option("-r, --root <path>", "Project root", process.cwd())
    .option("--staged", "Review staged changes instead of unstaged")
    .option("-t, --target <ref>", "Git ref to diff against", "HEAD")
    .action((opts) => {
      const root = resolve(opts.root);
      const index = loadIndex(root);

      const diffOutput = opts.staged
        ? getStagedDiff(root)
        : getDiff(root, opts.target);

      if (!diffOutput.trim()) {
        console.log("\n  No changes to review.\n");
        return;
      }

      const result = reviewDiff(index, diffOutput);

      printReview(result, opts.staged);
    });
}

function printReview(result: ReviewResult, staged: boolean): void {
  const { summary, findings, score, stats } = result;

  const mode = staged ? "STAGED" : "UNSTAGED";
  const scoreIcon = score >= 80 ? "G" : score >= 60 ? "Y" : "R";

  console.log(`\n  CODE REVIEW (${mode})`);
  console.log("  " + "─".repeat(40));
  console.log(`  Files changed: ${stats.filesChanged}`);
  console.log(`  Additions:     +${summary.totalAdditions}`);
  console.log(`  Deletions:     -${summary.totalDeletions}`);
  console.log(`  Score:         ${scoreIcon} ${score}/100`);

  if (summary.files.length > 0) {
    console.log("\n  Files:");
    for (const file of summary.files) {
      const status = file.status === "added" ? "A" : file.status === "deleted" ? "D" : file.status === "renamed" ? "R" : "M";
      console.log(`    [${status}] ${file.file} (+${file.additions} -${file.deletions})`);
    }
  }

  if (findings.length === 0) {
    console.log("\n  No issues found.\n");
    return;
  }

  console.log(`\n  FINDINGS: ${stats.totalFindings}`);
  console.log("  " + "─".repeat(40));

  if (stats.critical > 0) {
    console.log(`\n  CRITICAL (${stats.critical})`);
    for (const f of findings.filter((f) => f.severity === "critical")) {
      printFinding(f);
    }
  }

  if (stats.warnings > 0) {
    console.log(`\n  WARNINGS (${stats.warnings})`);
    for (const f of findings.filter((f) => f.severity === "warning")) {
      printFinding(f);
    }
  }

  if (stats.info > 0) {
    console.log(`\n  INFO (${stats.info})`);
    for (const f of findings.filter((f) => f.severity === "info")) {
      printFinding(f);
    }
  }

  console.log("");
}

function printFinding(f: ReviewFinding): void {
  const icon = SEVERITY_ICONS[f.severity];
  const cat = CATEGORY_LABELS[f.category];
  const loc = f.line ? `:${f.line}` : "";
  console.log(`    [${icon}] ${cat} — ${f.file}${loc}`);
  console.log(`      ${f.message}`);
  if (f.suggestion) {
    console.log(`      → ${f.suggestion}`);
  }
}
