// Builds the /read list from three files:
//   goodreads-books.json  ← generated from the Goodreads CSV export (npm run goodreads)
//   books-hidden.yaml     ← Goodreads ids / titles to leave out
//   books.yaml            ← books that aren't on Goodreads
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

const dir = path.join(process.cwd(), "src/_data");
const load = async (file, parse) => {
  try {
    return parse(await fs.readFile(path.join(dir, file), "utf8"));
  } catch {
    return undefined;
  }
};

const norm = (s = "") => s.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export default async function () {
  const site = await load("site.yaml", yaml.load);
  const gr = (await load("goodreads-books.json", JSON.parse)) || { books: [] };
  // entries: "id" | "title" | { id, title, note }
  const hidden = new Set(
    ((await load("books-hidden.yaml", yaml.load)) || []).flatMap((h) => (h && typeof h === "object" ? [h.id, h.title] : [h])).filter(Boolean).map((v) => norm(String(v)))
  );
  const manual = ((await load("books.yaml", yaml.load)) || []).map((b) => ({
    status: "read",
    ...b,
    date: b.date ? String(b.date instanceof Date ? b.date.toISOString().slice(0, 10) : b.date) : undefined,
    source: "manual",
  }));

  const remote = gr.books
    .filter((b) => !hidden.has(norm(b.id)) && !hidden.has(norm(b.title)))
    .map((b) => ({ ...b, source: "goodreads" }));

  // the export can hold the same book twice (editions); keep the newest
  const seen = new Set();
  const all = [...manual, ...remote].filter((b) => {
    const key = `${norm(b.title)}|${norm(b.author)}`;
    if (!b.title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // undated books fall back to the year they were shelved on Goodreads
  const yearOf = (b) => (b.date ? Number(b.date.slice(0, 4)) : b.year || (b.added ? Number(b.added.slice(0, 4)) : undefined)) || undefined;
  const reading = all.filter((b) => b.status === "reading");
  const read = all
    .filter((b) => b.status !== "reading")
    .map((b) => ({ ...b, year: yearOf(b) }))
    .sort((a, b) => (b.date || b.added || `${b.year || ""}`).localeCompare(a.date || a.added || `${a.year || ""}`));

  const byYear = [];
  for (const book of read) {
    const y = book.year || "—";
    let bucket = byYear.find((g) => g.year === y);
    if (!bucket) byYear.push((bucket = { year: y, books: [] }));
    bucket.books.push(book);
  }
  // undated books go last
  byYear.sort((a, b) => (a.year === "—") - (b.year === "—"));

  return { reading, read, byYear, profile: site?.goodreads?.profile, importedAt: gr.importedAt };
}
