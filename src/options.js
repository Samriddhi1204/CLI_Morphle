import { pickMode } from "./player.js";

export function parseFlags(tokens, interactive) {
  const rest = [];
  const flags = { auto: false, fast: false, try: false, fixes: null };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--auto") flags.auto = true;
    else if (token === "--fast") flags.fast = true;
    else if (token === "--try") flags.try = true;
    else if (token === "--fixes") {
      flags.fixes = splitList(tokens[index + 1]);
      index += 1;
    } else if (token.startsWith("--fixes=")) flags.fixes = splitList(token.slice(8));
    else rest.push(token);
  }
  return { rest, options: { try: flags.try, fixes: flags.fixes, mode: pickMode({ interactive, auto: flags.auto, fast: flags.fast }) } };
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
