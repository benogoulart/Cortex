import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { analyzeCommand } from "./commands/analyze.js";
import { statusCommand } from "./commands/status.js";
import { searchCommand } from "./commands/search.js";
import { contextCommand } from "./commands/context.js";
import { rememberCommand } from "./commands/remember.js";
import { memoryCommand } from "./commands/memory.js";
import { planCommand } from "./commands/plan.js";
import { reviewCommand } from "./commands/review.js";
import { agentCommand } from "./commands/agent.js";
import { reportCommand } from "./commands/report.js";
import { historyCommand } from "./commands/history.js";

const program = new Command();

program
  .name("cortex")
  .description("Developer intelligence for your codebase")
  .version("1.0.0");

initCommand(program);
analyzeCommand(program);
statusCommand(program);
searchCommand(program);
contextCommand(program);
rememberCommand(program);
memoryCommand(program);
planCommand(program);
reviewCommand(program);
agentCommand(program);
reportCommand(program);
historyCommand(program);

program.parse();
