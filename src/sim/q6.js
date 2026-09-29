import { createTrace } from "./trace.js";
import { createRandom } from "../prng.js";
import { bar } from "../format.js";
import { DEFAULTS } from "../params.js";

export const TOTAL = DEFAULTS.students;
export const BATCH_SIZE = DEFAULTS.batchSize;
export const YOU = 0;
export const YOU_POSITION = 450;
export const CHECKPOINTS = [0, 200, 450, 640, 1100, 1500];

const FIRST_NAMES = ["Aarav", "Meera", "Kabir", "Ishaan", "Anaya", "Vihaan", "Diya", "Rohan", "Saanvi", "Arjun", "Nisha", "Riya"];
const LAST_NAMES = ["Sharma", "Iyer", "Khan", "Patel", "Nair", "Singh", "Das", "Mehta", "Rao", "Bose"];

export function checkpointsFor(total) {
  return CHECKPOINTS.map((checkpoint) => Math.round((checkpoint * total) / TOTAL));
}

export function buildStudents(seed = DEFAULTS.seed, total = TOTAL) {
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
  const position = Math.floor((YOU_POSITION * total) / TOTAL);
  const others = random.shuffle(students.filter((student) => student.index !== YOU).map((student) => student.index));
  const order = [...others.slice(0, position), YOU, ...others.slice(position)];
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

function boardRows(has, evaluated) {
  if (evaluated === 0) return "Board: no grades confirmed yet.";
  if (!has("showAll")) return "Board: only the top 10 are visible, so most students cannot find themselves.";
  return `Board: all ${evaluated} evaluated students are listed, your row is highlighted.`;
}

function boardLine(has, context, evaluated) {
  const { students, order, total, batchSize } = context;
  const name = (student) => (has("nickname") ? student.nickname : student.name);
  const lines = [];
  const global = rankAmong(students, order, evaluated);
  if (!has("provisional") && evaluated < total) {
    lines.push("Board: \"Results pending\" until every submission is graded.");
  } else {
    lines.push(boardRows(has, evaluated));
  }
  if (has("progress")) lines.push(`Progress: Evaluated: ${evaluated} of ${total.toLocaleString("en-US")}`);
  if (has("ownStatus")) {
    lines.push(`Your submission: ${statusOf(order, evaluated)}`);
  } else if ((!global || !has("provisional")) && evaluated < total) {
    lines.push("Your row: nothing is shown.");
  }
  const finished = evaluated === total;
  if ((has("provisional") || finished) && global) {
    const note = finished ? "final" : "provisional, it can change as more work is graded";
    lines.push(`Your rank: ${global.rank} of ${global.of} evaluated (${note})`);
    if (has("twoBoards")) {
      const batch = rankAmong(students, order, evaluated, YOU, (index) => batchOf(index, batchSize) === batchOf(YOU, batchSize));
      lines.push(`Batch board: ${batch.rank} of ${batch.of} evaluated in your batch. Global board: ${global.rank} of ${global.of}.`);
    }
  }
  lines.push(`Shown as: ${name(students[YOU])}`);
  return lines;
}

export function play(active, params = {}) {
  const p = { ...DEFAULTS, ...params };
  const trace = createTrace();
  const has = (id) => active.has(id);
  const { students, order } = buildStudents(p.seed, p.students);
  const context = { students, order, total: p.students, batchSize: p.batchSize };
  let previous = null;

  trace.head(`${p.students.toLocaleString("en-US")} students, the teacher confirms grades over time (synthetic data)`);
  for (const evaluated of checkpointsFor(p.students)) {
    trace.visual(`Graded so far ${bar(evaluated, p.students, 30)} ${evaluated} of ${p.students}`);
    boardLine(has, context, evaluated).forEach((line) => trace.visual(`  ${line}`));
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
  const loadSeconds = has("paging") ? (p.batchSize * 2) / 1000 : (p.students * 2) / 1000;
  if (has("paging")) {
    trace.good(`Pages of ${p.batchSize} rows load in about ${loadSeconds.toFixed(2)} s (illustrative), with a "Jump to my rank" button.`);
  } else {
    trace.bad(`All ${p.students} rows load together, about ${loadSeconds.toFixed(1)} s (illustrative).`);
  }
  if (has("twoBoards")) {
    const tie = findTie(students, order, Math.round((640 * p.students) / TOTAL));
    if (tie) {
      const [faster, slower] = [...tie].sort((a, b) => a.minutes - b.minutes);
      trace.good(`Tie example: ${faster.marks} marks each. ${faster.minutes} min finishes ahead of ${slower.minutes} min, so finishing time breaks the tie.`);
    }
  }
  trace.info(has("nickname") ? `Names are shown as nicknames, for example ${students[1].nickname}.` : `Real names of children are public, for example ${students[1].name}.`);

  const missing = ["showAll", "progress", "provisional", "ownStatus", "realtime", "twoBoards", "paging", "nickname"].filter((id) => !has(id));
  const summary = [
    `rows shown: ${has("showAll") ? "all" : "top 10 only"}`,
    `progress line: ${has("progress") ? "shown" : "missing"}`,
    `rank before grading ends: ${has("provisional") ? "provisional" : "hidden"}`,
    `own status: ${has("ownStatus") ? "shown" : "blank"}`,
    `updates: ${has("realtime") ? "live" : "on refresh"}`,
    `boards: ${has("twoBoards") ? "batch and global" : "one"}`,
    `board load: ${has("paging") ? "fast pages" : `${loadSeconds.toFixed(1)} s`}`,
    `names: ${has("nickname") ? "nicknames" : "real names"}`,
  ].join("; ");
  return { events: trace.events, summary, ok: missing.length === 0, outcome: { missing } };
}
