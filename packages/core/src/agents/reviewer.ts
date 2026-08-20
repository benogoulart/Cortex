import type { AgentContext, Agent } from "./types.js";
import type {
  AgentFinding,
  ReviewResult,
  ReviewSeverity,
  MemoryEntry,
  FileEntry,
} from "../types/index.js";
import { buildGraph } from "../graph/index.js";
import type { DependencyGraph } from "../graph/index.js";
import { getDiff, getStagedDiff, reviewDiff } from "../review/index.js";
import { readFileSync } from "node:fs";

let findingCounter = 0;
function fid(): string {
  return `rev_${++findingCounter}`;
}

function checkConventionViolations(
  memory: MemoryEntry[],
  files: FileEntry[]
): AgentFinding[] {
  const findings: AgentFinding[] = [];
  const conventions = memory.filter(
    (e) => e.category === "convention" || e.category === "pattern"
  );
  const mistakes = memory.filter((e) => e.category === "mistake");

  for (const file of files) {
    for (const entry of conventions) {
      const keywords = entry.text
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const fileLower = file.relativePath.toLowerCase();
      const matches = keywords.filter((k) => fileLower.includes(k));
      if (matches.length >= 2) {
        findings.push({
          id: fid(),
          severity: "info",
          category: "convention",
          file: file.relativePath,
          message: `File may relate to convention: "${entry.text.slice(0, 80)}"`,
          suggestion: "Review against saved conventions",
        });
      }
    }

    for (const entry of mistakes) {
      const keywords = entry.text
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4);
      const fileLower = file.relativePath.toLowerCase();
      const matches = keywords.filter((k) => fileLower.includes(k));
      if (matches.length >= 2) {
        findings.push({
          id: fid(),
          severity: "warning",
          category: "past-mistake",
          file: file.relativePath,
          message: `File may relate to past mistake: "${entry.text.slice(0, 80)}"`,
          suggestion: "Check if this mistake is being repeated",
        });
      }
    }
  }

  return findings;
}

function checkCallerImpact(
  changedFiles: string[],
  graph: DependencyGraph
): AgentFinding[] {
  const findings: AgentFinding[] = [];

  for (const file of changedFiles) {
    const callers = graph.reverseAdjacency.get(file) ?? new Set();
    if (callers.size > 5) {
      findings.push({
        id: fid(),
        severity: "warning",
        category: "impact",
        file,
        message: `${callers.size} files depend on this module — changes may have wide impact`,
        suggestion: "Verify all callers are compatible with changes",
      });
    }
  }

  return findings;
}

function checkUntestedChangedCode(
  changedFiles: string[],
  indexFiles: FileEntry[]
): AgentFinding[] {
  const findings: AgentFinding[] = [];
  const testFiles = indexFiles.filter((f) =>
    /(?:test|spec|__tests__)/i.test(f.path)
  );

  const newFunctions: { file: string; name: string; line: number }[] = [];
  const addedLines = changedFiles;

  for (const file of addedLines) {
    const entry = indexFiles.find((f) => f.relativePath === file);
    if (!entry) continue;

    for (const sym of entry.symbols) {
      if (sym.kind === "function" || sym.kind === "class") {
        const hasTest = testFiles.some((tf) =>
          tf.symbols.some(
            (ts) =>
              ts.name.includes(sym.name) ||
              tf.path.toLowerCase().includes(sym.name.toLowerCase())
          )
        );
        if (!hasTest) {
          newFunctions.push({
            file: file,
            name: sym.name,
            line: sym.line,
          });
        }
      }
    }
  }

  for (const fn of newFunctions) {
    findings.push({
      id: fid(),
      severity: "warning",
      category: "testing",
      file: fn.file,
      line: fn.line,
      message: `${fn.name}() lacks a corresponding test`,
      suggestion: `Add tests for ${fn.name} in a test file`,
    });
  }

  return findings;
}

function readFileContent(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function checkCodeQuality(
  files: FileEntry[],
  root: string
): AgentFinding[] {
  const findings: AgentFinding[] = [];

  for (const file of files) {
    if (file.language === "json") continue;
    const content = readFileContent(`${root}/${file.relativePath}`);
    if (!content) continue;

    const lines = content.split("\n");

    let complexity = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        /(?:if|else if|for|while|switch|case|catch|&&|\|\||\?)/.test(trimmed)
      ) {
        complexity++;
      }
    }

    if (complexity > 20) {
      findings.push({
        id: fid(),
        severity: "warning",
        category: "complexity",
        file: file.relativePath,
        message: `High cyclomatic complexity (${complexity} decision points)`,
        suggestion: "Break into smaller functions",
      });
    }

    const longFunctions = lines.filter((l) => l.length > 150);
    if (longFunctions.length > 0) {
      findings.push({
        id: fid(),
        severity: "info",
        category: "quality",
        file: file.relativePath,
        message: `${longFunctions.length} line(s) exceed 150 characters`,
      });
    }
  }

  return findings;
}

export function reviewEnhanced(ctx: AgentContext): ReviewResult {
  const { index, files, root } = ctx;
  const findings: AgentFinding[] = [];

  const graph = buildGraph(index.files);

  const diffTarget = files?.length ? undefined : "HEAD";
  const diffOutput = root
    ? getDiff(root, diffTarget)
    : "";
  const baseReview = diffOutput
    ? reviewDiff(index, diffOutput)
    : {
        summary: { files: [], totalAdditions: 0, totalDeletions: 0 },
        findings: [],
        score: 100,
        stats: {
          filesChanged: 0,
          totalFindings: 0,
          critical: 0,
          warnings: 0,
          info: 0,
        },
      };

  findings.push(...baseReview.findings);

  if (ctx.memory) {
    const convViolations = checkConventionViolations(
      ctx.memory.entries,
      index.files
    );
    findings.push(...convViolations);
  }

  const changedFiles =
    files ??
    baseReview.summary.files.map((f) => f.file);
  const callerImpact = checkCallerImpact(changedFiles, graph);
  findings.push(...callerImpact);

  const testGaps = checkUntestedChangedCode(changedFiles, index.files);
  findings.push(...testGaps);

  if (root) {
    const qualityIssues = checkCodeQuality(index.files, root);
    findings.push(...qualityIssues);
  }

  const critical = findings.filter((f) => f.severity === "critical").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const info = findings.filter((f) => f.severity === "info").length;

  const score = Math.max(
    0,
    baseReview.score - critical * 10 - warnings * 3 - info
  );

  return {
    summary: baseReview.summary,
    findings: findings
      .filter((f): f is AgentFinding & { file: string } => !!f.file)
      .map((f) => ({
        ...f,
        category: f.category as ReviewResult["findings"][0]["category"],
      })),
    score,
    stats: {
      filesChanged: baseReview.summary.files.length,
      totalFindings: findings.length,
      critical,
      warnings,
      info,
    },
  };
}

export const reviewerAgent: Agent = {
  name: "reviewer",
  analyze: (ctx) => {
    const result = reviewEnhanced(ctx);
    return {
      agent: "reviewer",
      summary: `Enhanced review: ${result.stats.totalFindings} findings (score: ${result.score}/100)`,
      findings: result.findings,
      score: result.score,
    };
  },
};
