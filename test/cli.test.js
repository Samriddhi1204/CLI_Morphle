import test from "node:test";
import assert from "node:assert/strict";
import { answer, matches } from "../src/answer.js";
import { buildEntries } from "../src/entries.js";
import { NO_MATCH, renderProblem } from "../src/render.js";
import { PROBLEMS, OTHER, findProblem } from "../src/content.js";
import { simulateCommand } from "../src/simulate.js";
import { tokenize, stem } from "../src/matcher.js";

function fakeIO() {
  const lines = [];
  return { lines, write: (text = "") => lines.push(text), ask: async () => null, close: () => {}, interactive: false, text: () => lines.join("\n") };
}

const instant = { mode: "instant", try: false, fixes: null };

test("the stemmer treats related forms the same", () => {
  assert.equal(stem("queueing"), stem("queued"));
  assert.equal(stem("evaluating"), stem("evaluated"));
  assert.equal(stem("swapped"), stem("swapping"));
  assert.deepEqual(tokenize("1,500 students"), ["1500", "student"]);
});

test("a question outside the content gets the exact no-match message", () => {
  assert.equal(answer("how do we handle refunds?"), NO_MATCH);
  assert.equal(answer("what database should we use for payments?"), NO_MATCH);
  assert.equal(answer("hello"), NO_MATCH);
  assert.equal(answer(""), NO_MATCH);
  assert.match(NO_MATCH, /^No match found for your question\./);
});

test("a broad question returns the whole problem", () => {
  const text = answer("why do reports get stuck?");
  assert.match(text, /POSSIBLE ISSUES/);
  assert.match(text, /FIXES/);
  assert.match(text, /TRADE-OFF/);
});

test("a narrow question returns only that piece", () => {
  const text = answer("what is auto-recovery");
  assert.match(text, /Fix: Auto-recovery/);
  assert.doesNotMatch(text, /POSSIBLE ISSUES/);
  assert.match(answer("what if the server restarts while evaluating?"), /Issue: Server restarted mid-job/);
});

test("two joined topics return both pieces", () => {
  const found = matches("rate limiting and staggered deadlines").map((entry) => entry.id);
  assert.deepEqual(found, ["q1-fix-1", "q1-fix-5"]);
});

test("trade-off and confirm questions return that problem's text", () => {
  assert.match(answer("trade-off of staggered deadlines"), /Slots must feel\s+fair/);
  assert.match(answer("how do I confirm the cause of swapped homework"), /reproduce it with two\s+test students/);
});

test("asking for fixes returns only the fixes", () => {
  const text = answer("fixes for swapped homework");
  assert.match(text, /FIXES/);
  assert.doesNotMatch(text, /POSSIBLE ISSUES/);
});

test("every issue and fix can be answered on its own", () => {
  const parts = buildEntries().filter((entry) => entry.kind === "issue" || entry.kind === "fix");
  assert.ok(parts.length > 100);
  for (const entry of parts) {
    const found = matches(entry.title);
    assert.ok(found.length > 0, `no answer for "${entry.title}"`);
    assert.ok(found.some((match) => match.kind !== "problem"), `only a whole problem for "${entry.title}"`);
  }
});

test("every problem has entries for its issues, fixes, and trade-off", () => {
  const entries = buildEntries();
  for (const problem of PROBLEMS) {
    assert.equal(entries.filter((entry) => entry.problemId === problem.id && entry.kind === "issue").length, problem.issues.length);
    assert.equal(entries.filter((entry) => entry.problemId === problem.id && entry.kind === "fix").length, problem.fixes.length);
    assert.equal(entries.filter((entry) => entry.problemId === problem.id && entry.kind === "tradeoff").length, 1);
  }
  assert.equal(entries.filter((entry) => entry.kind === "item").length, OTHER.items.length);
});

test("explain renders issues, fixes, confirm and trade-off", () => {
  const text = renderProblem(findProblem("q2"));
  assert.match(text, /POSSIBLE ISSUES/);
  assert.match(text, /HOW I'D CONFIRM/);
  assert.match(renderProblem(findProblem("q7")), /Q7\.5/);
});

test("simulate prints the problem, the fixes and the reference text", async () => {
  const io = fakeIO();
  const code = await simulateCommand(["q2"], io, instant);
  assert.equal(code, 0);
  assert.match(io.text(), /WITHOUT ANY FIX/);
  assert.match(io.text(), /ONE FIX AT A TIME/);
  assert.match(io.text(), /WITH ALL FIXES/);
  assert.match(io.text(), /POSSIBLE ISSUES/);
});

test("simulate with chosen fixes and with an unknown fix", async () => {
  const good = fakeIO();
  assert.equal(await simulateCommand(["q4"], good, { ...instant, fixes: ["auth", "oneStep"] }), 0);
  assert.match(good.text(), /WITH: auth, oneStep/);
  const bad = fakeIO();
  assert.equal(await simulateCommand(["q4"], bad, { ...instant, fixes: ["nope"] }), 1);
  assert.match(bad.text(), /Unknown fix: nope/);
});

test("simulate q7 runs all five other problems and unknown ids are refused", async () => {
  const io = fakeIO();
  await simulateCommand(["q7"], io, instant);
  for (const number of [1, 2, 3, 4, 5]) assert.match(io.text(), new RegExp(`SIMULATION Q7\\.${number}`));
  const missing = fakeIO();
  assert.equal(await simulateCommand(["q9"], missing, instant), 1);
});

test("simulate with no id lists every simulation and the assumptions", async () => {
  const io = fakeIO();
  await simulateCommand([], io, instant);
  assert.match(io.text(), /q6/);
  assert.match(io.text(), /q7-5/);
  assert.match(io.text(), /ASSUMPTIONS/);
});
