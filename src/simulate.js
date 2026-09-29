import { playEvents } from "./player.js";
import { style, wrapText } from "./format.js";
import { findSimulations, SIMULATIONS } from "./sim/index.js";
import { ASSUMPTIONS } from "./content.js";
import { PARAMS, paramsFor, findParam, parseValue, resolveParams } from "./params.js";

const EMPTY = () => new Set();

function allFixes(sim) {
  return new Set(sim.fixes.map((fix) => fix.id));
}

function issueLines(sim) {
  const source = sim.item ? sim.item.wrong : sim.problem.issues;
  return source.map(([, text], index) => `    ${String.fromCharCode(97 + index)}) ${text}`);
}

function printReference(sim, io) {
  io.write("");
  io.write(style.bold(style.cyan("  POSSIBLE ISSUES")));
  issueLines(sim).forEach((line) => io.write(wrapText(line.trim(), 90, "    ", "   ")));
  if (sim.problem.confirm) {
    io.write("");
    io.write(style.bold(style.cyan("  HOW I'D CONFIRM THE CAUSE")));
    io.write(wrapText(sim.problem.confirm, 90, "    "));
  }
  if (sim.problem.tradeoff) {
    io.write("");
    io.write(style.bold(style.cyan("  TRADE-OFF")));
    io.write(wrapText(sim.problem.tradeoff, 90, "    "));
  }
}

function parameterLine(sim, params) {
  const specs = paramsFor(sim.id);
  if (specs.length === 0) return null;
  const parts = specs.map((spec) => {
    const value = params[spec.key];
    return `--${spec.flag} ${value}${value === spec.default ? "" : ` (default ${spec.default})`}`;
  });
  return `  Parameters: ${parts.join(", ")}`;
}

function printHeader(sim, io, params) {
  const label = sim.item ? sim.id.toUpperCase().replace("-", ".") : sim.id.toUpperCase();
  io.write("");
  io.write(style.bold(`SIMULATION ${label}: ${sim.title}`));
  io.write(`  ${sim.oneLine}`);
  io.write(style.dim("  Numbers are illustrative and every student is made up. Nothing here touches a real server."));
  const line = parameterLine(sim, params);
  if (line) io.write(style.dim(line));
}

async function runOnce(sim, active, io, mode, heading, params) {
  const result = sim.play(active, params);
  io.write("");
  io.write(style.bold(style.cyan(`--- ${heading} ---`)));
  await playEvents(result.events, io, mode);
  io.write("");
  io.write(result.ok ? style.green(`  Result: ${result.summary}`) : style.red(`  Result: ${result.summary}`));
  return result;
}

function describeEffect(alone, baseline, baselineLines) {
  const baseParts = baseline.summary.split("; ");
  const changedParts = alone.summary.split("; ").filter((part) => !baseParts.includes(part));
  if (changedParts.length > 0) return changedParts.join("; ");
  const added = alone.events.find((event) => event.text && event.kind !== "head" && !baselineLines.has(event.text));
  if (!added) return "no visible change on its own, it works together with the other fixes";
  const text = added.text.length > 88 ? `${added.text.slice(0, 85)}...` : added.text;
  return `numbers unchanged, but now: ${text}`;
}

export async function runGuided(sim, io, mode, params) {
  printHeader(sim, io, params);
  const baseline = await runOnce(sim, EMPTY(), io, mode, "WITHOUT ANY FIX", params);
  io.write("");
  io.write(style.bold(style.cyan("--- ONE FIX AT A TIME ---")));
  const baselineLines = new Set(baseline.events.map((event) => event.text));
  for (const fix of sim.fixes) {
    const alone = sim.play(new Set([fix.id]), params);
    io.write(`  ${fix.label}: ${describeEffect(alone, baseline, baselineLines)}`);
  }
  await runOnce(sim, allFixes(sim), io, mode, "WITH ALL FIXES", params);
  printReference(sim, io);
}

export async function runCustom(sim, ids, io, mode, params) {
  const valid = new Set(sim.fixes.map((fix) => fix.id));
  const unknown = ids.filter((id) => !valid.has(id));
  if (unknown.length > 0) {
    io.write(`Unknown fix: ${unknown.join(", ")}`);
    io.write(`Available: ${sim.fixes.map((fix) => fix.id).join(", ")}`);
    return false;
  }
  printHeader(sim, io, params);
  await runOnce(sim, new Set(ids), io, mode, `WITH: ${ids.length > 0 ? ids.join(", ") : "no fixes"}`, params);
  return true;
}

function setParameter(sim, params, words, io) {
  const spec = findParam(words[1] || "");
  if (!spec || !paramsFor(sim.id).includes(spec)) {
    io.write(`  ${sim.id} does not have a parameter called "${words[1] || ""}".`);
    return;
  }
  const parsed = parseValue(spec, words[2]);
  if (parsed.error) io.write(`  ${parsed.error}`);
  else params[spec.key] = parsed.value;
}

export async function runTry(sim, io, mode, startParams) {
  const params = { ...startParams };
  printHeader(sim, io, params);
  const active = new Set();
  const canSet = paramsFor(sim.id).length > 0;
  for (;;) {
    io.write("");
    io.write(style.bold("  Switch fixes on or off"));
    sim.fixes.forEach((fix, index) => io.write(`    ${String(index + 1).padStart(2)}. [${active.has(fix.id) ? "x" : " "}] ${fix.label}`));
    io.write("  Type a number to toggle, a for all, n for none, r or Enter to run, q to quit.");
    if (canSet) io.write(`  Change a parameter with: set <name> <value>, for example set ${paramsFor(sim.id)[0].flag} ${paramsFor(sim.id)[0].default}`);
    const answer = await io.ask("  > ");
    if (answer === null) return;
    const text = answer.trim().toLowerCase();
    if (text === "q" || text === "quit" || text === "exit") return;
    if (text === "a") sim.fixes.forEach((fix) => active.add(fix.id));
    else if (text === "n") active.clear();
    else if (text.startsWith("set ")) {
      setParameter(sim, params, text.split(/\s+/), io);
      const line = parameterLine(sim, params);
      if (line) io.write(line);
    } else if (text === "" || text === "r") await runOnce(sim, active, io, mode, "YOUR MIX", params);
    else {
      const fix = sim.fixes[Number(text) - 1];
      if (fix) {
        if (active.has(fix.id)) active.delete(fix.id);
        else active.add(fix.id);
      }
    }
  }
}

export function listSimulations(io) {
  io.write("");
  io.write(style.bold("  SIMULATIONS"));
  SIMULATIONS.forEach((sim) => io.write(`    ${sim.id.padEnd(5)} ${sim.title}`));
  io.write("");
  io.write("  Run one with: sdcli simulate q2       (q7 runs all five other problems)");
  io.write("  Try your own mix of fixes: sdcli simulate q2 --try");
  io.write("  Pick fixes directly: sdcli simulate q2 --fixes status,logging");
  io.write("  Change the scenario: sdcli simulate q1 --students 3000 --servers 3");
  io.write("");
  io.write(style.bold("  PARAMETERS (each has a default, so you only pass what you want to change)"));
  PARAMS.forEach((spec) => {
    io.write(`    --${spec.flag.padEnd(17)} ${spec.sims.join(", ").padEnd(7)} default ${String(spec.default).padEnd(6)} range ${spec.min}-${spec.max}   ${spec.help}`);
  });
  io.write("");
  io.write(style.bold("  ASSUMPTIONS"));
  ASSUMPTIONS.forEach((line) => io.write(`    - ${line}`));
}

export async function simulateCommand(args, io, options) {
  const [id] = args;
  if (options.unknown && options.unknown.length > 0) {
    io.write(`Unknown option: ${options.unknown.join(", ")}. Type "sdcli simulate" to see the options.`);
    return 1;
  }
  if (!id) {
    listSimulations(io);
    return 0;
  }
  const sims = findSimulations(id);
  if (sims.length === 0) {
    io.write(`No simulation called "${id}". Type "sdcli simulate" to see the list.`);
    return 1;
  }
  const values = new Map();
  for (const sim of sims) {
    const resolved = resolveParams(sim.id, options.params || {});
    if (resolved.error) {
      io.write(resolved.error);
      return 1;
    }
    values.set(sim.id, resolved.values);
  }
  for (const [position, sim] of sims.entries()) {
    const params = values.get(sim.id);
    if (options.fixes) {
      const ok = await runCustom(sim, options.fixes, io, options.mode, params);
      if (!ok) return 1;
    } else if (options.try) {
      await runTry(sim, io, options.mode, params);
    } else {
      await runGuided(sim, io, options.mode, params);
      if (io.interactive && options.mode !== "instant" && sims.length === 1) {
        const answer = await io.ask("\n  Try your own mix of fixes? (y/N) ");
        if (answer && answer.trim().toLowerCase().startsWith("y")) await runTry(sim, io, options.mode, params);
      }
    }
    if (position < sims.length - 1 && options.mode === "step") {
      const answer = await io.ask("\n  [Enter for the next problem] ");
      if (answer === null) break;
    }
  }
  return 0;
}
