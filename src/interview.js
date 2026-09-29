import { PROBLEMS, OTHER } from "./content.js";
import { renderProblem } from "./render.js";
import { style } from "./format.js";

const QUESTIONS = [
  ...PROBLEMS.map((problem) => ({ text: `${problem.title}. What could go wrong, and how do you fix it?`, problem })),
  { text: "What other problems could this system have, and how would you fix them?", problem: OTHER },
];

export async function runInterview(io) {
  for (const [index, question] of QUESTIONS.entries()) {
    io.write("");
    io.write(style.bold(`  Question ${index + 1} of ${QUESTIONS.length}`));
    io.write(`  "${question.text}"`);
    const reveal = await io.ask("  (Enter to see the answer, q to quit) ");
    if (reveal === null || reveal.trim().toLowerCase() === "q") return;
    io.write("");
    io.write(renderProblem(question.problem));
    const next = await io.ask("\n  (Enter for the next question, q to quit) ");
    if (next === null || next.trim().toLowerCase() === "q") return;
  }
  io.write("");
  io.write("  That was the last question.");
}
