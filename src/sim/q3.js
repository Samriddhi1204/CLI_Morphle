import { createTrace } from "./trace.js";

export const STUDENTS = [
  { id: "S-101", name: "Aarav", colour: "blue" },
  { id: "S-102", name: "Meera", colour: "orange" },
];

export const ASSIGNMENT = "A7";

export function storedName(student, uniqueNames, stamp) {
  return uniqueNames ? `${student.id}_${ASSIGNMENT}_${stamp}.pdf` : "homework.pdf";
}

export function saveUploads(uniqueNames) {
  const folder = new Map();
  STUDENTS.forEach((student, index) => {
    folder.set(storedName(student, uniqueNames, `10000${index + 1}`), student);
  });
  return folder;
}

export function lookup(rows, student, bothIds) {
  return bothIds
    ? rows.find((row) => row.studentId === student.id && row.assignmentId === ASSIGNMENT)
    : rows.find((row) => row.assignmentId === ASSIGNMENT);
}

export function insertRecord(rows, record, uniqueRule) {
  const duplicate = rows.some(
    (row) => row.studentId === record.studentId && row.assignmentId === record.assignmentId && row.attempt === record.attempt,
  );
  if (duplicate && uniqueRule) return { accepted: false, rows };
  return { accepted: true, rows: [...rows, record] };
}

export function claim(document, evaluators, statusCheck) {
  const winners = [];
  let status = document.status;
  for (const evaluator of evaluators) {
    if (statusCheck) {
      if (status === "unmarked") {
        status = "evaluating";
        winners.push(evaluator);
      }
    } else {
      winners.push(evaluator);
    }
  }
  return winners;
}

export function play(active) {
  const trace = createTrace();
  const has = (id) => active.has(id);
  const [aarav, meera] = STUDENTS;
  let swapped = 0;

  trace.head("(a) Both students upload at the same moment");
  const folder = saveUploads(has("uniqueNames"));
  trace.info(`Aarav uploads his report, Meera uploads hers.`);
  trace.visual(`Storage folder: ${[...folder.keys()].join(", ")}`);
  if (folder.size < STUDENTS.length) {
    swapped += 1;
    trace.bad("Both files were saved as homework.pdf, so the second overwrote the first. The teacher opens Aarav's submission and sees Meera's file.");
  } else {
    trace.good("Each file has its own name (studentId_assignmentId_timestamp.pdf), so nothing is overwritten.");
  }
  trace.pause();

  trace.head("(b) The teacher opens Meera's submission");
  let rows = [
    { studentId: aarav.id, assignmentId: ASSIGNMENT, attempt: 1, file: "aarav-report.pdf" },
    { studentId: meera.id, assignmentId: ASSIGNMENT, attempt: 1, file: "meera-report.pdf" },
  ];
  if (has("lookupBoth")) {
    const query = has("prisma")
      ? "Prisma builds the query: findUnique({ studentId: \"S-102\", assignmentId: \"A7\", attempt: 1 })"
      : "Query: where studentId = S-102 and assignmentId = A7";
    trace.visual(query);
  } else {
    trace.visual("Query: where assignmentId = A7");
  }
  const found = lookup(rows, meera, has("lookupBoth"));
  if (found.studentId !== meera.id) {
    swapped += 1;
    trace.bad(`The query returned the first record for A7: ${found.file}. Meera's submission shows Aarav's file.`);
  } else {
    trace.good(`The query returned ${found.file}, the right record.`);
  }
  const attempt = insertRecord(rows, { studentId: aarav.id, assignmentId: ASSIGNMENT, attempt: 1, file: "second-copy.pdf" }, has("uniqueRule"));
  rows = attempt.rows;
  if (attempt.accepted) {
    trace.warn("A second record for S-101 + A7 + attempt 1 was accepted, so lookups can now return the wrong one.");
  } else {
    trace.good("A second record for S-101 + A7 + attempt 1 was rejected by the unique rule.");
  }
  trace.pause();

  trace.head("(c) Two requests run at the same time");
  if (has("noGlobals")) {
    trace.good("Each request keeps its own data, so Aarav's request still holds Aarav's submission after Meera's request starts.");
  } else {
    swapped += 1;
    trace.visual("currentSubmission = Aarav's   (request 1 sets it)");
    trace.visual("currentSubmission = Meera's   (request 2 sets it)");
    trace.bad("Request 1 reads currentSubmission and gets Meera's, because a shared variable was overwritten.");
  }
  trace.pause();

  trace.head("(d) Caching");
  if (has("lookupBoth")) {
    trace.good("The cache key includes both IDs (S-102:A7), so Meera gets Meera's data.");
  } else {
    swapped += 1;
    trace.bad("The cache key is only A7. Aarav's answer was cached first and Meera is served Aarav's data.");
  }
  trace.pause();

  trace.head("(e) Two evaluators open the same document");
  const winners = claim({ status: "unmarked" }, ["Evaluator 1", "Evaluator 2"], has("statusCheck"));
  if (winners.length > 1) {
    swapped += 1;
    trace.bad("Both evaluators saw unmarked and both marked the document, so the marks can clash.");
  } else {
    trace.good(`unmarked -> evaluating happens in one step: ${winners[0]} gets it, the other sees evaluating and skips it.`);
    trace.good("A document that is already marked is skipped.");
  }

  const summary = `${swapped} of 5 scenarios end with swapped or double-handled homework`;
  return { events: trace.events, summary, ok: swapped === 0, outcome: { swapped } };
}
