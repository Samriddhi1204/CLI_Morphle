import { createTrace } from "./trace.js";
import { bar, percent } from "../format.js";
import { DEFAULTS } from "../params.js";

export const MODEL = {
  students: DEFAULTS.students,
  requestsPerStudent: 6,
  bunchWindowSeconds: 600,
  reminderSpread: 0.4,
  scriptClients: DEFAULTS.scriptClients,
  scriptRequestsPerMinute: 240,
  rateLimitPerMinute: DEFAULTS.rateLimit,
  heavyCost: 1,
  queueCost: 0.25,
  noIndexFactor: 1.6,
  serverCapacity: 40,
  slots: 5,
  baseLatencyMs: 200,
  minuteWeights: [1, 1, 1, 2, 2, 3, 4, 6, 9, 14],
};

export function statusFor(load, running) {
  if (running <= 0 || load > 1.5) return "Down";
  if (load > 1) return "Slow";
  if (load > 0.7) return "Busy";
  return "OK";
}

export function computeLoad(active, options = {}) {
  const students = options.students ?? DEFAULTS.students;
  const killed = options.killed ?? 0;
  const servers = options.servers ?? DEFAULTS.servers;
  const scriptClients = options.scriptClients ?? DEFAULTS.scriptClients;
  const rateLimit = options.rateLimit ?? DEFAULTS.rateLimit;
  const slots = active.has("stagger") ? MODEL.slots : 1;
  const bunched = active.has("reminders") ? 1 - MODEL.reminderSpread : 1;
  const studentRps = (students * MODEL.requestsPerStudent * bunched) / slots / MODEL.bunchWindowSeconds;
  const rawScriptRps = (scriptClients * MODEL.scriptRequestsPerMinute) / 60;
  const allowedScriptRps = active.has("rateLimit")
    ? (scriptClients * Math.min(MODEL.scriptRequestsPerMinute, rateLimit)) / 60
    : rawScriptRps;
  const tryAgain = Math.round((rawScriptRps - allowedScriptRps) * MODEL.bunchWindowSeconds);
  const requestsPerSecond = studentRps + allowedScriptRps;
  const cost = (active.has("queue") ? MODEL.queueCost : MODEL.heavyCost) * (active.has("index") ? 1 : MODEL.noIndexFactor);
  const running = Math.max(0, (active.has("loadBalancer") ? servers : 1) - killed);
  const load = running === 0 ? Infinity : (requestsPerSecond * cost) / (MODEL.serverCapacity * running);
  const status = statusFor(load, running);
  const latencyMs = status === "Down" ? null : Math.min(9000, Math.round(MODEL.baseLatencyMs / Math.max(0.05, 1 - Math.min(load, 0.95))));
  return { load, status, requestsPerSecond, latencyMs, tryAgain, running, slots };
}

export function slotBands(students, slots) {
  const base = Math.floor(students / slots);
  const extra = students % slots;
  return Array.from({ length: slots }, (_, index) => ({
    slot: index + 1,
    students: base + (index < extra ? 1 : 0),
  }));
}

function loadLine(result) {
  const load = Number.isFinite(result.load) ? percent(result.load) : "no server";
  const latency = result.latencyMs === null ? "timeouts" : `${result.latencyMs} ms`;
  return `Server load ${bar(Math.min(result.load, 1.5), 1.5, 30)} ${load}   status: ${result.status}   average request: ${latency}`;
}

function arrivalChart(trace, active, students) {
  if (active.has("stagger")) {
    const bands = slotBands(students, MODEL.slots);
    const largest = Math.max(...bands.map((band) => band.students));
    trace.visual("Deadline slots, each with the same amount of time:");
    bands.forEach((band) => trace.visual(`  Slot ${band.slot}  ${bar(band.students, largest, 24)} ${band.students} students`));
    return;
  }
  const total = MODEL.minuteWeights.reduce((sum, weight) => sum + weight, 0);
  const bunched = active.has("reminders") ? 1 - MODEL.reminderSpread : 1;
  const counts = MODEL.minuteWeights.map((weight) => Math.round((students * bunched * weight) / total));
  const peak = Math.max(...counts, 1);
  trace.visual("Submissions per minute in the last 10 minutes before the deadline:");
  counts.forEach((count, index) => {
    trace.visual(`  minute ${String(index + 1).padStart(2)}  ${bar(count, peak, 24)} ${count}`);
  });
  if (active.has("reminders")) {
    trace.visual(`  earlier, thanks to reminders: ${Math.round(students * MODEL.reminderSpread)} students`);
  }
}

export function play(active, params = {}) {
  const p = { ...DEFAULTS, ...params };
  const trace = createTrace();
  trace.head(`${p.students} students submit before the deadline (numbers are illustrative)`);
  arrivalChart(trace, active, p.students);
  trace.pause();
  const result = computeLoad(active, p);
  trace.visual(loadLine(result));
  if (active.has("rateLimit")) {
    trace.good(`Rate limiting: ${p.scriptClients} script clients were capped at ${p.rateLimit} requests a minute. ${result.tryAgain} requests got "try again in a moment" and added no load.`);
  } else {
    trace.bad(`${p.scriptClients} script clients send ${MODEL.scriptRequestsPerMinute} requests a minute each and nothing stops them.`);
  }
  if (active.has("queue")) {
    trace.good("Background queue: the request only saves the file and replies \"received\", so each request is light.");
  } else {
    trace.bad("Each request saves and processes the PDF before replying, so requests take long and pile up.");
  }
  if (!active.has("index")) trace.bad("Queries search submissions with no index, so every request costs more.");
  if (active.has("loadBalancer")) trace.good(`Load balancer: ${p.servers} copies of the server share the requests.`);
  if (active.has("reminders")) trace.good("Reminders moved part of the submissions earlier, so fewer arrive in the last minutes.");
  trace.pause();
  const killed = computeLoad(active, { ...p, killed: 1 });
  trace.head("One server is killed");
  trace.visual(loadLine(killed));
  if (killed.status === "Down") {
    trace.bad("No other copy exists, so the site is down for everyone.");
  } else {
    trace.good(`The site stays up on ${killed.running} server${killed.running === 1 ? "" : "s"}.`);
  }
  const ok = result.status === "OK" && killed.status !== "Down";
  const summary = `load ${Number.isFinite(result.load) ? percent(result.load) : "n/a"}, ${result.status}; after killing a server: ${killed.status}; ${result.tryAgain} "try again" replies`;
  return { events: trace.events, summary, ok };
}
