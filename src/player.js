import { style, sleep } from "./format.js";

const MARKERS = {
  bad: (text) => style.red(`  x ${text}`),
  good: (text) => style.green(`  + ${text}`),
  warn: (text) => style.yellow(`  ! ${text}`),
  info: (text) => `    ${text}`,
  visual: (text) => style.blue(`    ${text}`),
  log: (text) => style.dim(`    ${text}`),
};

export async function playEvents(events, io, mode) {
  let currentMode = mode;
  for (const event of events) {
    if (event.kind === "head") {
      io.write("");
      io.write(style.bold(style.cyan(`  ${event.text}`)));
    } else if (event.kind === "pause") {
      if (currentMode === "step") {
        const answer = await io.ask(style.dim("    [Enter to continue] "));
        if (answer === null) currentMode = "instant";
      } else if (currentMode === "auto") {
        await sleep(900);
      }
    } else {
      io.write(MARKERS[event.kind](event.text));
      if (currentMode === "auto") await sleep(140);
    }
  }
}

export function pickMode({ interactive, auto, fast }) {
  if (fast || !interactive) return "instant";
  return auto ? "auto" : "step";
}
