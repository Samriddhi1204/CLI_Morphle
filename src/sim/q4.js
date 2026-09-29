import { createTrace } from "./trace.js";
import { bar } from "../format.js";
import { DEFAULTS } from "../params.js";

export const WAITING = [
  { name: "Meera", marks: 71, seatedLastTime: false },
  { name: "Ishaan", marks: 55, seatedLastTime: false },
  { name: "Kabir", marks: 42, seatedLastTime: true },
];

export function simultaneousJoin({ seated, capacity, oneStep, clickers }) {
  if (!oneStep) {
    const admitted = seated < capacity ? clickers : [];
    return { admitted, rest: seated < capacity ? [] : clickers, seatedAfter: seated + admitted.length };
  }
  const free = Math.max(0, capacity - seated);
  const admitted = clickers.slice(0, free);
  return { admitted, rest: clickers.slice(free), seatedAfter: seated + admitted.length };
}

export function selectionOrder(waiting, useMarks) {
  if (!useMarks) return [...waiting];
  const byMarks = (a, b) => a.marks - b.marks;
  const fresh = waiting.filter((student) => !student.seatedLastTime).sort(byMarks);
  const rotated = waiting.filter((student) => student.seatedLastTime).sort(byMarks);
  return [...fresh, ...rotated];
}

function seatLine(count, capacity) {
  return `Seats ${bar(Math.min(count, capacity), capacity, 20)} ${count} / ${capacity}`;
}

export function play(active, params = {}) {
  const base = params.capacity ?? DEFAULTS.capacity;
  const nearly = base - 1;
  const trace = createTrace();
  const has = (id) => active.has(id);
  const flags = { overCapacity: false, guestSeated: false, leftOut: 0, wastedSeat: false, slowJoin: false };

  trace.head(`Scene 1: someone who is not logged in clicks Join (${base - 2} of ${base} seats taken)`);
  if (has("auth")) {
    trace.good(`The join is refused: "Log in to join". A logged-in student, Nisha, takes the next seat: ${nearly} / ${base}.`);
  } else {
    flags.guestSeated = true;
    trace.bad(`A guest with no login took a seat: ${nearly} / ${base}.`);
  }
  trace.pause();

  trace.head("Scene 2: Aarav and Meera click Join for the last seat at the same moment");
  trace.visual(seatLine(nearly, base));
  const race = simultaneousJoin({ seated: nearly, capacity: base, oneStep: has("oneStep"), clickers: ["Aarav", "Meera"] });
  if (race.seatedAfter > base) {
    flags.overCapacity = true;
    trace.log(`Aarav checks: ${nearly} seated. Meera checks: ${nearly} seated. Both see room.`);
    trace.bad(`Both were added. ${seatLine(race.seatedAfter, base)}  over capacity`);
  } else {
    trace.good(`The seat is reserved in one database step. Aarav gets it. ${seatLine(race.seatedAfter, base)}`);
    if (has("waitlist")) {
      trace.good("Meera sees \"Session full\" and is number 1 on the waiting list.");
    } else {
      flags.leftOut += 1;
      trace.bad("Meera sees \"Session full\" and is turned away, with no waiting list.");
    }
  }
  trace.pause();

  trace.head(`Scene 3: two groups of ${base} join the empty session together`);
  const capacity = has("capacity") ? base + 10 : base;
  if (has("capacity")) {
    trace.info(`The teacher raises the capacity setting to ${capacity} for this session.`);
  } else {
    trace.info(`Capacity is fixed at ${base}.`);
  }
  const clickers = Array.from({ length: base * 2 }, (_, index) => `student-${index + 1}`);
  const groups = simultaneousJoin({ seated: 0, capacity, oneStep: has("oneStep"), clickers });
  if (groups.seatedAfter > capacity) {
    flags.overCapacity = true;
    trace.bad(`Both groups were told there is room. ${seatLine(groups.seatedAfter, capacity)}  over capacity`);
  } else {
    trace.good(`Exactly ${groups.seatedAfter} were seated. ${seatLine(groups.seatedAfter, capacity)}`);
    if (has("waitlist")) {
      trace.good(`${groups.rest.length} students are on the waiting list and see their position.`);
    } else {
      flags.leftOut += groups.rest.length;
      trace.bad(`${groups.rest.length} students were turned away with no waiting list.`);
    }
  }
  trace.pause();

  trace.head("Scene 4: Aarav has a seat but never confirms. Meera, Ishaan and Kabir are waiting");
  if (has("noShow")) {
    trace.good("After 2 minutes without a confirmation the seat is released.");
    if (has("waitlist")) {
      const next = selectionOrder(WAITING, has("marks"))[0];
      if (has("marks")) {
        trace.good(`Chosen by marks in the last few tests: ${next.name} (${next.marks}). Kabir (42) was seated last time, so rotation moves him behind the others.`);
      } else {
        trace.info(`${next.name} is next because they joined first.`);
      }
    } else {
      trace.warn("There is no waiting list, so nobody is promoted and the seat stays empty.");
    }
  } else {
    flags.wastedSeat = true;
    trace.bad("The seat stays taken all session while others wait.");
  }
  trace.pause();

  trace.head("Scene 5: waiting students");
  if (has("listenOnly")) {
    trace.good("Kabir taps \"Listen only\" and follows the session while he waits.");
  } else {
    trace.warn("Waiting students can only wait until a seat frees up.");
  }
  trace.pause();

  trace.head("Scene 6: 300 students open the join page (numbers are illustrative)");
  if (has("balancer")) {
    trace.good("Load balancing: 3 servers share the join requests, about 60% load each.");
  } else {
    flags.slowJoin = true;
    trace.bad("One server takes every join request: about 180% load, so the join page is slow.");
  }

  const problems = [flags.overCapacity, flags.guestSeated, flags.leftOut > 0, flags.wastedSeat, flags.slowJoin].filter(Boolean).length;
  const summary = `${problems} problem${problems === 1 ? "" : "s"} left: over capacity ${flags.overCapacity ? "yes" : "no"}, guest seated ${flags.guestSeated ? "yes" : "no"}, students left out ${flags.leftOut}, wasted seat ${flags.wastedSeat ? "yes" : "no"}`;
  return { events: trace.events, summary, ok: problems === 0, outcome: flags };
}
