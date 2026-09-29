import test from "node:test";
import assert from "node:assert/strict";
import { createRandom } from "../src/prng.js";
import { SIMULATIONS } from "../src/sim/index.js";
import { computeLoad, slotBands, MODEL } from "../src/sim/q1.js";
import { play as playQ2, JOBS } from "../src/sim/q2.js";
import { saveUploads, lookup, insertRecord, claim, STUDENTS } from "../src/sim/q3.js";
import { simultaneousJoin, selectionOrder, WAITING, play as playQ4 } from "../src/sim/q4.js";
import { checkFile, recordChange, FILES, play as playQ5 } from "../src/sim/q5.js";
import { buildStudents, rankAmong, statusOf, batchOf, beats, YOU } from "../src/sim/q6.js";
import { countedAttempt, isOnTime, canOpen, sortByDeadline } from "../src/sim/q7.js";

const set = (...ids) => new Set(ids);

test("random numbers repeat for the same seed", () => {
  const a = createRandom(5);
  const b = createRandom(5);
  assert.deepEqual([a.next(), a.next(), a.next()], [b.next(), b.next(), b.next()]);
  assert.notEqual(createRandom(5).next(), createRandom(6).next());
});

test("every simulation breaks with no fixes and works with all fixes", () => {
  for (const sim of SIMULATIONS) {
    assert.equal(sim.play(set()).ok, false, `${sim.id} should fail without fixes`);
    assert.equal(sim.play(new Set(sim.fixes.map((fix) => fix.id))).ok, true, `${sim.id} should pass with all fixes`);
  }
});

test("every simulation writes events and a summary", () => {
  for (const sim of SIMULATIONS) {
    const result = sim.play(set());
    assert.ok(result.events.length > 1);
    assert.ok(result.summary.length > 0);
  }
});

test("q1: load grows with students and every fix lowers it", () => {
  const small = computeLoad(set(), { students: 300 });
  const large = computeLoad(set(), { students: 1500 });
  assert.ok(large.load > small.load);
  const baseline = computeLoad(set()).load;
  for (const fix of ["rateLimit", "loadBalancer", "queue", "index", "stagger", "reminders"]) {
    assert.ok(computeLoad(set(fix)).load < baseline, fix);
  }
});

test("q1: load balancer scales capacity and keeps the site up", () => {
  assert.equal(computeLoad(set("loadBalancer")).running, 2);
  assert.equal(computeLoad(set(), { killed: 1 }).status, "Down");
  assert.notEqual(computeLoad(set("loadBalancer", "queue", "index", "rateLimit"), { killed: 1 }).status, "Down");
});

test("q1: rate limiting counts rejected requests", () => {
  assert.equal(computeLoad(set()).tryAgain, 0);
  assert.ok(computeLoad(set("rateLimit")).tryAgain > 0);
});

test("q1: staggered slots are equal in length", () => {
  const bands = slotBands(MODEL.students, MODEL.slots);
  assert.equal(bands.reduce((sum, band) => sum + band.students, 0), MODEL.students);
  const sizes = bands.map((band) => band.students);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
});

test("q2: without fixes reports get stuck, blocked and lost", () => {
  const { outcome } = playQ2(set());
  assert.deepEqual(outcome.stuck, ["sub-1042"]);
  assert.deepEqual(outcome.blocked, ["sub-1043", "sub-1045"]);
  assert.equal(outcome.lost.length, 3);
});

test("q2: auto-recovery needs the status field", () => {
  assert.ok(playQ2(set("recovery")).outcome.stuck.includes("sub-1042"));
  assert.ok(playQ2(set("recovery", "status", "uploadChecks")).outcome.marked.includes("sub-1042"));
});

test("q2: one job per student stops one stuck report blocking the rest", () => {
  const { outcome } = playQ2(set("perStudent"));
  assert.equal(outcome.blocked.length, 0);
});

test("q2: a corrupted file is rejected at upload only with upload checks", () => {
  assert.ok(playQ2(set("uploadChecks")).outcome.rejected.includes("sub-1043"));
  assert.equal(playQ2(set()).outcome.rejected.length, 0);
});

test("q2: a marked submission is never marked twice", () => {
  const all = new Set(["status", "logging", "recovery", "queueCheck", "uploadChecks", "queueSize", "results", "perStudent", "pending", "popup"]);
  const { outcome } = playQ2(all);
  assert.equal(new Set(outcome.marked).size, outcome.marked.length);
  assert.equal(outcome.marked.length + outcome.rejected.length, JOBS.length);
});

test("q2: logs are written only when logging is on", () => {
  assert.equal(playQ2(set()).events.filter((event) => event.kind === "log").length, 0);
  assert.ok(playQ2(set("logging")).events.filter((event) => event.kind === "log").length > 5);
});

test("q3: same file names collide, unique names do not", () => {
  assert.equal(saveUploads(false).size, 1);
  assert.equal(saveUploads(true).size, STUDENTS.length);
});

test("q3: lookup by assignment only returns the wrong record", () => {
  const rows = [
    { studentId: "S-101", assignmentId: "A7", attempt: 1 },
    { studentId: "S-102", assignmentId: "A7", attempt: 1 },
  ];
  assert.equal(lookup(rows, STUDENTS[1], false).studentId, "S-101");
  assert.equal(lookup(rows, STUDENTS[1], true).studentId, "S-102");
});

test("q3: the unique rule rejects a duplicate student, assignment and attempt", () => {
  const rows = [{ studentId: "S-101", assignmentId: "A7", attempt: 1 }];
  assert.equal(insertRecord(rows, { studentId: "S-101", assignmentId: "A7", attempt: 1 }, true).accepted, false);
  assert.equal(insertRecord(rows, { studentId: "S-101", assignmentId: "A7", attempt: 2 }, true).accepted, true);
  assert.equal(insertRecord(rows, { studentId: "S-101", assignmentId: "A7", attempt: 1 }, false).accepted, true);
});

test("q3: the one-step claim lets exactly one evaluator win", () => {
  assert.equal(claim({ status: "unmarked" }, ["a", "b"], true).length, 1);
  assert.equal(claim({ status: "unmarked" }, ["a", "b"], false).length, 2);
  assert.equal(claim({ status: "marked" }, ["a", "b"], true).length, 0);
});

test("q4: without the fix two clicks exceed capacity, with it exactly one wins", () => {
  assert.equal(simultaneousJoin({ seated: 19, capacity: 20, oneStep: false, clickers: ["a", "b"] }).seatedAfter, 21);
  const fixed = simultaneousJoin({ seated: 19, capacity: 20, oneStep: true, clickers: ["a", "b"] });
  assert.equal(fixed.admitted.length, 1);
  assert.deepEqual(fixed.rest, ["b"]);
});

test("q4: selection uses weakest marks and rotates last time's students", () => {
  assert.deepEqual(selectionOrder(WAITING, false).map((student) => student.name), ["Meera", "Ishaan", "Kabir"]);
  assert.deepEqual(selectionOrder(WAITING, true).map((student) => student.name), ["Ishaan", "Meera", "Kabir"]);
});

test("q4: guests are seated only without authentication", () => {
  assert.equal(playQ4(set()).outcome.guestSeated, true);
  assert.equal(playQ4(set("auth")).outcome.guestSeated, false);
});

test("q4: no-show release needs the fix", () => {
  assert.equal(playQ4(set()).outcome.wastedSeat, true);
  assert.equal(playQ4(set("noShow")).outcome.wastedSeat, false);
});

test("q5: preset files are accepted or rejected as expected", () => {
  const verdicts = FILES.map((file) => checkFile(file).ok);
  assert.deepEqual(verdicts, [true, false, false, false, false, true]);
  assert.match(checkFile(FILES[1]).reason, /empty/);
  assert.match(checkFile(FILES[2]).reason, /limit/);
  assert.match(checkFile(FILES[3]).reason, /PDF/);
  assert.match(checkFile(FILES[4]).reason, /corrupted/);
});

test("q5: duplicates are silent without the check and flagged with it", () => {
  assert.equal(playQ5(set()).outcome.duplicatesSilent, 1);
  assert.equal(playQ5(set("duplicate")).outcome.duplicatesSilent, 0);
});

test("q5: history rows record who, when, old and new value", () => {
  const rows = recordChange(recordChange([], { who: "teacher", when: "10:20", oldValue: "none", newValue: 8 }), { who: "teacher", when: "10:25", oldValue: 8, newValue: 9 });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], { who: "teacher", when: "10:25", oldValue: 8, newValue: 9 });
});

test("q6: rank counts only evaluated students", () => {
  const { students, order } = buildStudents();
  assert.equal(rankAmong(students, order, 100), null);
  const early = rankAmong(students, order, 640);
  const late = rankAmong(students, order, 1500);
  assert.equal(early.of, 640);
  assert.equal(late.of, 1500);
  assert.ok(early.rank >= 1 && early.rank <= early.of);
});

test("q6: ties are broken by finishing time", () => {
  const faster = { marks: 60, minutes: 10 };
  const slower = { marks: 60, minutes: 20 };
  assert.equal(beats(faster, slower), true);
  assert.equal(beats(slower, faster), false);
  assert.equal(beats({ marks: 61, minutes: 50 }, faster), true);
});

test("q6: status moves from submitted to under review to evaluated", () => {
  const { order } = buildStudents();
  assert.equal(statusOf(order, 0), "submitted");
  assert.equal(statusOf(order, 200), "under review");
  assert.equal(statusOf(order, 640), "evaluated");
});

test("q6: batch and global ranks are computed over different groups", () => {
  const { students, order } = buildStudents();
  const global = rankAmong(students, order, 1500);
  const batch = rankAmong(students, order, 1500, YOU, (index) => batchOf(index) === batchOf(YOU));
  assert.equal(batch.of, 30);
  assert.ok(batch.rank <= global.rank);
});

test("q6: the same seed gives the same students", () => {
  assert.deepEqual(buildStudents(3).students.slice(0, 5), buildStudents(3).students.slice(0, 5));
});

test("q7: the latest attempt before the deadline counts", () => {
  const attempts = [{ number: 1, minute: 0 }, { number: 2, minute: 30 }, { number: 3, minute: 50 }];
  assert.equal(countedAttempt(attempts, 40).number, 2);
  assert.equal(countedAttempt(attempts, -1), null);
});

test("q7: server time ignores the device clock and start time protects slow uploads", () => {
  const cheater = { startedMinute: 10, finishedMinute: 12, deadlineMinute: 0, deviceClockOffset: -30 };
  assert.equal(isOnTime({ ...cheater, serverTime: false, recordStart: false }), true);
  assert.equal(isOnTime({ ...cheater, serverTime: true, recordStart: false }), false);
  const slow = { startedMinute: -1, finishedMinute: 2, deadlineMinute: 0, deviceClockOffset: 0 };
  assert.equal(isOnTime({ ...slow, serverTime: true, recordStart: false }), false);
  assert.equal(isOnTime({ ...slow, serverTime: true, recordStart: true }), true);
});

test("q7: role checks stop a student opening another student's homework", () => {
  const student = { id: "S-101", role: "student" };
  assert.equal(canOpen({ requester: student, owner: "S-102", roleCheck: false }), true);
  assert.equal(canOpen({ requester: student, owner: "S-102", roleCheck: true }), false);
  assert.equal(canOpen({ requester: student, owner: "S-101", roleCheck: true }), true);
  assert.equal(canOpen({ requester: { id: "T-1", role: "teacher" }, owner: "S-102", roleCheck: true }), true);
});

test("q7: the grading queue is sorted by deadline", () => {
  const queue = [{ id: "a", deadline: 30 }, { id: "b", deadline: 5 }, { id: "c", deadline: 12 }];
  assert.deepEqual(sortByDeadline(queue).map((item) => item.id), ["b", "c", "a"]);
});
