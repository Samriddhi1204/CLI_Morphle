const colorEnabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

const paint = (code) => (text) => (colorEnabled ? `\u001b[${code}m${text}\u001b[0m` : text);

export const style = {
  red: paint(31),
  green: paint(32),
  yellow: paint(33),
  blue: paint(34),
  cyan: paint(36),
  dim: paint(2),
  bold: paint(1),
};

export function bar(value, max, width = 30) {
  const ratio = max === 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const filled = Math.round(ratio * width);
  return `[${"#".repeat(filled)}${".".repeat(width - filled)}]`;
}

export function percent(ratio) {
  return `${Math.round(ratio * 100)}%`;
}

export function clock(minute, startHour = 10) {
  const total = startHour * 60 + minute;
  const hours = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function wrapText(text, width = 76, indent = "", hang = "") {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const prefix = lines.length === 0 ? indent : indent + hang;
    if (current && (prefix + current + " " + word).length > width) {
      lines.push(prefix + current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push((lines.length === 0 ? indent : indent + hang) + current);
  return lines.join("\n");
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
