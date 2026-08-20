import type {
  ProjectIndex,
  DependencyAnalysis,
  MemoryStore,
  AgentName,
  AgentResult,
} from "../types/index.js";

export type { AgentName, AgentResult };

export interface AgentContext {
  index: ProjectIndex;
  analysis: DependencyAnalysis;
  memory?: MemoryStore;
  files?: string[];
  root?: string;
}

export interface Agent {
  name: AgentName;
  analyze(ctx: AgentContext): AgentResult;
}
