import { playEvents } from "./player.js";
import { style, wrapText } from "./format.js";
import { findSimulations, SIMULATIONS } from "./sim/index.js";
import { ASSUMPTIONS } from "./content.js";

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
  issueLines(sim).forEach((line) => io.write(wrapText(line.trim(), 90, "    ")));
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

function printHeader(sim, io) {
  const label = sim.item ? sim.id.toUpperCase().replace("-", ".") : sim.id.toUpperCase();
  io.write("");
  io.write(style.bold(`SIMULATION ${label}: ${sim.title}`));
  io.write(`  ${sim.oneLine}`);
  io.write(style.dim("  Numbers are illustrative and every student is made up. Nothing here touches a real server."));
}

async function runOnce(sim, active, io, mode, heading) {
  const result = sim.play(active);
  io.write("");
  io.write(style.bold(style.cyan(`--- ${heading} ---`)));
  await playEvents(result.events, io, mode);
  io.write("");
  io.write(result.ok ? style.green(`  Result: ${result.summary}`) : style.red(`  Result: ${result.summary}`));
  return result;
}

export async function runGuided(sim, io, mode) {
  printHeader(sim, io);
  const baseline = await runOnce(sim, EMPTY(), io, mode, "WITHOUT ANY FIX");
  io.write("");
  io.write(style.bold(style.cyan("--- ONE FIX AT A TIME ---")));
  for (const fix of sim.fixes) {
    const alone = sim.play(new Set([fix.id]));
    const changed = alone.summary !== baseline.summary;
    const note = changed ? alone.summary : "no visible change on its own, it works together with the other fixes";
    io.write(`  ${fix.label}: ${note}`);
  }
  await runOnce(sim, allFixes(sim), io, mode, "WITH ALL FIXES");
  printReference(sim, io);
}

export async function runCustom(sim, ids, io, mode) {
  const valid = new Set(sim.fixes.map((fix) => fix.id));
  const unknown = ids.filter((id) => !valid.has(id));
  if (unknown.length > 0) {
    io.write(`Unknown fix: ${unknown.join(", ")}`);
    io.write(`Available: ${sim.fixes.map((fix) => fix.id).join(", ")}`);
    return false;
  }
  printHeader(sim, io);
  await runOnce(sim, new Set(ids), io, mode, `WITH: ${ids.length > 0 ? ids.join(", ") : "no fixes"}`);
  return true;
}

export async function runTry(sim, io, mode) {
  printHeader(sim, io);
  const active = new Set();
  for (;;) {
    io.write("");
    io.write(style.bold("  Switch fixes on or off"));
    sim.fixes.forEach((fix, index) => io.write(`    ${String(index + 1).padStart(2)}. [${active.has(fix.id) ? "x" : " "}] ${fix.label}`));
    io.write("  Type a number to toggle, a for all, n for none, r or Enter to run, q to quit.");
    const answer = await io.ask("  > ");
    if (answer === null) return;
    const text = answer.trim().toLowerCase();
    if (text === "q" || text === "quit" || text === "exit") return;
    if (text === "a") sim.fixes.forEach((fix) => active.add(fix.id));
    else if (text === "n") active.clear();
    else if (text === "" || text === "r") await runOnce(sim, active, io, mode, "YOUR MIX");
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
  io.write("");
  io.write(style.bold("  ASSUMPTIONS"));
  ASSUMPTIONS.forEach((line) => io.write(`    - ${line}`));
}

export async function simulateCommand(args, io, options) {
  const [id] = args;
  if (!id) {
    listSimulations(io);
    return 0;
  }
  const sims = findSimulations(id);
  if (sims.length === 0) {
    io.write(`No simulation called "${id}". Type "sdcli simulate" to see the list.`);
    return 1;
  }
  for (const [position, sim] of sims.entries()) {
    if (options.fixes) {
      const ok = await runCustom(sim, options.fixes, io, options.mode);
      if (!ok) return 1;
    } else if (options.try) {
      await runTry(sim, io, options.mode);
    } else {
      await runGuided(sim, io, options.mode);
      if (io.interactive && options.mode !== "instant" && sims.length === 1) {
        const answer = await io.ask("\n  Try your own mix of fixes? (y/N) ");
        if (answer && answer.trim().toLowerCase().startsWith("y")) await runTry(sim, io, options.mode);
      }
    }
    if (position < sims.length - 1 && options.mode === "step") {
      const answer = await io.ask("\n  [Enter for the next problem] ");
      if (answer === null) break;
    }
  }
  return 0;
}
