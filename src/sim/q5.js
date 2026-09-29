import { createTrace } from "./trace.js";
import { clock } from "../format.js";

export const SIZE_LIMIT_MB = 10;

export const FILES = [
  { name: "report.pdf", type: "pdf", sizeMb: 2, empty: false, corrupted: false },
  { name: "empty.pdf", type: "pdf", sizeMb: 0, empty: true, corrupted: false },
  { name: "huge.pdf", type: "pdf", sizeMb: 45, empty: false, corrupted: false },
  { name: "notes.txt", type: "txt", sizeMb: 1, empty: false, corrupted: false },
  { name: "corrupted.pdf", type: "pdf", sizeMb: 3, empty: false, corrupted: true },
  { name: "report.pdf", type: "pdf", sizeMb: 2, empty: false, corrupted: false },
];

export function checkFile(file, limitMb = SIZE_LIMIT_MB) {
  if (file.type !== "pdf") return { ok: false, reason: "not a PDF" };
  if (file.empty) return { ok: false, reason: "the file is empty" };
  if (file.sizeMb > limitMb) return { ok: false, reason: `larger than the ${limitMb} MB limit` };
  if (file.corrupted) return { ok: false, reason: "the PDF is corrupted" };
  return { ok: true, reason: "" };
}

export function recordChange(history, change) {
  return [...history, { who: change.who, when: change.when, oldValue: change.oldValue, newValue: change.newValue }];
}

export function play(active) {
  const trace = createTrace();
  const has = (id) => active.has(id);
  const flags = { badAccepted: 0, duplicatesSilent: 0, unverifiedGrades: 0, untraceable: false };

  trace.head("Student side: Aarav submits six files");
  if (!has("fileChecks") || !has("summary") || !has("receipt") || !has("duplicate")) {
    trace.warn("Unchecked entry points here: file type, size, content, confirmation, receipt, duplicates.");
  }
  const accepted = [];
  FILES.forEach((file, index) => {
    const label = `${file.name} (${file.sizeMb} MB)`;
    const verdict = checkFile(file);
    if (has("fileChecks") && !verdict.ok) {
      trace.good(`${label} rejected: ${verdict.reason}.`);
      return;
    }
    if (!verdict.ok) {
      flags.badAccepted += 1;
      trace.bad(`${label} accepted even though ${verdict.reason}.`);
      return;
    }
    const seen = accepted.includes(file.name);
    if (seen && has("duplicate")) {
      trace.good(`${label} flagged: the same file was already uploaded.`);
      return;
    }
    if (seen) {
      flags.duplicatesSilent += 1;
      trace.bad(`${label} saved a second time with no warning.`);
    }
    accepted.push(file.name);
    if (has("summary")) {
      trace.visual(`  Summary: Aarav | assignment A7 | ${file.name} | ${file.sizeMb} MB | ${clock(index)}   [Confirm] [Back]`);
    }
    if (has("receipt")) {
      trace.good(`Receipt: submission sub-${1050 + index} at ${clock(index)}, so both sides can verify it later.`);
    } else if (!seen) {
      trace.info(`${label} saved. The student gets no receipt.`);
    }
  });
  trace.pause();

  trace.head("Teacher side: entering a score for sub-1050");
  let history = [];
  const enter = (minute, oldValue, newValue, confirmed) => {
    if (has("teacherPopup")) {
      trace.good(`Popup: "Are you sure?" student Aarav, assignment A7, score ${newValue}, comments. Teacher confirms.`);
    } else {
      flags.unverifiedGrades += 1;
      trace.bad(`Score ${newValue} saved instantly with no summary.`);
    }
    if (has("history")) {
      history = recordChange(history, { who: "teacher", when: clock(minute), oldValue, newValue });
    }
    return confirmed;
  };
  enter(20, "none", 8, true);
  enter(25, 8, 9, true);
  if (has("history")) {
    trace.visual("  Change history (who | when | old -> new):");
    history.forEach((row) => trace.visual(`    ${row.who} | ${row.when} | ${row.oldValue} -> ${row.newValue}`));
  } else {
    flags.untraceable = true;
    trace.bad("The score changed from 8 to 9, but there is no record of who changed it.");
  }

  const problems = flags.badAccepted + flags.duplicatesSilent + flags.unverifiedGrades + (flags.untraceable ? 1 : 0);
  const summary = `${flags.badAccepted} bad files accepted, ${flags.duplicatesSilent} silent duplicates, ${flags.unverifiedGrades} unchecked grades, history ${flags.untraceable ? "missing" : "kept"}`;
  return { events: trace.events, summary, ok: problems === 0, outcome: flags };
}
