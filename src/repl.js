import { PROBLEMS, OTHER, findProblem } from "./content.js";
import { answer } from "./answer.js";
import { renderOpening, renderMenu, renderProblem, renderItem, renderTopics, renderHelp } from "./render.js";
import { simulateCommand } from "./simulate.js";
import { runInterview } from "./interview.js";
import { parseFlags } from "./options.js";

const ALL = [...PROBLEMS, OTHER];
const SECTIONS = ["issues", "fixes", "confirm", "tradeoff", "all"];

function openSection(problem, number, io) {
  if (problem.items) {
    if (number === 6) io.write(renderProblem(problem));
    else if (number >= 1 && number <= problem.items.length) io.write(renderItem(problem.items[number - 1], number - 1));
    else return false;
    return true;
  }
  const section = SECTIONS[number - 1];
  if (!section) return false;
  io.write(renderProblem(problem, section));
  return true;
}

export async function runRepl(io) {
  io.write(renderOpening());
  let open = null;
  for (;;) {
    const line = await io.ask("> ");
    if (line === null) return;
    const text = line.trim();
    const lower = text.toLowerCase();
    if (!text) continue;
    if (["exit", "quit", "q"].includes(lower)) return;
    if (lower === "help") io.write(renderHelp());
    else if (lower === "topics") io.write(renderTopics());
    else if (lower === "interview") await runInterview(io);
    else if (lower === "back" && open) {
      open = null;
      io.write(renderOpening());
    } else if (lower.startsWith("explain ")) {
      const problem = findProblem(text.slice(8).trim());
      io.write(problem ? renderProblem(problem) : "No problem with that id. Use q1 to q7.");
    } else if (lower.startsWith("simulate")) {
      const { rest, options } = parseFlags(text.split(/\s+/).slice(1), io.interactive);
      await simulateCommand(rest, io, options);
    } else if (/^\d+$/.test(text)) {
      const number = Number(text);
      if (open && openSection(open, number, io)) continue;
      if (!open && ALL[number - 1]) {
        open = ALL[number - 1];
        io.write(renderMenu(open));
      } else {
        io.write("No such option. Type \"help\" for commands.");
      }
    } else {
      io.write(answer(text.replace(/^ask\s+/i, "")));
    }
  }
}
