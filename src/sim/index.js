import { fixList, findProblem, OTHER } from "../content.js";
import { play as playQ1 } from "./q1.js";
import { play as playQ2 } from "./q2.js";
import { play as playQ3 } from "./q3.js";
import { play as playQ4 } from "./q4.js";
import { play as playQ5 } from "./q5.js";
import { play as playQ6 } from "./q6.js";
import { playDouble, playDeadline, playNoShow, playPrivacy, playOverload } from "./q7.js";

const main = [
  ["q1", playQ1],
  ["q2", playQ2],
  ["q3", playQ3],
  ["q4", playQ4],
  ["q5", playQ5],
  ["q6", playQ6],
];

const others = [playDouble, playDeadline, playNoShow, playPrivacy, playOverload];

function build(id) {
  const problem = findProblem(id);
  const found = main.find(([key]) => key === id);
  return { id, title: problem.title, oneLine: problem.oneLine, problem, fixes: fixList(id), play: found[1] };
}

function buildOther(item, index) {
  return {
    id: item.id,
    title: item.title,
    oneLine: `Q7.${index + 1} of the other problems.`,
    problem: OTHER,
    item,
    fixes: item.fixes.map(([fixId, title]) => ({ id: fixId, label: title })),
    play: others[index],
  };
}

export const SIMULATIONS = [...main.map(([id]) => build(id)), ...OTHER.items.map(buildOther)];

export function findSimulations(id) {
  const key = String(id).toLowerCase();
  if (key === "q7") return SIMULATIONS.filter((sim) => sim.id.startsWith("q7-"));
  const exact = SIMULATIONS.find((sim) => sim.id === key);
  return exact ? [exact] : [];
}
