// One-off repair for a Windows checkout made with core.autocrlf=true: the index already holds LF, so
// rewriting the working tree to LF leaves `git status` clean while making the byte budgets and the
// "\n    " source contracts mean what they say. Read-only outside the given root.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: node normalize-lf.mjs <directory>");
  process.exit(2);
}
const textExt = new Set([".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".css", ".html", ".json", ".md", ".txt"]);
const skip = new Set(["node_modules", ".git", "android", "ios", "dist", "build", ".expo"]);
let changed = 0;
let scanned = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!textExt.has(extname(entry.name).toLowerCase())) continue;
    scanned += 1;
    const bytes = readFileSync(full);
    if (bytes.includes(0)) continue; // never touch something that is really binary
    const text = bytes.toString("utf8");
    if (!text.includes("\r\n")) continue;
    const lf = text.replace(/\r\n/g, "\n");
    writeFileSync(full, lf, "utf8");
    changed += 1;
  }
}

walk(root);
console.log(`scanned=${scanned} rewritten=${changed}`);
