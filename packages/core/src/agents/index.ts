import type { AgentContext, Agent } from "./types.js";
import type { AgentName, AgentResult } from "../types/index.js";
import { architectAgent } from "./architect.js";
import { reviewerAgent } from "./reviewer.js";
import { securityAgent } from "./security.js";
import { testerAgent } from "./tester.js";

export type { AgentContext, Agent } from "./types.js";

const agents: Record<AgentName, Agent> = {
  architect: architectAgent,
  reviewer: reviewerAgent,
  security: securityAgent,
  tester: testerAgent,
};

export function getAgent(name: AgentName): Agent | undefined {
  return agents[name];
}

export function listAgents(): AgentName[] {
  return Object.keys(agents) as AgentName[];
}

export function runAgent(name: AgentName, ctx: AgentContext): AgentResult {
  const agent = agents[name];
  if (!agent) {
    return {
      agent: name,
      summary: `Unknown agent: ${name}`,
      findings: [],
      score: 0,
    };
  }
  return agent.analyze(ctx);
}

export function runAllAgents(ctx: AgentContext): AgentResult[] {
  return Object.values(agents).map((agent) => agent.analyze(ctx));
}

export { architectAgent } from "./architect.js";
export { reviewerAgent } from "./reviewer.js";
export { securityAgent } from "./security.js";
export { testerAgent } from "./tester.js";
