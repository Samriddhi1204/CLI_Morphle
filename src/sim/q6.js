import { createTrace } from "./trace.js";
import { createRandom } from "../prng.js";
import { bar } from "../format.js";

export const TOTAL = 1500;
export const BATCH_SIZE = 30;
export const YOU = 0;
export const YOU_POSITION = 450;
export const CHECKPOINTS = [0, 200, 450, 640, 1100, 1500];

const FIRST_NAMES = ["Aarav", "Meera", "Kabir", "Ishaan", "Anaya", "Vihaan", "Diya", "Rohan", "Saanvi", "Arjun", "Nisha", "Riya"];
const LAST_NAMES = ["Sharma", "Iyer", "Khan", "Patel", "Nair", "Singh", "Das", "Mehta", "Rao", "Bose"];

export function buildStudents(seed = 7, total = TOTAL) {
  const random = createRandom(seed);
  const students = Array.from({ length: total }, (_, index) => {
    const first = FIRST_NAMES[random.int(0, FIRST_NAMES.length - 1)];
    const last = LAST_NAMES[random.int(0, LAST_NAMES.length - 1)];
    return {
      index,
      name: index === YOU ? "Aarav Sharma" : `${first} ${last}`,
      nickname: `Star-${String(1000 + random.int(0, 8999))}`,
      marks: index === YOU ? 78 : random.int(20, 100),
      minutes: index === YOU ? 22 : random.int(10, 60),
    };
  });
  const others = random.shuffle(students.filter((student) => student.index !== YOU).map((student) => student.index));
  const order = [...others.slice(0, YOU_POSITION), YOU, ...others.slice(YOU_POSITION)];
  return { students, order };
}

export function beats(a, b) {
  return a.marks > b.marks || (a.marks === b.marks && a.minutes < b.minutes);
}

export function rankAmong(students, order, evaluated, who = YOU, scope = null) {
  const evaluatedIds = order.slice(0, evaluated).filter((index) => (scope ? scope(index) : true));
  if (!evaluatedIds.includes(who)) return null;
  const me = students[who];
  const ahead = evaluatedIds.filter((index) => index !== who && beats(students[index], me)).length;
  return { rank: ahead + 1, of: evaluatedIds.length };
}

export function statusOf(order, evaluated, who = YOU) {
  if (order.indexOf(who) < evaluated) return "evaluated";
  return evaluated > 0 ? "under review" : "submitted";
}

export function batchOf(index, size = BATCH_SIZE) {
  return Math.floor(index / size);
}

export function findTie(students, order, evaluated) {
  const seen = new Map();
  for (const index of order.slice(0, evaluated)) {
    const key = students[index].marks;
    if (seen.has(key)) {
      const first = students[seen.get(key)];
      const second = students[index];
      if (first.minutes !== second.minutes) return [first, second];
    } else {
      seen.set(key, index);
    }
  }
  return null;
}

function boardLine(has, students, order, evaluated) {
  const name = (student) => (has("nickname") ? student.nickname : student.name);
  const me = students[YOU];
  const lines = [];
  const global = rankAmong(students, order, evaluated);
  if (!has("provisional") && evaluated < TOTAL) {
    lines.push("Board: \"Results pending\" until every submission is graded.");
  } else {
    lines.push(has("showAll") ? `Board: all ${evaluated} evaluated students are listed, your row is highlighted.` : "Board: only the top 10 are visible, so most students cannot find themselves.");
  }
  if (has("progress")) lines.push(`Progress: Evaluated: ${evaluated} of ${TOTAL.toLocaleString("en-US")}`);
  if (has("ownStatus")) {
    lines.push(`Your submission: ${statusOf(order, evaluated)}`);
  } else if (!global && evaluated < TOTAL) {
    lines.push("Your row: nothing is shown.");
  }
  const finished = evaluated === TOTAL;
  if ((has("provisional") || finished) && global) {
    const note = finished ? "final" : "provisional, it can change as more work is graded";
    lines.push(`Your rank: ${global.rank} of ${global.of} evaluated (${note})`);
    if (has("twoBoards")) {
      const batch = rankAmong(students, order, evaluated, YOU, (index) => batchOf(index) === batchOf(YOU));
      lines.push(`Batch board: ${batch.rank} of ${batch.of} evaluated in your batch. Global board: ${global.rank} of ${global.of}.`);
    }
  }
  lines.push(`Shown as: ${name(me)}`);
  return lines;
}

export function play(active) {
  const trace = createTrace();
  const has = (id) => active.has(id);
  const { students, order } = buildStudents();
  let previous = null;

  trace.head(`${TOTAL.toLocaleString("en-US")} students, the teacher confirms grades over time (synthetic data)`);
  for (const evaluated of CHECKPOINTS) {
    trace.visual(`Graded so far ${bar(evaluated, TOTAL, 30)} ${evaluated} of ${TOTAL}`);
    boardLine(has, students, order, evaluated).forEach((line) => trace.visual(`  ${line}`));
    const now = rankAmong(students, order, evaluated);
    if (has("provisional") && now && previous) {
      const change = previous.rank - now.rank;
      const arrow = change > 0 ? `up ${change}` : change < 0 ? `down ${-change}` : "unchanged";
      trace.visual(`  Rank change since last update: ${arrow}`);
    }
    if (now) previous = now;
    if (has("realtime") && evaluated > 0) trace.good("  live: the board updated the moment the grade was confirmed (WebSockets)");
    if (!has("realtime") && evaluated > 0) trace.warn("  the board shows old data until the page is refreshed");
    trace.pause();
  }

  trace.head("Board loading and ties");
  const loadSeconds = has("paging") ? (BATCH_SIZE * 2) / 1000 : (TOTAL * 2) / 1000;
  if (has("paging")) {
    trace.good(`Pages of ${BATCH_SIZE} rows load in about ${loadSeconds.toFixed(2)} s (illustrative), with a "Jump to my rank" button.`);
  } else {
    trace.bad(`All ${TOTAL} rows load together, about ${loadSeconds.toFixed(1)} s (illustrative).`);
  }
  if (has("twoBoards")) {
    const tie = findTie(students, order, 640);
    if (tie) {
      trace.good(`Tie example: ${tie[0].marks} marks each. ${tie[0].minutes} min finishes ahead of ${tie[1].minutes} min, so finishing time breaks the tie.`);
    }
  }
  trace.info(has("nickname") ? "Names are shown as nicknames, for example " + students[1].nickname + "." : `Real names of children are public, for example ${students[1].name}.`);

  const missing = ["showAll", "progress", "provisional", "ownStatus", "realtime", "twoBoards", "paging", "nickname"].filter((id) => !has(id));
  const summary = missing.length === 0 ? "students see a live provisional rank, their status and a fast board" : `${missing.length} of 8 board features missing`;
  return { events: trace.events, summary, ok: missing.length === 0, outcome: { missing } };
}
