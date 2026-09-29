import { PROBLEMS, OTHER, findProblem, ASSUMPTIONS } from "./content.js";
import { style, wrapText } from "./format.js";

export const NO_MATCH = [
  "No match found for your question.",
  "This tool answers questions about the homework platform's problems, their possible issues,",
  "and their fixes.",
  "Type \"topics\" to see what is covered, or rephrase your question.",
].join("\n");

const letter = (index) => String.fromCharCode(97 + index);
const heading = (text) => style.bold(style.cyan(`  ${text}`));
const paragraph = (text) => wrapText(text, 92, "    ");
const listLine = (marker, text, indent = "    ") => wrapText(`${marker} ${text}`, 92, indent, " ".repeat(marker.length + 1));

function issuesBlock(problem) {
  const lines = [heading("POSSIBLE ISSUES")];
  problem.issues.forEach(([, text], index) => lines.push(listLine(`${letter(index)})`, text)));
  return lines.join("\n");
}

function fixesBlock(problem) {
  const lines = [heading("FIXES")];
  problem.fixes.forEach(([, , text], index) => lines.push(listLine(`${index + 1})`, text)));
  return lines.join("\n");
}

function confirmBlock(problem) {
  return problem.confirm ? `${heading("HOW I'D CONFIRM")}\n${paragraph(problem.confirm)}` : "";
}

function tradeoffBlock(problem) {
  return `${heading("TRADE-OFF")}\n${paragraph(problem.tradeoff)}`;
}

function itemBlock(item, position) {
  const lines = [style.bold(`  Q7.${position + 1} ${item.title}`), "    What could go wrong:"];
  item.wrong.forEach(([, text], index) => lines.push(listLine(`${letter(index)})`, text, "      ")));
  lines.push("    Fix:");
  item.fixes.forEach(([, , text], index) => lines.push(listLine(`${index + 1})`, text, "      ")));
  return lines.join("\n");
}

export function renderProblem(problem, section = "all") {
  const title = style.bold(`${problem.label}. ${problem.title}`);
  if (problem.items) {
    return [title, "", ...problem.items.map((item, position) => itemBlock(item, position))].join("\n");
  }
  const parts = { issues: issuesBlock(problem), fixes: fixesBlock(problem), confirm: confirmBlock(problem), tradeoff: tradeoffBlock(problem) };
  const chosen = section === "all" ? ["issues", "fixes", "confirm", "tradeoff"] : [section];
  const body = chosen.map((key) => parts[key]).filter(Boolean).join("\n\n");
  return `${title}\n\n${body}`;
}

export function renderItem(item, position) {
  return [style.bold(`Q7.${position + 1} ${item.title}`), "", itemBlock(item, position)].join("\n");
}

function footer(entry) {
  const explainId = entry.problemId;
  const simulateId = entry.itemId || (entry.kind === "item" ? entry.id : entry.problemId);
  return [`  Full answer: sdcli explain ${explainId}`, `  Watch it happen: sdcli simulate ${simulateId}`].join("\n");
}

export function renderEntry(entry) {
  if (entry.kind === "problem") {
    return renderProblem(findProblem(entry.problemId));
  }
  if (entry.kind === "item") {
    const position = OTHER.items.findIndex((item) => item.id === entry.id);
    return `${renderItem(OTHER.items[position], position)}\n\n${footer(entry)}`;
  }
  const kindLabel = { issue: "Issue", fix: "Fix", confirm: "How I'd confirm", tradeoff: "Trade-off" }[entry.kind];
  const head = entry.kind === "confirm" || entry.kind === "tradeoff" ? `${kindLabel}   (${entry.label})` : `${kindLabel}: ${entry.title}   (${entry.label})`;
  return `${style.bold(head)}\n${wrapText(entry.text, 92, "  ")}\n\n${footer(entry)}`;
}

export function detectSection(question) {
  const text = question.toLowerCase();
  if (/\b(fix|fixes|solution|solutions)\b/.test(text)) return "fixes";
  if (/\b(issues|causes|what could go wrong|possible problems)\b/.test(text)) return "issues";
  return "all";
}

export function renderAnswers(entries, question) {
  const section = detectSection(question);
  return entries
    .map((entry) => (entry.kind === "problem" && section !== "all" && !findProblem(entry.problemId).items ? renderProblem(findProblem(entry.problemId), section) : renderEntry(entry)))
    .join("\n\n");
}

export function renderTopics() {
  const lines = [style.bold("TOPICS")];
  PROBLEMS.forEach((problem) => {
    lines.push("", style.bold(`${problem.label}. ${problem.menuTitle}`));
    lines.push(`    Issues: ${problem.issues.map(([title]) => title).join("; ")}`);
    lines.push(`    Fixes: ${problem.fixes.map(([, title]) => title).join("; ")}`);
  });
  lines.push("", style.bold(`${OTHER.label}. ${OTHER.menuTitle}`));
  OTHER.items.forEach((item, position) => lines.push(`    Q7.${position + 1} ${item.title}`));
  return lines.join("\n");
}

export function renderOpening() {
  const lines = [
    "",
    style.bold("  Homework Platform: System Design Guide"),
    "  Ask me about the problems, their possible issues, and their fixes.",
    "  Type \"help\" for commands, \"exit\" to quit.",
    "",
    style.bold("  MAIN PROBLEMS"),
  ];
  [...PROBLEMS, OTHER].forEach((problem, index) => lines.push(`    ${index + 1}. ${problem.menuTitle}`));
  lines.push("", "  Type a number to open a problem, or just ask a question.", "  Type \"simulate q2\" to watch a problem happen and then get fixed.", "");
  return lines.join("\n");
}

export function renderMenu(problem) {
  if (problem.items) {
    const lines = ["", style.bold(`  ${problem.label}. ${problem.menuTitle}`), ""];
    problem.items.forEach((item, index) => lines.push(`    ${index + 1}. ${item.title}`));
    lines.push("    6. Full answer", "", "  Type a number, \"back\", or ask about any part.", "");
    return lines.join("\n");
  }
  return [
    "",
    style.bold(`  ${problem.label}. ${problem.title}`),
    "",
    "    1. Possible issues",
    "    2. Fixes",
    "    3. How I'd confirm the cause",
    "    4. Trade-off",
    "    5. Full answer",
    "",
    "  Type a number, \"back\", or ask about any part.",
    "",
  ].join("\n");
}

export function renderHelp() {
  return [
    "",
    style.bold("  COMMANDS"),
    "    ask \"<question>\"      ask about any problem, issue or fix",
    "    topics                list every problem and its parts",
    "    explain <q1-q7>       full answer for one problem",
    "    simulate <q1-q7>      watch a problem happen, then get fixed",
    "    interview             go through the likely questions one by one",
    "    help                  show this screen",
    "    exit                  quit",
    "",
    "  Simulation options",
    "    --try                 switch fixes on and off yourself",
    "    --fixes a,b           run with exactly these fixes",
    "    --auto                play on a timer instead of pressing Enter",
    "    --fast                print everything at once",
    "",
    style.bold("  ASSUMPTIONS"),
    ...ASSUMPTIONS.map((line) => `    - ${line}`),
    "",
    "  Tip: you can ask about a small part too, like \"auto-recovery\" or \"staggered deadlines\".",
    "",
  ].join("\n");
}
