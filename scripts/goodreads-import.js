#!/usr/bin/env node
// npm run goodreads -- ~/Downloads/goodreads_library_export.csv
// Rewrites src/_data/goodreads-books.json. Hidden books (books-hidden.yaml)
// and hand-added books (books.yaml) are untouched.
import fs from "node:fs/promises";
import { importCsv, OUT_FILE } from "../lib/goodreads.js";

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run goodreads -- path/to/goodreads_library_export.csv");
  process.exit(1);
}
const books = await importCsv(await fs.readFile(file, "utf8"));
const reading = books.filter((b) => b.status === "reading").length;
console.log(`✓ ${books.length} books (${reading} reading, ${books.length - reading} read) → ${OUT_FILE}`);
