// Goodreads "Export Library" CSV → compact book records.
// Used by scripts/goodreads-import.js and the local panel.
import fs from "node:fs/promises";
import path from "node:path";

export const OUT_FILE = path.join(process.cwd(), "src/_data/goodreads-books.json");

// RFC 4180-ish parser: quoted fields, "" escapes, newlines inside quotes.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((k, i) => [k.trim(), r[i] ?? ""])));
}

const isbn = (v = "") => v.replace(/[="]/g, "").trim() || undefined;
const ymd = (v = "") => (v ? v.replace(/\//g, "-") : undefined);

// Only what the site shows; "to-read" is skipped.
export function toBooks(records) {
  return records
    .filter((r) => r["Exclusive Shelf"] === "read" || r["Exclusive Shelf"] === "currently-reading")
    .map((r) => {
      const [title, subtitle] = r.Title.split(/;\s*/);
      return {
        id: r["Book Id"],
        title: title.trim(),
        subtitle: subtitle?.trim() || undefined,
        author: r.Author,
        rating: Number(r["My Rating"]) || 0,
        status: r["Exclusive Shelf"] === "currently-reading" ? "reading" : "read",
        date: ymd(r["Date Read"]),
        added: ymd(r["Date Added"]),
        pages: Number(r["Number of Pages"]) || undefined,
        published: Number(r["Original Publication Year"] || r["Year Published"]) || undefined,
        isbn: isbn(r.ISBN13) || isbn(r.ISBN),
        review: r["My Review"] || undefined,
        url: `https://www.goodreads.com/book/show/${r["Book Id"]}`,
      };
    })
    .sort((a, b) => (b.date || b.added || "").localeCompare(a.date || a.added || ""));
}

export async function importCsv(text) {
  const books = toBooks(parseCsv(text));
  await fs.writeFile(OUT_FILE, JSON.stringify({ importedAt: new Date().toISOString(), books }, null, 1) + "\n");
  return books;
}
