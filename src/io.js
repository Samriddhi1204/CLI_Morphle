import readline from "node:readline";

export function createIO({ input = process.stdin, output = process.stdout } = {}) {
  const queue = [];
  const waiters = [];
  let reader = null;
  let closed = false;

  const open = () => {
    reader = readline.createInterface({ input, terminal: false });
    reader.on("line", (line) => {
      const waiter = waiters.shift();
      if (waiter) waiter(line);
      else queue.push(line);
    });
    reader.on("close", () => {
      closed = true;
      waiters.splice(0).forEach((waiter) => waiter(null));
    });
  };

  const ask = (prompt) => {
    output.write(prompt);
    if (!reader) open();
    if (queue.length > 0) return Promise.resolve(queue.shift());
    if (closed) return Promise.resolve(null);
    return new Promise((resolve) => waiters.push(resolve));
  };

  return {
    ask,
    write: (text = "") => output.write(`${text}\n`),
    close: () => {
      if (reader) reader.close();
    },
    interactive: Boolean(input.isTTY && output.isTTY),
  };
}
