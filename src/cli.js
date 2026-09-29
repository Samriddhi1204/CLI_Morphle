import { createIO } from "./io.js";
import { answer } from "./answer.js";
import { findProblem } from "./content.js";
import { renderHelp, renderProblem, renderTopics } from "./render.js";
import { runRepl } from "./repl.js";
import { runInterview } from "./interview.js";
import { simulateCommand } from "./simulate.js";
import { parseFlags } from "./options.js";

const COMMANDS = new Set(["ask", "topics", "explain", "simulate", "interview", "help"]);

export async function main(argv) {
  const io = createIO();
  try {
    const [command, ...rest] = argv;
    if (!command) {
      await runRepl(io);
      return 0;
    }
    if (command === "--help" || command === "-h" || command === "help") {
      io.write(renderHelp());
      return 0;
    }
    if (command === "topics") {
      io.write(renderTopics());
      return 0;
    }
    if (command === "explain") {
      const problem = findProblem(rest[0] || "");
      io.write(problem ? renderProblem(problem) : "Usage: sdcli explain <q1-q7>");
      return problem ? 0 : 1;
    }
    if (command === "interview") {
      await runInterview(io);
      return 0;
    }
    if (command === "simulate") {
      const { rest: ids, options } = parseFlags(rest, io.interactive);
      return await simulateCommand(ids, io, options);
    }
    const question = COMMANDS.has(command) ? rest.join(" ") : argv.join(" ");
    io.write(answer(question));
    return 0;
  } finally {
    io.close();
  }
}
