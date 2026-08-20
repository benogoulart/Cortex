import type { AgentContext, Agent } from "./types.js";
import type {
  AgentResult,
  AgentFinding,
  LayerInfo,
  LayerViolation,
  CouplingMetrics,
  ArchitecturalReport,
  FileEntry,
} from "../types/index.js";
import { buildGraph, detectCycles } from "../graph/index.js";
import type { DependencyGraph } from "../graph/index.js";

let findingCounter = 0;
function fid(): string {
  return `arch_${++findingCounter}`;
}

const LAYER_PATTERNS: Record<string, RegExp[]> = {
  presentation: [/\/(?:views?|components?|pages?|screens?|ui)\//i],
  api: [/\/(?:controllers?|routes?|handlers?|endpoints?|graphql)\//i],
  service: [/\/(?:services?|usecases?|interactors?|managers?)\//i],
  data: [/\/(?:repositories?|models?|entities?|dal|orm|dao|schemas?)\//i],
  infra: [/\/(?:infra|infrastructure|config|utils|helpers?|lib|shared)\//i],
};

const LAYER_ORDER = ["presentation", "api", "service", "data", "infra"];

function detectLayer(file: FileEntry): string | null {
  for (const [layer, patterns] of Object.entries(LAYER_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(file.path) || pattern.test(file.relativePath)) {
        return layer;
      }
    }
  }
  return null;
}

function computeCoupling(
  files: FileEntry[],
  graph: DependencyGraph
): CouplingMetrics {
  const instability: Record<string, number> = {};
  const ac: Record<string, number> = {};
  const ec: Record<string, number> = {};

  for (const file of files) {
    const rel = file.relativePath;
    const deps = graph.adjacency.get(rel) ?? new Set();
    const dependents = graph.reverseAdjacency.get(rel) ?? new Set();
    ec[rel] = deps.size;
    ac[rel] = dependents.size;
    const total = ac[rel] + ec[rel];
    instability[rel] = total === 0 ? 0 : ec[rel] / total;
  }

  return { instability, afferentCoupling: ac, efferentCoupling: ec };
}

function checkLayerViolations(
  layers: Map<string, string[]>,
  graph: DependencyGraph
): LayerViolation[] {
  const violations: LayerViolation[] = [];

  for (const [layerName, layerFiles] of Object.entries(layers)) {
    const layerIdx = LAYER_ORDER.indexOf(layerName);
    if (layerIdx < 0) continue;

    for (const file of layerFiles) {
      const deps = graph.adjacency.get(file) ?? new Set();
      for (const dep of deps) {
        for (const [targetLayer, targetFiles] of Object.entries(layers)) {
          if (targetLayer === layerName) continue;
          if (!targetFiles.includes(dep)) continue;

          const targetIdx = LAYER_ORDER.indexOf(targetLayer);
          if (targetIdx >= 0 && targetIdx < layerIdx) {
            violations.push({
              file,
              fromLayer: layerName,
              toLayer: targetLayer,
              message: `${layerName} layer imports from ${targetLayer} layer (dependency should flow inward)`,
            });
          }
        }
      }
    }
  }

  return violations;
}

function computeDebtScore(
  cycles: string[][],
  violations: LayerViolation[],
  coupling: CouplingMetrics,
  fileCount: number
): number {
  let debt = 0;

  debt += cycles.length * 20;

  debt += violations.length * 5;

  const highCoupling = Object.values(coupling.instability).filter(
    (v) => v > 0.8
  ).length;
  debt += Math.min(highCoupling * 2, 30);

  const avgCoupling =
    Object.values(coupling.instability).reduce((a, b) => a + b, 0) /
    Math.max(fileCount, 1);
  if (avgCoupling > 0.5) debt += 10;

  return Math.min(debt, 100);
}

export function analyzeArchitecture(ctx: AgentContext): ArchitecturalReport {
  const findings: AgentFinding[] = [];
  const { index, analysis } = ctx;
  const graph = buildGraph(index.files);

  const layers = new Map<string, string[]>();
  for (const file of index.files) {
    const layer = detectLayer(file);
    if (layer) {
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer)!.push(file.relativePath);
    }
  }

  const layerViolations = checkLayerViolations(layers, graph);
  for (const v of layerViolations) {
    findings.push({
      id: fid(),
      severity: "warning",
      category: "architecture",
      file: v.file,
      message: v.message,
      suggestion: `Move dependency from ${v.fromLayer} to a higher-level layer`,
    });
  }

  const layerInfos: LayerInfo[] = [];
  for (const [name, files] of layers) {
    const violations = layerViolations.filter((v) => v.fromLayer === name);
    layerInfos.push({ name, files, violations });
  }

  const coupling = computeCoupling(index.files, graph);

  for (const [file, inst] of Object.entries(coupling.instability)) {
    if (inst > 0.8 && coupling.afferentCoupling[file] > 3) {
      findings.push({
        id: fid(),
        severity: "info",
        category: "coupling",
        file,
        message: `High instability (${inst.toFixed(2)}) with ${coupling.afferentCoupling[file]} dependents`,
        suggestion: "Consider extracting a stable abstraction",
      });
    }
  }

  const cycles = analysis.cycles;
  for (const cycle of cycles) {
    findings.push({
      id: fid(),
      severity: "critical",
      category: "cycle",
      message: `Circular dependency: ${cycle.join(" → ")}`,
      suggestion: "Break the cycle by extracting a shared interface or module",
    });
  }

  const debtScore = computeDebtScore(
    cycles,
    layerViolations,
    coupling,
    index.files.length
  );

  const critical = findings.filter((f) => f.severity === "critical").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const score = Math.max(0, 100 - critical * 15 - warnings * 5 - debtScore);

  return {
    agent: "architect",
    summary: `Analyzed ${index.files.length} files across ${layers.size} layers. Found ${cycles.length} cycles, ${layerViolations.length} layer violations. Debt score: ${debtScore}/100.`,
    findings,
    score,
    layers: layerInfos,
    metrics: coupling,
    debtScore,
  };
}

export const architectAgent: Agent = {
  name: "architect",
  analyze: analyzeArchitecture,
};
