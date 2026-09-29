export const PARAMS = [
  { flag: "students", key: "students", sims: ["q1", "q6"], default: 1500, min: 10, max: 10000, help: "students in the simulation" },
  { flag: "servers", key: "servers", sims: ["q1"], default: 2, min: 2, max: 10, help: "server copies behind the load balancer" },
  { flag: "rate-limit", key: "rateLimit", sims: ["q1"], default: 60, min: 1, max: 1000, help: "requests per student per minute" },
  { flag: "script-clients", key: "scriptClients", sims: ["q1"], default: 10, min: 0, max: 100, help: "script clients that spam the server" },
  { flag: "queue-limit", key: "queueLimit", sims: ["q2"], default: 4, min: 1, max: 50, help: "jobs the queue can hold" },
  { flag: "workers", key: "workers", sims: ["q2"], default: 1, min: 1, max: 10, help: "background processors" },
  { flag: "recovery-minutes", key: "recoveryMinutes", sims: ["q2"], default: 10, min: 1, max: 60, help: "minutes in evaluating before a job is reset" },
  { flag: "capacity", key: "capacity", sims: ["q4"], default: 20, min: 3, max: 200, help: "live help seats" },
  { flag: "batch-size", key: "batchSize", sims: ["q6"], default: 30, min: 5, max: 500, help: "students per batch" },
  { flag: "seed", key: "seed", sims: ["q6"], default: 7, min: 0, max: 999999, help: "random seed for the made-up students" },
];

export const DEFAULTS = Object.fromEntries(PARAMS.map((spec) => [spec.key, spec.default]));

export function baseId(simId) {
  return String(simId).split("-")[0];
}

export function paramsFor(simId) {
  return PARAMS.filter((spec) => spec.sims.includes(baseId(simId)));
}

export function findParam(flag) {
  return PARAMS.find((spec) => spec.flag === flag);
}

export function parseValue(spec, raw) {
  const text = String(raw ?? "").trim();
  const value = /^\d+$/.test(text) ? Number(text) : NaN;
  if (Number.isNaN(value) || value < spec.min || value > spec.max) {
    return { error: `--${spec.flag} must be a whole number from ${spec.min} to ${spec.max}.` };
  }
  return { value };
}

export function resolveParams(simId, overrides = {}) {
  const applicable = paramsFor(simId);
  const values = Object.fromEntries(applicable.map((spec) => [spec.key, spec.default]));
  for (const [key, raw] of Object.entries(overrides)) {
    const spec = PARAMS.find((candidate) => candidate.key === key);
    if (!applicable.includes(spec)) {
      return { error: `--${spec.flag} does not apply to ${baseId(simId)}. It applies to: ${spec.sims.join(", ")}.` };
    }
    const parsed = parseValue(spec, raw);
    if (parsed.error) return { error: parsed.error };
    values[key] = parsed.value;
  }
  return { values };
}
