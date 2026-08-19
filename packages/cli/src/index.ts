import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { analyzeCommand } from "./commands/analyze.js";
import { statusCommand } from "./commands/status.js";
import { searchCommand } from "./commands/search.js";
import { contextCommand } from "./commands/context.js";

const program = new Command();

program
  .name("cortex")
  .description("Developer intelligence for your codebase")
  .version("0.2.0");

initCommand(program);
analyzeCommand(program);
statusCommand(program);
searchCommand(program);
contextCommand(program);

program.parse();
