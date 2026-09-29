import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const skip = new Set([".git", "node_modules"]);
const forbidden = [["cla", "ude"], ["anthro", "pic"], ["open", "ai"], ["g", "pt"], ["copi", "lot"], ["assis", "tant"], ["gener", "ated"]].map((parts) => parts.join(""));
const commentTokens = [["/", "/"], ["/", "*"], ["<", "!--"]].map((parts) => parts.join(""));

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    if (skip.has(name)) return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(root);

test("no file mentions a forbidden word", () => {
  for (const file of files) {
    const text = readFileSync(file, "utf8").toLowerCase();
    for (const word of forbidden) {
      assert.ok(!text.includes(word), `${file} contains "${word}"`);
    }
  }
});

test("no source file contains a comment", () => {
  for (const file of files.filter((path) => extname(path) === ".js")) {
    const text = readFileSync(file, "utf8");
    for (const token of commentTokens) {
      assert.ok(!text.includes(token), `${file} contains "${token}"`);
    }
  }
});

test("the package has no dependencies", () => {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.devDependencies, undefined);
});
