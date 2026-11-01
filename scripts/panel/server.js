#!/usr/bin/env node
// Local content panel — npm run panel → http://127.0.0.1:4321
//
// Edits the YAML files in src/_data and writes them back; nothing else.
// Runs only on 127.0.0.1, is never deployed, has no auth. It also starts the
// Eleventy dev server (http://localhost:8080) so saves show up live; pass
// --no-dev to skip that.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { importCsv, OUT_FILE } from "../../lib/goodreads.js";

const PORT = Number(process.env.PANEL_PORT) || 4321;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const DATA = path.join(ROOT, "src/_data");
const PUBLIC = path.join(ROOT, "src/public");

// Files the panel may read and write. Nothing outside this list is touched.
const FILES = ["projects", "uses", "watched", "books", "bookmarks", "listens", "books-hidden"];
const SCENES = ["auto", "steppe", "spring", "summer", "autumn", "winter", "sunset"];
const UPLOAD_DIRS = ["uses", "projects", "bookmarks", "watched"];
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif", ".svg": "image/svg+xml" };

const yamlPath = (name) => path.join(DATA, `${name}.yaml`);

// keep the comment block at the top of each file — it documents the fields
async function headerOf(file) {
  try {
    const lines = (await fs.readFile(file, "utf8")).split("\n");
    const head = [];
    for (const l of lines) {
      if (l.startsWith("#") || l.trim() === "") head.push(l);
      else break;
    }
    return head.join("\n").trimEnd();
  } catch {
    return "";
  }
}

async function writeYaml(name, value) {
  const file = yamlPath(name);
  const header = await headerOf(file);
  const body = yaml.dump(value, { lineWidth: -1, noRefs: true, quotingType: '"' });
  await fs.writeFile(file + ".tmp", (header ? header + "\n" : "") + body);
  await fs.rename(file + ".tmp", file);
}

// site.yaml is long and hand-commented: only rewrite the lines we own
async function updateSite({ scene, scenePicker }) {
  const file = yamlPath("site");
  let text = await fs.readFile(file, "utf8");
  if (scene !== undefined) {
    if (!SCENES.includes(scene)) throw new Error("unknown scene");
    text = text.replace(/^scene:.*$/m, `scene: ${scene}`);
  }
  if (scenePicker !== undefined) text = text.replace(/^scenePicker:.*$/m, `scenePicker: ${scenePicker ? "true" : "false"}`);
  await fs.writeFile(file, text);
}

const send = (res, status, body, type = "application/json; charset=utf-8") => {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const readBody = (req, limit = 20 * 1024 * 1024) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) reject(new Error("too large"));
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

async function serveFile(res, base, rel) {
  const file = path.resolve(base, "." + path.posix.normalize("/" + rel));
  if (!file.startsWith(base + path.sep)) return send(res, 403, { error: "forbidden" });
  try {
    send(res, 200, await fs.readFile(file), MIME[path.extname(file).toLowerCase()] || "application/octet-stream");
  } catch {
    send(res, 404, { error: "not found" });
  }
}

const slug = (s) =>
  s.toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");

const server = http.createServer(async (req, res) => {
  // Refuse anything that isn't addressed to this machine (DNS-rebinding guard)
  const host = (req.headers.host || "").replace(/:\d+$/, "");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(host)) return send(res, 403, { error: "local only" });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  const write = req.method !== "GET";
  // Writes must be JSON or an explicit upload type → browsers on other origins can't send them without a preflight we never answer
  if (write && !/^(application\/json|text\/csv|application\/octet-stream)/.test(req.headers["content-type"] || "")) {
    return send(res, 415, { error: "bad content-type" });
  }

  try {
    if (p === "/" || p === "/index.html") return serveFile(res, HERE, "index.html");
    if (p === "/panel.js" || p === "/panel.css") return serveFile(res, HERE, p.slice(1));
    if (p.startsWith("/img/")) return serveFile(res, PUBLIC, p);

    const m = p.match(/^\/api\/data\/([a-z-]+)$/);
    if (m) {
      const name = m[1];
      if (!FILES.includes(name)) return send(res, 404, { error: "unknown file" });
      if (req.method === "GET") {
        let value;
        try {
          value = yaml.load(await fs.readFile(yamlPath(name), "utf8"));
        } catch {
          value = undefined;
        }
        return send(res, 200, { value: value ?? null });
      }
      if (req.method === "PUT") {
        const { value } = JSON.parse(await readBody(req));
        await writeYaml(name, value);
        return send(res, 200, { ok: true });
      }
    }

    if (p === "/api/site") {
      if (req.method === "GET") {
        const site = yaml.load(await fs.readFile(yamlPath("site"), "utf8"));
        return send(res, 200, { scene: site.scene, scenePicker: !!site.scenePicker, scenes: SCENES });
      }
      if (req.method === "PUT") {
        await updateSite(JSON.parse(await readBody(req)));
        return send(res, 200, { ok: true });
      }
    }

    if (p === "/api/goodreads") {
      if (req.method === "GET") {
        let data = { books: [] };
        try {
          data = JSON.parse(await fs.readFile(OUT_FILE, "utf8"));
        } catch {}
        return send(res, 200, data);
      }
      if (req.method === "POST") {
        const books = await importCsv((await readBody(req)).toString("utf8"));
        return send(res, 200, { ok: true, count: books.length });
      }
    }

    if (p === "/api/upload" && req.method === "POST") {
      const dir = url.searchParams.get("dir");
      const ext = path.extname(url.searchParams.get("name") || "").toLowerCase();
      if (!UPLOAD_DIRS.includes(dir) || !IMAGE_EXT.has(ext)) return send(res, 400, { error: "bad upload" });
      const base = slug(path.basename(url.searchParams.get("name"), ext)) || "image";
      const folder = path.join(PUBLIC, "img", dir);
      await fs.mkdir(folder, { recursive: true });
      let name = `${base}${ext}`;
      for (let i = 2; await fs.access(path.join(folder, name)).then(() => true, () => false); i++) name = `${base}-${i}${ext}`;
      await fs.writeFile(path.join(folder, name), await readBody(req));
      return send(res, 200, { path: `/img/${dir}/${name}` });
    }

    send(res, 404, { error: "not found" });
  } catch (err) {
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  panel → http://127.0.0.1:${PORT}\n`);
});

if (!process.argv.includes("--no-dev")) {
  const bin = path.join(ROOT, "node_modules/.bin/eleventy");
  const dev = spawn(bin, ["--serve", "--quiet"], { cwd: ROOT, stdio: "inherit" });
  const stop = () => {
    dev.kill();
    process.exit();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  console.log("  site  → http://localhost:8080 (eleventy --serve)\n");
}
