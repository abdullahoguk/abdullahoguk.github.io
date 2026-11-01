#!/usr/bin/env node
// npm run raindrop -- ~/Downloads/<raindrop-export>.csv
// Adds new links to src/_data/bookmarks.yaml. Existing entries (and your edits
// to them) are kept; links in bookmarks-hidden.yaml are never re-added.
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { toBookmarks, normUrl } from "../lib/raindrop.js";

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run raindrop -- path/to/raindrop-export.csv");
  process.exit(1);
}
const data = path.join(process.cwd(), "src/_data");
const read = async (f) => {
  try {
    return await fs.readFile(path.join(data, f), "utf8");
  } catch {
    return "";
  }
};
const text = await read("bookmarks.yaml");
const header = text.split("\n").filter((l, i, a) => a.slice(0, i + 1).every((x) => x.startsWith("#") || !x.trim())).join("\n").trimEnd();
const current = yaml.load(text) || [];
const hidden = new Set((yaml.load(await read("bookmarks-hidden.yaml")) || []).map((h) => normUrl(typeof h === "object" ? h.url : h)));
const have = new Set(current.map((b) => normUrl(b.url)));

const incoming = toBookmarks(await fs.readFile(file, "utf8"), hidden).filter((b) => !have.has(normUrl(b.url)));
const merged = [...current, ...incoming].sort((a, b) => String(b.added).localeCompare(String(a.added)));
await fs.writeFile(path.join(data, "bookmarks.yaml"), header + "\n" + yaml.dump(merged, { lineWidth: -1, quotingType: '"' }));
console.log(`✓ ${incoming.length} new bookmarks (${merged.length} total)`);
