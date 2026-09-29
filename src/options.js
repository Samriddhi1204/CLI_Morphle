import { pickMode } from "./player.js";
import { findParam } from "./params.js";

export function parseFlags(tokens, interactive) {
  const rest = [];
  const unknown = [];
  const params = {};
  const flags = { auto: false, fast: false, try: false, fixes: null };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const [name, inline] = token.startsWith("--") ? splitOnce(token.slice(2)) : [null, null];
    if (name === null) {
      rest.push(token);
    } else if (name === "auto") flags.auto = true;
    else if (name === "fast") flags.fast = true;
    else if (name === "try") flags.try = true;
    else if (name === "fixes") {
      const value = inline ?? tokens[index + 1];
      if (inline === null) index += 1;
      flags.fixes = splitList(value);
    } else if (findParam(name)) {
      const value = inline ?? tokens[index + 1];
      if (inline === null) index += 1;
      params[findParam(name).key] = value;
    } else {
      unknown.push(token);
    }
  }
  const mode = pickMode({ interactive, auto: flags.auto, fast: flags.fast });
  return { rest, options: { try: flags.try, fixes: flags.fixes, params, unknown, mode } };
}

function splitOnce(text) {
  const at = text.indexOf("=");
  return at === -1 ? [text, null] : [text.slice(0, at), text.slice(at + 1)];
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
