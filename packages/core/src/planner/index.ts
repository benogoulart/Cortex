import type {
  ProjectIndex,
  ExecutionPlan,
  PlanTask,
  PlanPhase,
  AffectedModule,
  TaskPriority,
  FileEntry,
  Symbol,
} from "../types/index.js";
import { parseQuery, semanticSearch } from "../search/index.js";
import {
  buildGraph,
  analyzeDependencies,
  findDependencies,
  findDependents,
} from "../graph/index.js";

const PHASE_ORDER: PlanPhase[] = [
  "discovery",
  "architecture",
  "implementation",
  "testing",
  "security",
  "deployment",
];

const PHASE_LABELS: Record<PlanPhase, string> = {
  discovery: "Discovery",
  architecture: "Architecture",
  implementation: "Implementation",
  testing: "Testing",
  security: "Security",
  deployment: "Deployment",
};

const TASK_KEYWORDS: Record<PlanPhase, string[]> = {
  discovery: [
    "understand", "inspect", "analyze", "review", "research",
    "investigate", "explore", "examine", "audit", "assess",
  ],
  architecture: [
    "design", "define", "plan", "architect", "structure",
    "abstract", "model", "specify", "outline", "schema",
  ],
  implementation: [
    "implement", "create", "add", "build", "develop",
    "write", "code", "integrate", "connect", "wire",
  ],
  testing: [
    "test", "verify", "validate", "check", "assert",
    "unit test", "integration test", "e2e test",
  ],
  security: [
    "security", "auth", "validate", "sanitize", "protect",
    "encrypt", "secret", "token", "permission", "access",
  ],
  deployment: [
    "deploy", "release", "migrate", "configure", "setup",
    "ci", "cd", "pipeline", "environment", "build",
  ],
};

export function generatePlan(
  index: ProjectIndex,
  taskDescription: string
): ExecutionPlan {
  const terms = taskDescription
    .toLowerCase()
    .split(/[\s\-_/\\]+/)
    .filter((t) => t.length > 1);

  const query = parseQuery(taskDescription);
  const searchResults = semanticSearch(index.files, query, 20);
  const graph = buildGraph(index.files);
  const analysis = analyzeDependencies(graph);

  const affectedModules = identifyAffectedModules(
    index.files,
    searchResults,
    graph,
    terms
  );

  const riskAssessment = assessRisk(affectedModules, analysis, index.files);

  const phases = generatePhases(
    taskDescription,
    terms,
    affectedModules,
    index.files,
    graph
  );

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);

  return {
    id: generatePlanId(),
    title: extractTitle(taskDescription),
    description: generateDescription(taskDescription, affectedModules),
    taskDescription,
    createdAt: new Date().toISOString(),
    risk: riskAssessment.level,
    riskFactors: riskAssessment.factors,
    affectedModules,
    phases,
    totalTasks,
    estimatedComplexity: computeComplexity(affectedModules, totalTasks, riskAssessment.level),
  };
}

function identifyAffectedModules(
  files: FileEntry[],
  searchResults: { file: string; relevance: number; matchedSymbols: Symbol[] }[],
  graph: any,
  terms: string[]
): AffectedModule[] {
  const modules = new Map<string, AffectedModule>();

  for (const result of searchResults) {
    if (result.relevance < 5) continue;

    const file = files.find((f) => f.relativePath === result.file);
    if (!file) continue;

    const dir = file.relativePath.split("/").slice(0, -1).join("/") || ".";
    const existing = modules.get(dir);

    const deps = findDependencies(graph, file.relativePath);
    const dependents = findDependents(graph, file.relativePath);
    const totalImpact = deps.length + dependents.length;

    const risk: "low" | "medium" | "high" =
      totalImpact > 10 ? "high" : totalImpact > 4 ? "medium" : "low";

    if (existing) {
      existing.symbols.push(...result.matchedSymbols.map((s) => s.name));
      if (risk === "high") existing.risk = "high";
      else if (risk === "medium" && existing.risk !== "high") existing.risk = "medium";
    } else {
      modules.set(dir, {
        path: dir,
        reason: generateModuleReason(file, terms),
        risk,
        symbols: result.matchedSymbols.map((s) => s.name),
      });
    }
  }

  return Array.from(modules.values()).sort((a, b) => {
    const riskOrder = { high: 0, medium: 1, low: 2 };
    return riskOrder[a.risk] - riskOrder[b.risk];
  });
}

function generateModuleReason(file: FileEntry, terms: string[]): string {
  const matchedSymbols = file.symbols.filter((s) =>
    terms.some((t) => s.name.toLowerCase().includes(t))
  );

  if (matchedSymbols.length > 0) {
    const names = matchedSymbols.map((s) => s.name).join(", ");
    return `Contains relevant symbols: ${names}`;
  }

  const matchedImports = file.imports.filter((imp) =>
    terms.some((t) => imp.toLowerCase().includes(t))
  );

  if (matchedImports.length > 0) {
    return `Imports relevant modules: ${matchedImports.join(", ")}`;
  }

  return `File path matches task context`;
}

function assessRisk(
  affectedModules: AffectedModule[],
  analysis: ReturnType<typeof analyzeDependencies>,
  files: FileEntry[]
): { level: "low" | "medium" | "high" | "critical"; factors: string[] } {
  const factors: string[] = [];
  let score = 0;

  const highRiskModules = affectedModules.filter((m) => m.risk === "high");
  if (highRiskModules.length > 0) {
    score += highRiskModules.length * 3;
    factors.push(
      `${highRiskModules.length} high-impact module(s) affected`
    );
  }

  const totalAffected = affectedModules.length;
  if (totalAffected > 5) {
    score += 3;
    factors.push(`Wide scope: ${totalAffected} modules affected`);
  } else if (totalAffected > 3) {
    score += 1;
    factors.push(`Moderate scope: ${totalAffected} modules affected`);
  }

  if (analysis.cycles.length > 0) {
    score += 2;
    factors.push(`${analysis.cycles.length} circular dependency(ies) in codebase`);
  }

  const totalSymbols = affectedModules.reduce(
    (sum, m) => sum + m.symbols.length,
    0
  );
  if (totalSymbols > 10) {
    score += 2;
    factors.push(`Many symbols involved: ${totalSymbols}`);
  }

  const largeFiles = files.filter((f) => f.lines > 500);
  if (largeFiles.length > 0) {
    score += 1;
    factors.push(`${largeFiles.length} large file(s) (>500 lines) in codebase`);
  }

  const level =
    score >= 8 ? "critical" : score >= 5 ? "high" : score >= 2 ? "medium" : "low";

  if (factors.length === 0) {
    factors.push("Limited scope, low impact");
  }

  return { level, factors };
}

function generatePhases(
  taskDescription: string,
  terms: string[],
  affectedModules: AffectedModule[],
  files: FileEntry[],
  graph: any
): { phase: PlanPhase; label: string; tasks: PlanTask[] }[] {
  const phases: { phase: PlanPhase; label: string; tasks: PlanTask[] }[] = [];

  const discoveryTasks = generateDiscoveryTasks(
    taskDescription,
    terms,
    affectedModules,
    files
  );
  phases.push({
    phase: "discovery",
    label: PHASE_LABELS.discovery,
    tasks: discoveryTasks,
  });

  const architectureTasks = generateArchitectureTasks(
    taskDescription,
    terms,
    affectedModules
  );
  phases.push({
    phase: "architecture",
    label: PHASE_LABELS.architecture,
    tasks: architectureTasks,
  });

  const implementationTasks = generateImplementationTasks(
    taskDescription,
    terms,
    affectedModules
  );
  phases.push({
    phase: "implementation",
    label: PHASE_LABELS.implementation,
    tasks: implementationTasks,
  });

  const testingTasks = generateTestingTasks(affectedModules);
  phases.push({
    phase: "testing",
    label: PHASE_LABELS.testing,
    tasks: testingTasks,
  });

  const securityTasks = generateSecurityTasks(terms, affectedModules);
  if (securityTasks.length > 0) {
    phases.push({
      phase: "security",
      label: PHASE_LABELS.security,
      tasks: securityTasks,
    });
  }

  return phases;
}

function generateDiscoveryTasks(
  taskDescription: string,
  terms: string[],
  affectedModules: AffectedModule[],
  files: FileEntry[]
): PlanTask[] {
  const tasks: PlanTask[] = [];

  for (const mod of affectedModules.slice(0, 5)) {
    tasks.push({
      id: generateTaskId(),
      description: `Understand current state of ${mod.path}`,
      phase: "discovery",
      priority: mod.risk === "high" ? "critical" : "high",
      affectedFiles: [mod.path],
      dependsOn: [],
      completed: false,
    });
  }

  const relatedSymbols = affectedModules.flatMap((m) => m.symbols);
  if (relatedSymbols.length > 0) {
    tasks.push({
      id: generateTaskId(),
      description: `Review existing patterns for: ${relatedSymbols.slice(0, 5).join(", ")}`,
      phase: "discovery",
      priority: "medium",
      affectedFiles: affectedModules.map((m) => m.path),
      dependsOn: [],
      completed: false,
    });
  }

  return tasks;
}

function generateArchitectureTasks(
  taskDescription: string,
  terms: string[],
  affectedModules: AffectedModule[]
): PlanTask[] {
  const tasks: PlanTask[] = [];

  if (affectedModules.some((m) => m.risk === "high")) {
    tasks.push({
      id: generateTaskId(),
      description: "Define module boundaries and interfaces",
      phase: "architecture",
      priority: "critical",
      affectedFiles: affectedModules.filter((m) => m.risk === "high").map((m) => m.path),
      dependsOn: [],
      completed: false,
    });
  }

  tasks.push({
    id: generateTaskId(),
    description: "Define data flow and dependencies",
    phase: "architecture",
    priority: "high",
    affectedFiles: affectedModules.map((m) => m.path),
    dependsOn: [],
    completed: false,
  });

  if (terms.some((t) => ["api", "endpoint", "route", "controller", "service"].includes(t))) {
    tasks.push({
      id: generateTaskId(),
      description: "Design API contracts and service boundaries",
      phase: "architecture",
      priority: "high",
      affectedFiles: [],
      dependsOn: [],
      completed: false,
    });
  }

  if (terms.some((t) => ["database", "model", "schema", "migration", "orm", "prisma"].includes(t))) {
    tasks.push({
      id: generateTaskId(),
      description: "Design database schema and migrations",
      phase: "architecture",
      priority: "high",
      affectedFiles: [],
      dependsOn: [],
      completed: false,
    });
  }

  return tasks;
}

function generateImplementationTasks(
  taskDescription: string,
  terms: string[],
  affectedModules: AffectedModule[]
): PlanTask[] {
  const tasks: PlanTask[] = [];

  for (const mod of affectedModules) {
    for (const sym of mod.symbols.slice(0, 3)) {
      tasks.push({
        id: generateTaskId(),
        description: `Implement ${sym} in ${mod.path}`,
        phase: "implementation",
        priority: mod.risk === "high" ? "high" : "medium",
        affectedFiles: [mod.path],
        dependsOn: [],
        completed: false,
      });
    }

    if (mod.symbols.length === 0) {
      tasks.push({
        id: generateTaskId(),
        description: `Update ${mod.path}`,
        phase: "implementation",
        priority: "medium",
        affectedFiles: [mod.path],
        dependsOn: [],
        completed: false,
      });
    }
  }

  if (tasks.length === 0) {
    tasks.push({
      id: generateTaskId(),
      description: `Implement core changes for: ${taskDescription}`,
      phase: "implementation",
      priority: "high",
      affectedFiles: [],
      dependsOn: [],
      completed: false,
    });
  }

  return tasks;
}

function generateTestingTasks(affectedModules: AffectedModule[]): PlanTask[] {
  const tasks: PlanTask[] = [];

  for (const mod of affectedModules) {
    if (mod.risk === "high" || mod.symbols.length > 2) {
      tasks.push({
        id: generateTaskId(),
        description: `Add tests for ${mod.path}`,
        phase: "testing",
        priority: "high",
        affectedFiles: [mod.path],
        dependsOn: [],
        completed: false,
      });
    }
  }

  if (affectedModules.length > 2) {
    tasks.push({
      id: generateTaskId(),
      description: "Add integration tests for cross-module interactions",
      phase: "testing",
      priority: "medium",
      affectedFiles: affectedModules.map((m) => m.path),
      dependsOn: [],
      completed: false,
    });
  }

  tasks.push({
    id: generateTaskId(),
    description: "Verify existing tests still pass",
    phase: "testing",
    priority: "critical",
    affectedFiles: [],
    dependsOn: [],
    completed: false,
  });

  return tasks;
}

function generateSecurityTasks(
  terms: string[],
  affectedModules: AffectedModule[]
): PlanTask[] {
  const tasks: PlanTask[] = [];

  const securityTerms = [
    "auth", "password", "token", "secret", "session",
    "permission", "access", "role", "user", "payment",
    "billing", "crypto", "hash", "encrypt",
  ];

  const isSecurityRelated = terms.some((t) =>
    securityTerms.some((st) => t.includes(st))
  );

  if (isSecurityRelated) {
    tasks.push({
      id: generateTaskId(),
      description: "Review security implications",
      phase: "security",
      priority: "critical",
      affectedFiles: affectedModules.map((m) => m.path),
      dependsOn: [],
      completed: false,
    });

    tasks.push({
      id: generateTaskId(),
      description: "Validate input sanitization and output encoding",
      phase: "security",
      priority: "high",
      affectedFiles: [],
      dependsOn: [],
      completed: false,
    });

    tasks.push({
      id: generateTaskId(),
      description: "Check for hardcoded secrets or credentials",
      phase: "security",
      priority: "high",
      affectedFiles: [],
      dependsOn: [],
      completed: false,
    });
  }

  return tasks;
}

function extractTitle(taskDescription: string): string {
  const words = taskDescription.split(/\s+/);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function generateDescription(
  taskDescription: string,
  affectedModules: AffectedModule[]
): string {
  const moduleCount = affectedModules.length;
  const highRisk = affectedModules.filter((m) => m.risk === "high").length;

  let desc = `Plan for: ${taskDescription}. `;
  desc += `${moduleCount} module(s) affected`;

  if (highRisk > 0) {
    desc += ` (${highRisk} high-impact)`;
  }
  desc += ".";

  return desc;
}

function computeComplexity(
  affectedModules: AffectedModule[],
  totalTasks: number,
  risk: string
): number {
  let complexity = 0;

  complexity += affectedModules.length * 2;
  complexity += totalTasks;
  complexity += risk === "critical" ? 10 : risk === "high" ? 6 : risk === "medium" ? 3 : 1;

  return Math.min(complexity, 100);
}

function generatePlanId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "plan_";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function generateTaskId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "task_";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
