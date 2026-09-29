import { buildEntries } from "./entries.js";
import { createMatcher } from "./matcher.js";
import { renderAnswers, renderEntry, NO_MATCH } from "./render.js";

const entries = buildEntries();
const matcher = createMatcher(entries);

const INTENTS = [
  { kind: "tradeoff", pattern: /\btrade[- ]?offs?\b|\bdownsides?\b/gi },
  { kind: "confirm", pattern: /\bconfirm\w*|\bdiagnos\w*|\broot causes?\b/gi },
];

function byIntent(question) {
  for (const intent of INTENTS) {
    if (!intent.pattern.test(question)) continue;
    intent.pattern.lastIndex = 0;
    const topic = matcher.search(question.replace(intent.pattern, " "));
    if (topic.length === 0) return null;
    const target = entries.find((entry) => entry.problemId === topic[0].problemId && entry.kind === intent.kind);
    if (target) return [target];
  }
  return null;
}

export function matches(question) {
  return byIntent(question) || matcher.search(question);
}

export function answer(question) {
  const found = matches(question);
  if (found.length === 0) return NO_MATCH;
  return found.length === 1 && found[0].kind !== "problem" ? renderEntry(found[0]) : renderAnswers(found, question);
}
