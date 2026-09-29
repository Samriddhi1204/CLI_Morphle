import { createTrace } from "./trace.js";
import { clock } from "../format.js";
import { DEFAULTS } from "../params.js";

export const LIMITS = {
  evaluateMinutes: 2,
  startMinute: 1,
};

export const JOBS = [
  { id: "sub-1041", student: "S-101", kind: "ok" },
  { id: "sub-1042", student: "S-102", kind: "crash" },
  { id: "sub-1043", student: "S-103", kind: "corrupt" },
  { id: "sub-1044", student: "S-104", kind: "queuefail" },
  { id: "sub-1045", student: "S-105", kind: "ok" },
  { id: "sub-1046", student: "S-106", kind: "ok" },
  { id: "sub-1047", student: "S-107", kind: "ok" },
];

export function play(active, params = {}) {
  const p = { ...DEFAULTS, ...params };
  const trace = createTrace();
  const has = (id) => active.has(id);
  const outcome = { marked: [], stuck: [], blocked: [], lost: [], failed: [], rejected: [], asked: [], wrongGrade: false };
  const lastStep = {};

  const step = (minute, id, text) => {
    lastStep[id] = text;
    if (has("logging")) trace.log(`[${clock(minute)}] ${id} ${text}`);
  };

  trace.head(`${JOBS.length} students submit at ${clock(0)}`);
  if (!has("logging")) trace.warn("Nothing is logged, so only what students see is shown below.");

  const queue = [];
  const capacity = has("queueSize") ? p.queueLimit * 2 : p.queueLimit;
  for (const job of JOBS) {
    step(0, job.id, "received");
    if (job.kind === "corrupt" && has("uploadChecks")) {
      outcome.rejected.push(job.id);
      step(0, job.id, "rejected at upload");
      trace.good(`${job.id} rejected at upload: corrupted PDF, the student is asked to upload again.`);
      continue;
    }
    step(0, job.id, "saved");
    if (job.kind === "queuefail") {
      if (has("queueCheck")) {
        trace.good(`${job.id} could not be queued: the student sees an error and retries.`);
        queue.push({ ...job, kind: "ok" });
        step(0, job.id, "queued (retry)");
      } else {
        outcome.lost.push(job.id);
        trace.bad(`${job.id} could not be queued, but the student still sees "Submitted".`);
      }
      continue;
    }
    if (queue.length >= capacity) {
      if (has("queueCheck")) {
        outcome.asked.push(job.id);
        trace.warn(`${job.id}: the queue is full, so the student is asked to try again.`);
      } else {
        outcome.lost.push(job.id);
        trace.bad(`${job.id} was dropped silently because the queue was full.`);
      }
      continue;
    }
    queue.push(job);
    step(0, job.id, "queued");
  }
  trace.pause();

  trace.head("Background processing");
  const timeline = [];
  const emit = (minute, kind, text) => timeline.push({ minute, kind, text });
  const record = (minute, id, text) => {
    lastStep[id] = text;
    if (has("logging")) emit(minute, "log", `[${clock(minute)}] ${id} ${text}`);
  };
  const workers = p.workers + (has("queueSize") ? 1 : 0);
  const free = Array(workers).fill(LIMITS.startMinute);
  const pending = queue.map((job) => ({ ...job, readyAt: 0 }));
  const isolated = has("perStudent");
  let blockedBy = null;

  while (pending.length > 0) {
    const job = pending.shift();
    if (blockedBy) {
      outcome.blocked.push(job.id);
      continue;
    }
    const worker = free.indexOf(Math.min(...free));
    const start = Math.max(free[worker], job.readyAt);
    record(start, job.id, has("status") ? "picked up (unmarked -> evaluating)" : "picked up");

    if (job.kind === "ok") {
      const end = start + LIMITS.evaluateMinutes;
      free[worker] = end;
      record(end, job.id, "marked");
      outcome.marked.push(job.id);
      if (has("results")) record(end, job.id, "moved to the results table");
      continue;
    }

    if (job.kind === "crash") {
      emit(start, "bad", `[${clock(start)}] The server restarts while ${job.id} is being evaluated.`);
      if (has("recovery") && has("status")) {
        const back = start + p.recoveryMinutes;
        record(back, job.id, `still evaluating after ${p.recoveryMinutes} minutes, back to unmarked`);
        emit(back, "good", `[${clock(back)}] ${job.id} is picked up again instead of staying stuck.`);
        pending.push({ ...job, kind: "ok", readyAt: back });
        free[worker] = isolated ? start + 1 : back;
      } else {
        if (has("recovery")) emit(start, "warn", `Auto-recovery needs a status to reset, so ${job.id} cannot be recovered.`);
        outcome.stuck.push(job.id);
        free[worker] = start + 1;
        if (!isolated) blockedBy = job.id;
        const listed = start + p.recoveryMinutes;
        if (has("pending")) {
          emit(listed, "warn", `[${clock(listed)}] ${job.id} appears on the teacher's "Pending too long" list.`);
        } else {
          emit(listed, "bad", `[${clock(listed)}] ${job.id} is still evaluating and nobody is told.`);
        }
      }
      continue;
    }

    emit(start, "bad", `[${clock(start)}] ${job.id} crashes the process: corrupted PDF.`);
    free[worker] = start + 1;
    if (isolated) {
      outcome.failed.push(job.id);
      emit(start, "warn", `Only ${job.id} fails, the other jobs continue.`);
      if (has("pending")) emit(start, "warn", `${job.id} appears on the teacher's "Pending too long" list.`);
    } else {
      outcome.stuck.push(job.id);
      blockedBy = job.id;
    }
  }

  timeline.sort((a, b) => a.minute - b.minute);
  timeline.forEach((entry) => trace[entry.kind](entry.text));
  if (outcome.blocked.length > 0) {
    trace.bad(`${outcome.blocked.join(", ")} wait behind ${blockedBy} and are never picked up.`);
  }
  if (outcome.marked.length > 0 && !has("results")) {
    trace.warn("Finished work stays in the queue table, so the queue keeps growing.");
  }
  if (has("queueSize")) {
    trace.good(`Queue limit raised to ${capacity} and ${workers} background processors are running.`);
  }
  trace.pause();

  trace.head("Teacher enters grades");
  if (outcome.marked.includes("sub-1041")) {
    trace.info("The teacher types 80 for sub-1041 (meant 8, the maximum is 10).");
    if (has("popup")) {
      trace.good("Popup: \"Are you sure? sub-1041 score 80 of 10\". The teacher corrects it to 8.");
    } else {
      outcome.wrongGrade = true;
      trace.bad("Score 80 is saved without a question.");
    }
  }
  trace.pause();

  trace.head("Finding the cause");
  const suspects = [...outcome.stuck, ...outcome.lost];
  if (suspects.length === 0) trace.good("Nothing is stuck or lost.");
  for (const id of suspects) {
    if (!has("logging")) {
      trace.bad(`No log lines, so nobody can tell where ${id} stopped.`);
    } else if (lastStep[id] === "saved") {
      trace.info(`Last log line for ${id}: saved. Saved but never queued means a queueing problem.`);
    } else {
      trace.info(`Last log line for ${id}: ${lastStep[id]}. Started evaluating and stopped means a crash or error.`);
    }
  }

  const ok = outcome.marked.length + outcome.rejected.length === JOBS.length && !outcome.wrongGrade;
  const summary = `marked ${outcome.marked.length} of ${JOBS.length}, stuck ${outcome.stuck.length}, blocked ${outcome.blocked.length}, lost ${outcome.lost.length}, failed ${outcome.failed.length}${outcome.asked.length > 0 ? `, asked to retry ${outcome.asked.length}` : ""}`;
  return { events: trace.events, summary, ok, outcome };
}
