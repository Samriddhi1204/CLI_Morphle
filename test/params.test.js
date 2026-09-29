import test from "node:test";
import assert from "node:assert/strict";
import { PARAMS, DEFAULTS, resolveParams, paramsFor, parseValue, findParam } from "../src/params.js";
import { parseFlags } from "../src/options.js";
import { simulateCommand } from "../src/simulate.js";
import { SIMULATIONS } from "../src/sim/index.js";
import { computeLoad } from "../src/sim/q1.js";
import { play as playQ2 } from "../src/sim/q2.js";
import { play as playQ4 } from "../src/sim/q4.js";
import { play as playQ6, buildStudents, checkpointsFor } from "../src/sim/q6.js";

const set = (...ids) => new Set(ids);

function fakeIO() {
  const lines = [];
  return { lines, write: (text = "") => lines.push(text), ask: async () => null, close: () => {}, interactive: false, text: () => lines.join("\n") };
}

const base = { mode: "instant", try: false, fixes: null, unknown: [], params: {} };

test("every parameter has a default inside its own range", () => {
  for (const spec of PARAMS) {
    assert.ok(spec.default >= spec.min && spec.default <= spec.max, spec.flag);
    assert.ok(spec.sims.length > 0);
  }
  assert.equal(DEFAULTS.students, 1500);
  assert.equal(DEFAULTS.capacity, 20);
});

test("defaults are used when nothing is passed", () => {
  assert.deepEqual(resolveParams("q1").values, { students: 1500, servers: 2, rateLimit: 60, scriptClients: 10 });
  assert.deepEqual(resolveParams("q7-3").values, {});
});

test("overrides replace defaults and are validated", () => {
  assert.equal(resolveParams("q1", { students: "800" }).values.students, 800);
  assert.match(resolveParams("q1", { students: "abc" }).error, /whole number from 10 to 10000/);
  assert.match(resolveParams("q1", { students: "5" }).error, /whole number/);
  assert.match(resolveParams("q1", { students: "1.5" }).error, /whole number/);
  assert.match(resolveParams("q2", { students: "100" }).error, /does not apply to q2\. It applies to: q1, q6/);
  assert.match(resolveParams("q7-2", { capacity: "9" }).error, /does not apply to q7/);
});

test("parameters are grouped by simulation", () => {
  assert.deepEqual(paramsFor("q2").map((spec) => spec.flag), ["queue-limit", "workers", "recovery-minutes"]);
  assert.deepEqual(paramsFor("q4").map((spec) => spec.flag), ["capacity"]);
  assert.equal(paramsFor("q7-1").length, 0);
  assert.equal(parseValue(findParam("seed"), "0").value, 0);
});

test("flags are parsed in both spaced and equals form", () => {
  const spaced = parseFlags(["q1", "--students", "800", "--rate-limit=30", "--fast"], false);
  assert.deepEqual(spaced.rest, ["q1"]);
  assert.deepEqual(spaced.options.params, { students: "800", rateLimit: "30" });
  assert.equal(spaced.options.mode, "instant");
  const unknown = parseFlags(["q1", "--nope", "3"], false);
  assert.deepEqual(unknown.options.unknown, ["--nope"]);
});

test("q1: more students or fewer servers raise the load", () => {
  const fixes = set("loadBalancer");
  assert.ok(computeLoad(fixes, { students: 3000 }).load > computeLoad(fixes, { students: 1500 }).load);
  assert.ok(computeLoad(fixes, { servers: 4 }).load < computeLoad(fixes, { servers: 2 }).load);
  assert.equal(computeLoad(fixes, { servers: 4 }).running, 4);
});

test("q1: a lower rate limit rejects more requests", () => {
  const strict = computeLoad(set("rateLimit"), { rateLimit: 20 }).tryAgain;
  const loose = computeLoad(set("rateLimit"), { rateLimit: 100 }).tryAgain;
  assert.ok(strict > loose);
  assert.equal(computeLoad(set("rateLimit"), { scriptClients: 0 }).tryAgain, 0);
});

test("q2: queue limit, workers and recovery time change the outcome", () => {
  assert.ok(playQ2(set(), { queueLimit: 10 }).outcome.lost.length < playQ2(set(), { queueLimit: 2 }).outcome.lost.length);
  const all = new Set(["status", "logging", "recovery", "uploadChecks", "queueCheck", "queueSize", "perStudent"]);
  const slow = playQ2(all, { recoveryMinutes: 30 });
  const quick = playQ2(all, { recoveryMinutes: 5 });
  assert.ok(slow.events.some((event) => (event.text || "").includes("after 30 minutes")));
  assert.ok(quick.events.some((event) => (event.text || "").includes("after 5 minutes")));
  assert.equal(playQ2(all, { workers: 3 }).outcome.marked.length, 6);
});

test("q2: a tiny queue with every fix asks students to retry instead of losing work", () => {
  const all = new Set(["status", "logging", "recovery", "queueCheck", "uploadChecks", "queueSize", "results", "perStudent", "pending", "popup"]);
  const result = playQ2(all, { queueLimit: 1 });
  assert.equal(result.outcome.lost.length, 0);
  assert.ok(result.outcome.asked.length > 0);
  assert.match(result.summary, /asked to retry/);
});

test("q4: capacity changes the seat counts", () => {
  const text = playQ4(set(), { capacity: 8 }).events.map((event) => event.text).join("\n");
  assert.match(text, /9 \/ 8/);
  assert.match(text, /16 \/ 8/);
  const fixed = playQ4(new Set(["auth", "oneStep", "capacity", "waitlist", "marks", "balancer", "listenOnly", "noShow"]), { capacity: 8 });
  assert.equal(fixed.ok, true);
  assert.match(fixed.events.map((event) => event.text).join("\n"), /capacity setting to 18/);
});

test("q6: students, batch size and seed change the board", () => {
  assert.equal(buildStudents(7, 300).students.length, 300);
  assert.notDeepEqual(buildStudents(1, 100).students.slice(0, 3), buildStudents(2, 100).students.slice(0, 3));
  assert.deepEqual(checkpointsFor(1500), [0, 200, 450, 640, 1100, 1500]);
  const small = checkpointsFor(300);
  assert.equal(small[0], 0);
  assert.equal(small[small.length - 1], 300);
  const all = new Set(["showAll", "progress", "provisional", "ownStatus", "realtime", "twoBoards", "paging", "nickname"]);
  const result = playQ6(all, { students: 300, batchSize: 10, seed: 3 });
  assert.equal(result.ok, true);
  assert.match(result.events.map((event) => event.text).join("\n"), /Pages of 10 rows/);
});

test("passing no parameters gives the same result as the defaults", () => {
  for (const sim of SIMULATIONS) {
    const everything = new Set(sim.fixes.map((fix) => fix.id));
    const defaults = resolveParams(sim.id).values;
    assert.deepEqual(sim.play(everything).events, sim.play(everything, defaults).events, sim.id);
    assert.deepEqual(sim.play(new Set()).events, sim.play(new Set(), defaults).events, sim.id);
  }
});

test("simulate shows the parameters and accepts overrides", async () => {
  const io = fakeIO();
  const code = await simulateCommand(["q1"], io, { ...base, params: { students: "3000", servers: "3" } });
  assert.equal(code, 0);
  assert.match(io.text(), /--students 3000 \(default 1500\)/);
  assert.match(io.text(), /--servers 3 \(default 2\)/);
  assert.match(io.text(), /3000 students submit/);
});

test("simulate refuses bad parameters and unknown options", async () => {
  const bad = fakeIO();
  assert.equal(await simulateCommand(["q1"], bad, { ...base, params: { students: "abc" } }), 1);
  assert.match(bad.text(), /whole number/);
  const wrong = fakeIO();
  assert.equal(await simulateCommand(["q4"], wrong, { ...base, params: { students: "100" } }), 1);
  assert.match(wrong.text(), /applies to: q1, q6/);
  const unknown = fakeIO();
  assert.equal(await simulateCommand(["q1"], unknown, { ...base, unknown: ["--bogus"] }), 1);
  assert.match(unknown.text(), /Unknown option: --bogus/);
});

test("the simulate listing documents every parameter", async () => {
  const io = fakeIO();
  await simulateCommand([], io, base);
  for (const spec of PARAMS) assert.match(io.text(), new RegExp(`--${spec.flag}`));
});
