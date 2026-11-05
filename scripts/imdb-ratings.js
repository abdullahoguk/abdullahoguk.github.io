#!/usr/bin/env node
// IMDb puanlarını günceller: watched.yaml içindeki her `imdb: tt…` için
// IMDb'nin herkese açık veri setinden (title.ratings.tsv.gz) puanı alır,
// `imdbRating:` satırını ekler ya da günceller. Dosyanın geri kalanına
// (yorumlar, sıralama) dokunmaz.
//
//   npm run imdb
import { readFile, writeFile } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";

const FILE = new URL("../src/_data/watched.yaml", import.meta.url);
const DATASET = "https://datasets.imdbws.com/title.ratings.tsv.gz";

const src = await readFile(FILE, "utf8");
const lines = src.split("\n");
const wanted = new Set([...src.matchAll(/^\s+imdb:\s*(tt\d+)/gm)].map((m) => m[1]));
console.log(`${wanted.size} IMDb kimliği bulundu, puanlar indiriliyor…`);

const res = await fetch(DATASET);
if (!res.ok) throw new Error(`İndirme başarısız: ${res.status}`);
const rl = createInterface({ input: Readable.fromWeb(res.body).pipe(createGunzip()) });
const ratings = new Map();
for await (const line of rl) {
  const tab = line.indexOf("\t");
  const id = line.slice(0, tab);
  if (wanted.has(id)) ratings.set(id, Number(line.slice(tab + 1).split("\t")[0]));
}

let added = 0, changed = 0;
const missing = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^(\s+)imdb:\s*(tt\d+)/);
  if (!m) continue;
  const [, indent, id] = m;
  const r = ratings.get(id);
  if (r == null) { missing.push(id); continue; }
  const next = lines[i + 1] ?? "";
  const row = `${indent}imdbRating: ${r}`;
  if (/^\s+imdbRating:/.test(next)) {
    if (next !== row) { lines[i + 1] = row; changed++; }
  } else {
    lines.splice(i + 1, 0, row); added++;
  }
}

await writeFile(FILE, lines.join("\n"));
console.log(`${added} puan eklendi, ${changed} puan güncellendi.`);
if (missing.length) console.log(`Puanı bulunamayan: ${missing.join(", ")}`);
