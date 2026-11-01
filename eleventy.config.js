import yaml from "js-yaml";
import { buildGraph, mappers, plain } from "./lib/schema.js";

export const config = {
  dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
  markdownTemplateEngine: "njk",
  htmlTemplateEngine: "njk",
};

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const toDate = (value) => (value instanceof Date ? value : new Date(value));

export default function (eleventyConfig) {
  // All editable content lives in src/_data/*.yaml
  eleventyConfig.addDataExtension("yaml,yml", (contents) => yaml.load(contents));

  eleventyConfig.addGlobalData("buildYear", new Date().getFullYear());

  // src/public/* is copied as-is to the site root
  eleventyConfig.addPassthroughCopy({ "src/public": "/" });
  eleventyConfig.addWatchTarget("src/public/");

  // ── Collections ──────────────────────────────────────────────
  eleventyConfig.addCollection("posts", (api) =>
    api
      .getFilteredByGlob("src/blog/posts/*.md")
      .filter((p) => !p.data.draft || process.env.ELEVENTY_RUN_MODE === "serve")
      .sort((a, b) => b.date - a.date)
  );

  // Project detail pages: src/projects/<id>.md (data comes from projects.yaml)
  eleventyConfig.addCollection("projectPages", (api) => api.getFilteredByGlob("src/projects/*.md"));

  // ── Bilingual text ───────────────────────────────────────────
  // Fields can be a plain string or { tr, en }. `bi` renders Turkish with the
  // English line under it (smaller, fainter); `plain` flattens for meta/JSON-LD;
  // `en` prefers English (llms.txt).
  eleventyConfig.addFilter("bi", (v) => {
    if (v == null) return "";
    if (typeof v !== "object") return String(v);
    return v.en ? `${v.tr ?? ""}<span class="en" lang="en">${v.en}</span>` : String(v.tr ?? "");
  });
  eleventyConfig.addFilter("plain", (v) => plain(v));
  eleventyConfig.addFilter("en", (v) => (v && typeof v === "object" ? v.en || v.tr || "" : String(v ?? "")));

  // "2021-01" → "2021.01"; empty end → "şimdi"
  const ym = (v) => (v ? String(v).replace("-", ".") : "");
  eleventyConfig.addFilter("period", (e, short) => {
    const start = short ? String(e.start).slice(0, 4) : ym(e.start);
    const end = e.end ? (short ? String(e.end).slice(0, 4) : ym(e.end)) : "şimdi";
    return start === end ? start : `${start}–${end}`;
  });

  // External links open in a new tab. Done once on the final HTML so templates,
  // markdown and data-driven links all behave the same.
  eleventyConfig.addTransform("external-links", function (html) {
    if (!(this.page.outputPath || "").endsWith(".html")) return html;
    return html.replace(/<a\s([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>/g, (tag, pre, href, post) => {
      if (/abdullahoguk\.com\.tr|localhost/.test(new URL(href).host) || /\starget=/.test(tag)) return tag;
      let attrs = `${pre}href="${href}"${post}`;
      attrs = /\srel="/.test(` ${attrs}`)
        ? attrs.replace(/rel="([^"]*)"/, (m, v) => `rel="${[...new Set([...v.split(/\s+/).filter(Boolean), "noopener"])].join(" ")}"`)
        : `${attrs} rel="noopener"`;
      return `<a ${attrs} target="_blank">`;
    });
  });

  // ── Filters ──────────────────────────────────────────────────
  eleventyConfig.addFilter("isoDate", (d) => toDate(d).toISOString());
  eleventyConfig.addFilter("ymd", (d) => toDate(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("readableDate", (d) => {
    const date = toDate(d);
    return `${date.getUTCDate()} ${MONTHS_EN[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  });
  eleventyConfig.addFilter("year", (d) => (d ? toDate(d).getUTCFullYear() : ""));
  eleventyConfig.addFilter("absUrl", (path, base) => new URL(path || "/", base).href);
  eleventyConfig.addFilter("json", (value) =>
    // safe inside <script type="application/ld+json">
    JSON.stringify(value).replace(/</g, "\\u003c")
  );
  eleventyConfig.addFilter("stars", (n) => {
    const r = Math.max(0, Math.min(5, Number(n) || 0));
    return "■".repeat(r) + "□".repeat(5 - r);
  });
  eleventyConfig.addFilter("host", (url) => {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch {
      return url;
    }
  });
  eleventyConfig.addFilter("where", (arr, key, value) =>
    (arr || []).filter((item) => item && item[key] === value)
  );
  eleventyConfig.addFilter("fixed1", (n) => (Number.isFinite(Number(n)) ? Number(n).toFixed(1) : n));
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("whereIn", (arr, key, values) => (arr || []).filter((item) => values.includes(item?.[key] ?? "active")));
  eleventyConfig.addFilter("pageFor", (pages, id) => (pages || []).find((p) => p.fileSlug === id));
  // all tags used in a list, by frequency
  eleventyConfig.addFilter("tagCloud", (arr) => {
    const count = {};
    for (const it of arr || []) for (const t of it.tags || []) count[t] = (count[t] || 0) + 1;
    return Object.entries(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, n]) => ({ tag, n }));
  });
  const sortable = (v) => (v instanceof Date ? v.toISOString() : String(v ?? ""));
  eleventyConfig.addFilter("sortBy", (arr, key) => [...(arr || [])].sort((a, b) => sortable(b[key]).localeCompare(sortable(a[key]))));
  // {% jsonld %} — emits the page's schema.org @graph (see lib/schema.js)
  eleventyConfig.addShortcode("jsonld", function () {
    const d = this.ctx;
    const kind = d.schemaKind || "page";
    const listKey = d.schemaItems; // "projects" | "books" | "watched" | "posts"
    let source = [];
    if (listKey === "projects") source = d.projects || [];
    if (listKey === "books") source = [...(d.reading?.reading || []), ...(d.reading?.read || [])];
    if (listKey === "watched") source = (d.watched?.groups || []).flatMap((g) => g.items.map((w) => ({ ...w, type: w.type || g.type })));
    if (listKey === "listens") source = (d.listens?.playlists || []).filter((p) => p.url && !p.url.includes("TODO"));
    if (listKey === "bookmarks") source = d.bookmarks || [];
    if (listKey === "posts") source = d.collections?.posts || [];
    const items = listKey ? mappers[listKey](d.site, source) : [];
    const graph = buildGraph({
      site: d.site,
      resume: d.resume,
      projects: d.projects,
      page: this.page,
      title: d.title || d.site.title,
      description: plain(d.description || d.site.description),
      kind,
      items,
      post: kind === "post" ? { date: this.page.date, updated: d.updated, tags: d.tags, lang: d.lang, image: d.image } : undefined,
    });
    return `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, "\\u003c")}</script>`;
  });

  eleventyConfig.addFilter("excerpt", (content = "", n = 160) => {
    const text = String(content).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.length > n ? text.slice(0, n - 1).trimEnd() + "…" : text;
  });
}
