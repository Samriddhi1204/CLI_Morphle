import { createTrace } from "./trace.js";
import { clock } from "../format.js";

export function countedAttempt(attempts, deadlineMinute) {
  const onTime = attempts.filter((attempt) => attempt.minute <= deadlineMinute);
  return onTime.length === 0 ? null : onTime[onTime.length - 1];
}

export function isOnTime({ startedMinute, finishedMinute, deadlineMinute, deviceClockOffset, serverTime, recordStart }) {
  if (!serverTime) return finishedMinute + deviceClockOffset <= deadlineMinute;
  const counted = recordStart ? startedMinute : finishedMinute;
  return counted <= deadlineMinute;
}

export function canOpen({ requester, owner, roleCheck }) {
  if (!roleCheck) return true;
  return requester.role === "teacher" || requester.id === owner;
}

export function sortByDeadline(queue) {
  return [...queue].sort((a, b) => a.deadline - b.deadline);
}

function finish(trace, problems, summaryWhenBad, summaryWhenOk) {
  return { events: trace.events, summary: problems > 0 ? summaryWhenBad : summaryWhenOk, ok: problems === 0, outcome: { problems } };
}

export function playDouble(active) {
  const trace = createTrace();
  const has = (id) => active.has(id);
  let problems = 0;
  trace.head("Q7.1 Aarav double-clicks Submit, then uploads again at 10:30 (deadline 10:40)");
  if (has("disableButton")) {
    trace.good("The button is disabled after the first click and the duplicate is rejected on the server.");
  } else {
    problems += 1;
    trace.bad("Two copies of the same homework were saved.");
  }
  const attempts = [{ number: 1, minute: 0 }, { number: 2, minute: 30 }];
  if (has("attempts")) {
    const counted = countedAttempt(attempts, 40);
    trace.good(`Every upload is an attempt. Attempt ${counted.number} is the latest before the deadline, so it counts.`);
    trace.info(has("keepOlder") ? "Attempt 1 is kept saved." : "Attempt 1 is not kept, so it is lost.");
    if (!has("keepOlder")) problems += 1;
    trace.info(has("showCounted") ? "The teacher sees only attempt 2." : "The teacher sees both attempts and may open the wrong one.");
    if (!has("showCounted")) problems += 1;
  } else {
    problems += 1;
    trace.bad("Nobody knows which upload counts, so the teacher may grade the wrong copy.");
  }
  return finish(trace, problems, `${problems} problem${problems === 1 ? "" : "s"} left with duplicate or unclear uploads`, "one counted attempt, older versions kept, no duplicates");
}

export function playDeadline(active) {
  const trace = createTrace();
  const has = (id) => active.has(id);
  let problems = 0;
  trace.head("Q7.2 The deadline is 10:00");
  const cheater = { startedMinute: 10, finishedMinute: 12, deadlineMinute: 0, deviceClockOffset: -30 };
  const slow = { startedMinute: -1, finishedMinute: 2, deadlineMinute: 0, deviceClockOffset: 0 };
  const cheatOk = isOnTime({ ...cheater, serverTime: has("serverTime"), recordStart: has("uploadStart") });
  if (cheatOk) {
    problems += 1;
    trace.bad("A student sets the device clock 30 minutes back and a late upload looks on time.");
  } else {
    trace.good("Server time decides, so changing the device clock does nothing.");
  }
  const slowOk = isOnTime({ ...slow, serverTime: has("serverTime"), recordStart: has("uploadStart") });
  if (!slowOk) {
    problems += 1;
    trace.bad("An upload started at 09:59 on slow internet finished at 10:02, so an on-time student looks late.");
  } else {
    trace.good("The upload start time (09:59) is recorded as well as the finish time, so the student counts as on time.");
  }
  if (has("perSlotDeadline") && has("equalSlots")) {
    trace.good("The deadline is stored per student or slot, and every slot gets the same amount of time.");
  } else {
    problems += 1;
    trace.bad("Slots are not stored per student or are not the same length, so some students get less time.");
  }
  if (has("rotate")) {
    trace.good("Slots rotate across assignments, so nobody always gets the last one.");
  } else {
    problems += 1;
    trace.bad("The same group always gets the first slot and another always gets the last.");
  }
  return finish(trace, problems, `${problems} unfair or wrong deadline outcome${problems === 1 ? "" : "s"}`, "deadlines are decided on server time and slots are fair");
}

export function playNoShow(active) {
  const trace = createTrace();
  const has = (id) => active.has(id);
  let problems = 0;
  trace.head("Q7.3 Aarav takes a seat and never joins. Meera and Ishaan are waiting");
  if (has("confirm")) {
    trace.good("Aarav must confirm within 2 minutes. He does not, so the seat is released.");
    if (has("releaseNext")) {
      trace.good("Meera, first on the waiting list, gets the seat automatically.");
    } else {
      problems += 1;
      trace.bad("The seat is released but nobody is moved up, so it stays empty.");
    }
  } else {
    problems += 1;
    trace.bad("The seat is wasted while others wait, and the teacher sits with empty seats and a long waiting list.");
  }
  trace.info(has("showPosition") ? "Ishaan sees he is number 1 on the waiting list." : "Ishaan cannot see his position.");
  if (has("lowerPriority")) {
    trace.good("Aarav has no-shown repeatedly, so he gets lower priority next time.");
  } else {
    trace.warn("Aarav can keep taking seats he does not use.");
  }
  return finish(trace, problems, "seats are still wasted", "no-show seats go to the next student");
}

export function playPrivacy(active) {
  const trace = createTrace();
  const has = (id) => active.has(id);
  let problems = 0;
  trace.head("Q7.4 Aarav (S-101) is logged in");
  trace.info(has("consent") ? "Parent consent was collected at signup." : "No parent consent was collected at signup.");
  if (!has("consent")) problems += 1;
  trace.info(has("nickname") ? "The leaderboard shows nickname Star-4821." : "The public leaderboard shows the real name Aarav Sharma.");
  if (!has("nickname")) problems += 1;
  const opened = canOpen({ requester: { id: "S-101", role: "student" }, owner: "S-102", roleCheck: has("rbac") && has("roleEveryRequest") });
  trace.visual("URL: /homework/S-102");
  if (opened) {
    problems += 1;
    trace.bad("Aarav changed the ID in the URL and opened Meera's homework.");
  } else {
    trace.good("Role checked on every request: a student sees only their own data, so the request is refused.");
  }
  trace.visual(has("logIds") ? "Log: user S-101 opened /homework/S-101" : "Log: aarav.sharma@example.com opened /homework/S-101");
  if (!has("logIds")) problems += 1;
  if (has("privateStorage")) {
    trace.good("The PDF is in private storage and opens through a link that expires after a few minutes.");
  } else {
    problems += 1;
    trace.bad("The PDF sits at a permanent public address.");
  }
  return finish(trace, problems, `${problems} privacy problem${problems === 1 ? "" : "s"} left`, "minors' data is protected");
}

export function playOverload(active) {
  const trace = createTrace();
  const has = (id) => active.has(id);
  let problems = 0;
  const queue = [
    { id: "sub-2001", deadline: 30 },
    { id: "sub-2002", deadline: 5 },
    { id: "sub-2003", deadline: 90 },
    { id: "sub-2004", deadline: 12 },
  ];
  trace.head("Q7.5 One teacher, 1,500 submissions");
  if (has("sortedQueue")) {
    const order = sortByDeadline(queue).map((item) => item.id);
    trace.good(`Grading queue sorted by deadline: ${order.join(", ")}. "Next submission" opens the first.`);
  } else {
    problems += 1;
    trace.bad(`Graded in random order: ${queue.map((item) => item.id).join(", ")}, so the urgent sub-2002 waits.`);
  }
  trace.info(has("snippets") ? "Feedback is one click: \"missing units\", \"good approach\"." : "Every comment is typed by hand.");
  if (!has("snippets")) problems += 1;
  trace.info(has("autoFlags") ? "Late, blank and duplicate files are flagged before they reach the teacher." : "Late, blank and duplicate files reach the teacher unflagged.");
  if (!has("autoFlags")) problems += 1;
  trace.head(`The teacher is absent at ${clock(0)}`);
  if (has("backupAccess")) {
    trace.good("The live-help teacher or an admin has backup access to the queue, so grading continues.");
  } else {
    problems += 1;
    trace.bad("Grading stops.");
  }
  trace.info(has("commonMistakes") ? "A \"common mistakes\" summary lets the teacher explain each one once in class." : "The teacher repeats the same comment on many submissions.");
  if (!has("commonMistakes")) problems += 1;
  trace.info(has("staggerLoad") ? "Staggered deadlines spread the grading load out." : "Everything arrives at the same deadline.");
  if (!has("staggerLoad")) problems += 1;
  return finish(trace, problems, `${problems} overload problem${problems === 1 ? "" : "s"} left`, "the teacher's load is spread out and grading never stops");
}
