// Raindrop.io CSV export → bookmarks.yaml entries.
// Used by scripts/raindrop-import.js. Personal folders and noise are filtered out;
// anything listed in bookmarks-hidden.yaml is never (re)added.
import { parseCsv } from "./goodreads.js";

// folders that are personal (shopping lists, religious notes) — never published
export const SKIP_FOLDERS = ["Buy", "Dini", "Unsorted"];
// single links that aren't useful to others
export const SKIP_HOSTS = ["instagram.com", "reddit.com", "mobcup.fm", "claude.com", "e-komponent.com", "opensourceprojects.dev"];

const FOLDER_TAGS = {
  "Design Tools": ["design", "tool"],
  "Desingn Inspo": ["design", "inspiration"],
  "Design Inspo": ["design", "inspiration"],
  "Claude Skills": ["ai", "claude"],
  "AI Tools": ["ai"],
  Apps: ["app"],
  "Tech Lookup": ["dev"],
  Nothing: ["nothing"],
  Art: ["art"],
  "DIY and 3D print": ["diy", "3d-print"],
  Customization: ["dev"],
};
// extra tags by keyword in title / url / excerpt
const KEYWORD_TAGS = [
  [/ascii/i, "ascii"],
  [/video|remotion|opencut|openreel|fframes|trim/i, "video"],
  [/pixel/i, "pixel-art"],
  [/\b3d\b|spline|lithophane|stl/i, "3d"],
  [/seo/i, "seo"],
  [/security|siber/i, "security"],
  [/self-host|coolify|uptime|tunnel|n8n/i, "self-host"],
  [/animation|anime\.js|motion\.dev/i, "animation"],
  [/font|typeface|type generator|calligraph/i, "type"],
  [/wallpaper/i, "wallpaper"],
  [/glyph/i, "glyph"],
];

// Raindrop's own tags → site tags (null = drop)
const CSV_TAGS = { "ascii art": "ascii", "pixel art": "pixel-art", "hex art": "hex", "ui design": "ui", "siber güvenlik": null, "web güvenliği": null, try: null };

const decode = (s = "") =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export const normUrl = (u = "") => {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|ref|rdt|tab)/.test(k)) url.searchParams.delete(k);
    return (url.host.replace(/^www\./, "") + url.pathname.replace(/\/(tree\/main)?\/?$/, "") + url.search).toLowerCase();
  } catch {
    return u.toLowerCase();
  }
};

function cleanTitle(title, url) {
  let t = decode(title).trim();
  const gh = url.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
  if (gh && /^GitHub - |· GitHub$|^[\w.-]+\/[\w.-]+:/.test(t)) return gh[2];
  t = t.replace(/^GitHub - /, "").replace(/ · GitHub$/, "");
  // "Name | tagline" / "Name - tagline" / "Name — tagline" → Name (when the rest is long)
  const m = t.match(/^(.{2,40}?)\s+[|—–·-]\s+(.{12,})$/);
  if (m) t = m[1];
  return t.replace(/:\s.*$/, (rest) => (t.length > 48 ? "" : rest)).trim();
}

function cleanNote(r) {
  let n = decode(r.note || r.excerpt || "").replace(/\s+/g, " ").trim();
  n = n.replace(/ - [\w.-]+\/[\w.-]+$/, ""); // GitHub "… - owner/repo"
  if (/^Contribute to .* by creating an account/.test(n)) n = "";
  if (n.length > 140) n = n.slice(0, 139).replace(/\s+\S*$/, "") + "…";
  return n;
}

export function toBookmarks(csvText, hidden = new Set()) {
  const seen = new Set();
  const out = [];
  for (const r of parseCsv(csvText)) {
    if (!r.url || SKIP_FOLDERS.includes(r.folder)) continue;
    let host = "";
    try { host = new URL(r.url).host.replace(/^www\./, ""); } catch { continue; }
    if (SKIP_HOSTS.some((h) => host === h || host.endsWith("." + h))) continue;
    const key = normUrl(r.url);
    if (seen.has(key) || hidden.has(key)) continue;
    seen.add(key);
    const hay = `${r.title} ${r.url} ${r.excerpt}`;
    const tags = new Set([
      ...(FOLDER_TAGS[r.folder] || []),
      ...KEYWORD_TAGS.filter(([re]) => re.test(hay)).map(([, t]) => t),
      ...(r.tags || "").split(",").map((t) => { const k = t.trim().toLowerCase(); return k in CSV_TAGS ? CSV_TAGS[k] : k.replace(/\s+/g, "-"); }).filter(Boolean),
    ]);
    if (tags.has("3d-print")) tags.delete("3d");
    out.push({ title: cleanTitle(r.title, r.url), url: r.url.replace(/[?&]utm_[^&]+/g, ""), note: cleanNote(r), tags: [...tags], added: (r.created || "").slice(0, 10) });
  }
  return out;
}
