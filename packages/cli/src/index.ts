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

const program = new Command();

program
  .name("cortex")
  .description("Developer intelligence for your codebase")
  .version("0.5.0");

initCommand(program);
analyzeCommand(program);
statusCommand(program);
searchCommand(program);
contextCommand(program);
rememberCommand(program);
memoryCommand(program);
planCommand(program);
reviewCommand(program);

program.parse();
