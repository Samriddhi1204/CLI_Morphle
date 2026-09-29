export function createTrace() {
  const events = [];
  const add = (kind) => (text) => events.push({ kind, text });
  return {
    events,
    head: add("head"),
    log: add("log"),
    info: add("info"),
    bad: add("bad"),
    good: add("good"),
    warn: add("warn"),
    visual: add("visual"),
    pause: () => events.push({ kind: "pause" }),
  };
}

export function hasAll(active, ids) {
  return ids.every((id) => active.has(id));
}
