import type { AgentResult, AgentFinding, UnifiedReport, ReportSnapshot } from "../types/index.js";
import { runAllAgents } from "../agents/index.js";
import type { AgentContext } from "../agents/types.js";

export function generateUnifiedReport(ctx: AgentContext): UnifiedReport {
  const results = runAllAgents(ctx);

  const perFile: Record<string, AgentFinding[]> = {};
  const allFindings: AgentFinding[] = [];

  for (const result of results) {
    for (const finding of result.findings) {
      allFindings.push(finding);
      if (finding.file) {
        if (!perFile[finding.file]) perFile[finding.file] = [];
        perFile[finding.file].push(finding);
      }
    }
  }

  const severityWeight = { critical: 3, warning: 2, info: 1 };
  const prioritizedActions = [...allFindings].sort((a, b) => {
    const wa = severityWeight[a.severity];
    const wb = severityWeight[b.severity];
    if (wb !== wa) return wb - wa;
    if (a.file && b.file) return a.file.localeCompare(b.file);
    return 0;
  });

  const overallScore = Math.round(
    results.reduce((sum, r) => sum + r.score, 0) / results.length
  );

  return {
    id: `report_${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    overallScore,
    agents: results,
    perFile,
    prioritizedActions,
    metadata: {
      filesAnalyzed: ctx.index.files.length,
      totalFindings: allFindings.length,
      critical: allFindings.filter((f) => f.severity === "critical").length,
      warnings: allFindings.filter((f) => f.severity === "warning").length,
      info: allFindings.filter((f) => f.severity === "info").length,
    },
  };
}

export function createSnapshot(report: UnifiedReport): ReportSnapshot {
  return {
    id: report.id,
    timestamp: report.timestamp,
    report,
  };
}
