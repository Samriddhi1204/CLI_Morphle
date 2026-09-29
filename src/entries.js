import { PROBLEMS, OTHER } from "./content.js";

const letter = (index) => String.fromCharCode(97 + index);

function problemEntries(problem) {
  const children = [...problem.issues, ...problem.fixes];
  const childText = children.map((child) => child[child.length === 3 ? 1 : 2]).join(" ");
  const childAliases = children.map((child) => `${child[0] === child[0].toLowerCase() && child.length === 4 ? child[1] : child[0]} ${child[child.length - 1]}`).join(" ");
  const entries = [
    { id: problem.id, problemId: problem.id, kind: "problem", label: problem.label, title: problem.title, text: `${problem.menuTitle} ${childText} ${childAliases} ${problem.confirm} ${problem.tradeoff}`, aliases: `${problem.aliases} ${problem.menuTitle}` },
  ];
  problem.issues.forEach(([title, text, aliases], index) => {
    entries.push({ id: `${problem.id}-issue-${letter(index)}`, problemId: problem.id, kind: "issue", label: `${problem.label} issue ${letter(index)}`, title, text, aliases });
  });
  problem.fixes.forEach(([fixId, title, text, aliases], index) => {
    entries.push({ id: `${problem.id}-fix-${index + 1}`, fixId, problemId: problem.id, kind: "fix", label: `${problem.label} fix ${index + 1}`, title, text, aliases });
  });
  if (problem.confirm) {
    entries.push({ id: `${problem.id}-confirm`, problemId: problem.id, kind: "confirm", label: problem.label, title: "How I'd confirm the cause", text: problem.confirm, aliases: "confirm cause diagnose find root cause check" });
  }
  entries.push({ id: `${problem.id}-tradeoff`, problemId: problem.id, kind: "tradeoff", label: problem.label, title: "Trade-off", text: problem.tradeoff, aliases: "trade off tradeoff downside" });
  return entries;
}

function otherEntries() {
  const everyChild = OTHER.items.flatMap((item) => [...item.wrong, ...item.fixes]);
  const entries = [
    { id: OTHER.id, problemId: OTHER.id, kind: "problem", label: OTHER.label, title: OTHER.title, text: `${OTHER.menuTitle} ${everyChild.map((child) => `${child[child.length === 3 ? 1 : 2]} ${child[child.length - 1]}`).join(" ")}`, aliases: `${OTHER.aliases} ${OTHER.items.map((item) => `${item.title} ${item.aliases}`).join(" ")}` },
  ];
  OTHER.items.forEach((item, position) => {
    const label = `Q7.${position + 1}`;
    entries.push({ id: item.id, problemId: OTHER.id, kind: "item", label, title: item.title, text: item.title, aliases: item.aliases });
    item.wrong.forEach(([title, text, aliases], index) => {
      entries.push({ id: `${item.id}-issue-${letter(index)}`, problemId: OTHER.id, itemId: item.id, kind: "issue", label: `${label} issue ${letter(index)}`, title, text, aliases });
    });
    item.fixes.forEach(([fixId, title, text, aliases], index) => {
      entries.push({ id: `${item.id}-fix-${index + 1}`, fixId, problemId: OTHER.id, itemId: item.id, kind: "fix", label: `${label} fix ${index + 1}`, title, text, aliases });
    });
  });
  return entries;
}

export function buildEntries() {
  return [...PROBLEMS.flatMap(problemEntries), ...otherEntries()];
}
