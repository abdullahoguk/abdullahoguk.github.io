// Local content panel. A small schema-driven editor: each tab describes the
// shape of one YAML file; the renderer builds the form recursively and the
// whole value is PUT back on save.

// ── tiny DOM helper ─────────────────────────────────────────────
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
};

const api = async (url, opts = {}) => {
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
};
const putJson = (url, body) => api(url, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

let toastTimer;
function toast(msg, err) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "on" + (err ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ""), 2200);
}

// ── field types ─────────────────────────────────────────────────
const text = (key, label, extra = {}) => ({ key, label, type: "text", ...extra });
const area = (key, label) => ({ key, label, type: "textarea" });
const url = (key, label = key) => ({ key, label, type: "url" });
const bi = (key, label) => ({ key, label, type: "bi" });
const bool = (key, label) => ({ key, label, type: "bool" });
const num = (key, label, extra = {}) => ({ key, label, type: "number", ...extra });
const select = (key, label, options) => ({ key, label, type: "select", options });
const tags = (key, label) => ({ key, label, type: "tags" });
const image = (key, label, dir) => ({ key, label, type: "image", dir });
const date = (key, label) => ({ key, label, type: "date" });
const list = (key, label, item, opts = {}) => ({ key, label, type: "list", item, ...opts });
const obj = (key, label, fields) => ({ key, label, type: "object", fields });

const today = () => new Date().toISOString().slice(0, 10);

// ── schemas (one per YAML file) ─────────────────────────────────
const linkItem = { fields: [text("label", "etiket"), text("handle", "kullanıcı"), url("url")], title: (v) => v.label };

const TABS = [
  {
    id: "projects", label: "projeler", file: "projects",
    hint: "Detay sayfası için src/projects/<id>.md oluştur. status: active · wip (geliştiriliyor) · archived (eski işler).",
    root: list(null, null, {
      title: (v) => `${v.title || "yeni proje"}  ·  ${v.status || ""}`,
      fields: [
        text("id", "id", { placeholder: "url-dostu-ad" }), text("title", "başlık"), text("year", "yıl", { placeholder: "2024 veya 2022–" }),
        select("status", "durum", ["active", "wip", "archived"]), select("kind", "tür", ["dev", "design", "music", "photo"]),
        text("role", "rol"), bi("summary", "özet"), url("url", "site"), url("repo", "kaynak"),
        tags("stack", "teknik"), image("image", "görsel", "projects"), bool("featured", "ana sayfada"),
        select("schema", "schema", ["WebSite", "SoftwareApplication", "CreativeWork"]),
        list("links", "ek linkler", { fields: [text("label", "etiket"), url("url")], title: (v) => v.label }),
      ],
      blank: () => ({ id: "", title: "", year: String(new Date().getFullYear()), status: "wip", kind: "dev", role: "", summary: { tr: "", en: "" }, url: "", repo: "", stack: [], featured: false, schema: "SoftwareApplication" }),
    }),
  },
  {
    id: "uses", label: "uses", file: "uses",
    hint: "Kategori başlıkları ve içindekiler. Her ürüne tek fotoğraf eklenebilir; sayfanın başına da bir masa fotoğrafı.",
    root: obj(null, null, [
      image("photo", "kapak foto", "uses"),
      list("groups", "kategoriler", {
        title: (v) => (v.title?.tr || v.title || "kategori") + `  ·  ${(v.items || []).length}`,
        fields: [
          bi("title", "başlık"),
          list("items", "ürünler", {
            title: (v) => v.name,
            fields: [text("name", "ad"), text("note", "not"), url("url", "link"), image("image", "foto", "uses")],
            blank: () => ({ name: "", note: "" }),
          }),
        ],
        blank: () => ({ title: { tr: "", en: "" }, items: [] }),
      }),
    ]),
  },
  {
    id: "watched", label: "izlediklerim", file: "watched",
    hint: "Gruplar diziler / filmler altında listelenir. “favori” işaretliler kalın görünür. imdb alanına tt… kimliğini yaz (IMDb adresindeki); boşsa IMDb araması linklenir.",
    root: obj(null, null, [
      list("groups", "gruplar", {
        title: (v) => `${v.type === "series" ? "dizi" : "film"} · ${v.title?.tr || v.title || "grup"}  ·  ${(v.items || []).length}`,
        fields: [
          bi("title", "başlık"), select("type", "tür", ["series", "movie"]),
          list("items", "yapımlar", {
            title: (v) => `${v.fav ? "★ " : ""}${v.title || "yeni"} ${v.year || ""}`,
            fields: [text("title", "ad"), text("year", "yıl"), bool("fav", "favori"), text("imdb", "imdb id", { placeholder: "tt0141842" }), num("imdbRating", "imdb puanı"), text("note", "not")],
            blank: () => ({ title: "", year: new Date().getFullYear() }),
            prepend: true,
          }),
        ],
        blank: () => ({ title: { tr: "", en: "" }, type: "movie", items: [] }),
      }),
    ]),
  },
  {
    id: "books", label: "kitaplar", file: "books",
    hint: "Goodreads'te olmayan kitaplar. Goodreads kitapları için “goodreads” sekmesi.",
    root: list(null, null, {
      title: (v) => `${v.title || "yeni kitap"}  ·  ${v.author || ""}`,
      fields: [
        text("title", "ad"), text("author", "yazar"), date("date", "bitirme"), select("status", "durum", ["read", "reading"]),
        num("rating", "puan 0–5", { min: 0, max: 5 }), text("note", "not"), url("url", "link"),
      ],
      blank: () => ({ title: "", author: "", date: today(), status: "read", rating: 0 }),
    }),
  },
  { id: "goodreads", label: "goodreads", custom: goodreadsView },
  {
    id: "bookmarks", label: "bookmarks", file: "bookmarks",
    root: list(null, null, {
      title: (v) => `${v.title || "yeni link"}  ·  ${(v.tags || []).join(", ")}`,
      fields: [text("title", "başlık"), url("url"), text("note", "not"), tags("tags", "etiketler"), date("added", "eklenme")],
      blank: () => ({ title: "", url: "", note: "", tags: [], added: today() }),
      prepend: true,
    }),
  },
  {
    id: "listens", label: "dinlediklerim", file: "listens",
    root: obj(null, null, [
      bi("blurb", "giriş cümlesi"),
      list("playlists", "playlistler", {
        title: (v) => v.title,
        fields: [text("title", "ad"), text("note", "not"), select("platform", "platform", ["youtube", "spotify", "soundcloud", "apple", "other"]), url("url"), bool("featured", "ana sayfada")],
        blank: () => ({ title: "", note: "", platform: "youtube", url: "", featured: false }),
      }),
      obj("tekke", "tekke musikisi", [
        text("title", "başlık"), bi("blurb", "açıklama"),
        obj("playlist", "playlist", [text("title", "ad"), text("platform", "platform"), url("url")]),
        list("links", "hesaplar", linkItem),
      ]),
      list("profiles", "profiller", linkItem),
    ]),
  },
  { id: "settings", label: "ayarlar", custom: settingsView },
];

// ── generic renderer ────────────────────────────────────────────
let dirty = false;
const markDirty = () => {
  dirty = true;
  document.querySelector(".bar .state")?.replaceChildren(h("span", { class: "dirty" }, "● kaydedilmedi"));
};

function fieldRow(label, control) {
  return h("div", { class: "field" }, h("label", {}, label), control);
}

function renderField(f, holder) {
  const get = () => holder[f.key];
  const set = (v) => {
    holder[f.key] = v;
    markDirty();
  };
  switch (f.type) {
    case "text":
    case "url":
      return fieldRow(f.label, h("input", { type: f.type === "url" ? "url" : "text", value: get() ?? "", placeholder: f.placeholder, oninput: (e) => set(e.target.value) }));
    case "date":
      return fieldRow(f.label, h("input", { type: "date", value: get() ? String(get()).slice(0, 10) : "", oninput: (e) => set(e.target.value) }));
    case "textarea":
      return fieldRow(f.label, h("textarea", { value: get() ?? "", oninput: (e) => set(e.target.value) }));
    case "number":
      return fieldRow(f.label, h("input", { type: "number", min: f.min, max: f.max, value: get() ?? "", oninput: (e) => set(e.target.value === "" ? undefined : Number(e.target.value)) }));
    case "bool":
      return fieldRow(f.label, h("input", { type: "checkbox", checked: !!get(), onchange: (e) => set(e.target.checked) }));
    case "select": {
      const cur = get() ?? "";
      const opts = f.options.includes(cur) || !cur ? f.options : [cur, ...f.options];
      return fieldRow(f.label, h("select", { onchange: (e) => set(e.target.value) }, opts.map((o) => h("option", { value: o, selected: o === cur }, o))));
    }
    case "bi": {
      // accept a legacy plain string; save as { tr, en }
      let v = get();
      if (typeof v !== "object" || v === null) holder[f.key] = v = { tr: v ?? "", en: "" };
      return fieldRow(
        f.label,
        h("div", { class: "bi" },
          h("textarea", { value: v.tr ?? "", placeholder: "Türkçe", rows: 2, oninput: (e) => { v.tr = e.target.value; markDirty(); } }),
          h("textarea", { class: "en-in", value: v.en ?? "", placeholder: "English (altında küçük ve soluk görünür)", rows: 1, oninput: (e) => { v.en = e.target.value; markDirty(); } })
        )
      );
    }
    case "tags": {
      const box = h("div", { class: "tags-in" });
      const draw = () => {
        const arr = get() || [];
        const input = h("input", {
          placeholder: "ekle + enter",
          onkeydown: (e) => {
            if ((e.key === "Enter" || e.key === ",") && e.target.value.trim()) {
              e.preventDefault();
              set([...(get() || []), ...e.target.value.split(",").map((s) => s.trim()).filter(Boolean)]);
              draw();
              box.querySelector("input").focus();
            } else if (e.key === "Backspace" && !e.target.value && arr.length) {
              set(arr.slice(0, -1));
              draw();
              box.querySelector("input").focus();
            }
          },
        });
        box.replaceChildren(
          ...arr.map((t, i) => h("span", { class: "chip" }, t, h("button", { type: "button", "aria-label": `${t} sil`, onclick: () => { set(arr.filter((_, j) => j !== i)); draw(); } }, "×"))),
          input
        );
      };
      draw();
      return fieldRow(f.label, box);
    }
    case "image": {
      const wrap = h("div", { class: "img" });
      const draw = () => {
        const v = get();
        wrap.replaceChildren(...[
          v ? h("img", { src: v, alt: "" }) : null,
          h("input", { type: "text", value: v ?? "", placeholder: "/img/…", oninput: (e) => set(e.target.value) }),
          h("label", { class: "btn ghost", style: "cursor:pointer;border:1px solid var(--faint);padding:.3rem .8rem;white-space:nowrap" }, "yükle",
            h("input", {
              type: "file", accept: "image/*", hidden: true,
              onchange: async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                  const r = await api(`/api/upload?dir=${f.dir}&name=${encodeURIComponent(file.name)}`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: file });
                  set(r.path);
                  draw();
                  toast("görsel yüklendi");
                } catch (err) {
                  toast(err.message, true);
                }
              },
            })),
          v ? h("button", { type: "button", class: "icon", title: "kaldır", onclick: () => { set(""); draw(); } }, "×") : null,
        ].filter(Boolean));
      };
      draw();
      return fieldRow(f.label, wrap);
    }
    case "object": {
      if (!holder[f.key] || typeof holder[f.key] !== "object") holder[f.key] = {};
      const body = h("div", { class: "nested" }, f.fields.map((sub) => renderField(sub, holder[f.key])));
      return fieldRow(f.label, body);
    }
    case "list": {
      if (!Array.isArray(holder[f.key])) holder[f.key] = [];
      return fieldRow(f.label, renderList(holder[f.key], f.item));
    }
  }
}

function renderList(arr, item) {
  const box = h("div", { class: "list" });
  const draw = (openIndex) => {
    box.replaceChildren(
      ...arr.map((v, i) => {
        const sum = h("summary", {},
          h("span", { class: "t" }, item.title?.(v) || `#${i + 1}`),
          h("button", { type: "button", class: "icon", title: "yukarı", onclick: (e) => { e.preventDefault(); if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; markDirty(); draw(i - 1); } } }, "↑"),
          h("button", { type: "button", class: "icon", title: "aşağı", onclick: (e) => { e.preventDefault(); if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; markDirty(); draw(i + 1); } } }, "↓"),
          h("button", { type: "button", class: "icon", title: "sil", onclick: (e) => { e.preventDefault(); if (confirm("Silinsin mi?")) { arr.splice(i, 1); markDirty(); draw(); } } }, "×")
        );
        const body = h("div", { class: "body" }, item.fields.map((f) => renderField(f, v)));
        // keep the summary label in sync while typing
        body.addEventListener("input", () => (sum.querySelector(".t").textContent = item.title?.(v) || `#${i + 1}`));
        return h("details", { open: i === openIndex }, sum, body);
      }),
      h("p", { class: "add" }, h("button", { type: "button", class: "btn ghost", onclick: () => {
        const blank = item.blank ? item.blank() : Object.fromEntries(item.fields.map((f) => [f.key, f.type === "list" ? [] : ""]));
        if (item.prepend) { arr.unshift(blank); markDirty(); draw(0); }
        else { arr.push(blank); markDirty(); draw(arr.length - 1); }
      } }, "+ ekle"))
    );
  };
  draw();
  return box;
}

// drop empty strings / empty arrays so the YAML stays tidy
const tidy = (v) => {
  if (Array.isArray(v)) return v.map(tidy);
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      const t = tidy(x);
      if (t === "" || t === undefined || (Array.isArray(t) && !t.length && k !== "items" && k !== "groups")) continue;
      // bilingual { tr, en }: only Turkish → plain string, both empty → drop
      if (x && typeof x === "object" && !Array.isArray(x) && "tr" in x && Object.keys(x).every((n) => n === "tr" || n === "en")) {
        if (t.en) out[k] = t;
        else if (t.tr) out[k] = t.tr;
        continue;
      }
      out[k] = t;
    }
    return out;
  }
  return v;
};

async function fileView(tab, view) {
  const { value } = await api(`/api/data/${tab.file}`);
  const state = { root: value ?? (tab.root.type === "list" ? [] : {}) };
  dirty = false;
  const save = async () => {
    try {
      await putJson(`/api/data/${tab.file}`, { value: tidy(state.root) });
      dirty = false;
      view.querySelector(".bar .state").replaceChildren(h("span", { class: "muted" }, "kaydedildi ✓"));
      toast(`${tab.file}.yaml kaydedildi`);
    } catch (err) {
      toast(err.message, true);
    }
  };
  const body = tab.root.type === "list" ? renderList(state.root, tab.root.item) : h("div", {}, tab.root.fields.map((f) => renderField(f, state.root)));
  view.replaceChildren(
    h("h1", {}, tab.label),
    h("p", { class: "hint" }, `src/_data/${tab.file}.yaml`, tab.hint ? h("br") : null, tab.hint || ""),
    h("div", { class: "bar" }, h("button", { class: "btn", type: "button", onclick: save }, "kaydet"), h("span", { class: "state muted" }, "ctrl+s")),
    body
  );
  view.onkeydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      save();
    }
  };
}

// ── custom views ────────────────────────────────────────────────
async function settingsView(_tab, view) {
  const s = await api("/api/site");
  const labels = { auto: "otomatik (mevsim)", steppe: "bozkır", spring: "bahar", summer: "yaz", autumn: "güz", winter: "kış", sunset: "istanbul sahili" };
  const save = async (patch) => {
    try {
      await putJson("/api/site", patch);
      toast("site.yaml güncellendi");
    } catch (err) {
      toast(err.message, true);
    }
  };
  view.replaceChildren(
    h("h1", {}, "ayarlar"),
    h("p", { class: "hint" }, "Ana sayfanın arka plan animasyonu. Seçim anında site.yaml'a yazılır."),
    h("div", { class: "scenes" },
      s.scenes.map((sc) =>
        h("label", {},
          h("input", { type: "radio", name: "scene", value: sc, checked: sc === s.scene, onchange: () => save({ scene: sc }) }),
          labels[sc] || sc,
          h("br"),
          h("a", { class: "muted", href: `http://localhost:8080/?scene=${sc === "auto" ? "" : sc}`, target: "_blank", rel: "noopener" }, "önizle ↗")
        )
      )
    ),
    fieldRow("sahne düğmesi", h("label", {}, h("input", { type: "checkbox", checked: s.scenePicker, onchange: (e) => save({ scenePicker: e.target.checked }) }), " ziyaretçi ana sayfada sahneyi değiştirebilsin"))
  );
}

async function goodreadsView(_tab, view) {
  const [{ books = [], importedAt }, hiddenRes] = await Promise.all([api("/api/goodreads"), api("/api/data/books-hidden")]);
  // books-hidden.yaml entries: "id" | { id, title, note }
  const entries = new Map((hiddenRes.value || []).map((h) => (h && typeof h === "object" ? [String(h.id), h] : [String(h), { id: String(h) }])));
  const hidden = { has: (k) => entries.has(String(k)), get size() { return entries.size; } };
  let q = "";
  let shelf = "all";

  const saveHidden = async () => {
    try {
      await putJson("/api/data/books-hidden", { value: [...entries.values()] });
      toast("gizlenenler kaydedildi");
    } catch (err) {
      toast(err.message, true);
    }
  };

  const tbody = h("tbody");
  const draw = () => {
    const needle = q.toLocaleLowerCase("tr");
    tbody.replaceChildren(
      ...books
        .filter((b) => shelf === "all" || (shelf === "hidden" ? hidden.has(b.id) : b.status === shelf))
        .filter((b) => !needle || `${b.title} ${b.author}`.toLocaleLowerCase("tr").includes(needle))
        .map((b) => {
          const off = hidden.has(b.id);
          return h("tr", { class: off ? "off" : null },
            h("td", {}, h("input", { type: "checkbox", checked: !off, title: "sitede göster", onchange: (e) => {
              if (e.target.checked) entries.delete(String(b.id)); else entries.set(String(b.id), { id: b.id, title: b.title });
              saveHidden();
              draw();
            } })),
            h("td", {}, h("a", { href: b.url, target: "_blank", rel: "noopener" }, b.title), h("br"), h("span", { class: "muted" }, b.author, entries.get(String(b.id))?.note ? ` · ${entries.get(String(b.id)).note}` : "")),
            h("td", { class: "muted" }, b.status === "reading" ? "okuyorum" : b.date || "—"),
            h("td", { class: "muted" }, b.rating ? "■".repeat(b.rating) : "")
          );
        })
    );
  };

  const importCsv = async (file) => {
    try {
      const r = await api("/api/goodreads", { method: "POST", headers: { "content-type": "text/csv" }, body: await file.text() });
      toast(`${r.count} kitap içe aktarıldı`);
      goodreadsView(_tab, view);
    } catch (err) {
      toast(err.message, true);
    }
  };

  view.replaceChildren(
    h("h1", {}, "goodreads"),
    h("p", { class: "hint" },
      "Goodreads → My Books → Import and export → Export Library ile indirdiğin CSV'yi yükle. ",
      "Okunan ve okunmakta olan kitaplar alınır; “okunacaklar” rafı atlanır. İşareti kaldırdığın kitaplar books-hidden.yaml'a yazılır ve yeni CSV yüklense de gizli kalır.",
      h("br"),
      h("span", {}, `${books.length} kitap · ${hidden.size} gizli` + (importedAt ? ` · son içe aktarma ${importedAt.slice(0, 10)}` : ""))
    ),
    h("div", { class: "row" },
      h("label", { class: "btn" , style: "cursor:pointer" }, "CSV yükle", h("input", { type: "file", accept: ".csv,text/csv", hidden: true, onchange: (e) => e.target.files[0] && importCsv(e.target.files[0]) })),
      h("input", { type: "search", placeholder: "ara…", oninput: (e) => { q = e.target.value; draw(); } }),
      h("select", { onchange: (e) => { shelf = e.target.value; draw(); } },
        h("option", { value: "all" }, "hepsi"), h("option", { value: "read" }, "okunanlar"), h("option", { value: "reading" }, "okuyorum"), h("option", { value: "hidden" }, "gizlenenler"))
    ),
    h("table", { class: "books" }, h("thead", {}, h("tr", {}, h("th", {}, "göster"), h("th", {}, "kitap"), h("th", {}, "bitiş"), h("th", {}, "puan"))), tbody)
  );
  draw();
}

// ── tabs ────────────────────────────────────────────────────────
const view = document.getElementById("view");
const nav = document.getElementById("tabs");

async function open(id) {
  if (dirty && !confirm("Kaydedilmemiş değişiklikler var. Yine de geçilsin mi?")) return;
  dirty = false;
  const tab = TABS.find((t) => t.id === id) || TABS[0];
  history.replaceState(null, "", `#${tab.id}`);
  nav.querySelectorAll("button").forEach((b) => b.toggleAttribute("aria-current", b.dataset.id === tab.id));
  view.replaceChildren(h("p", { class: "muted" }, "yükleniyor…"));
  try {
    await (tab.custom ? tab.custom(tab, view) : fileView(tab, view));
  } catch (err) {
    view.replaceChildren(h("p", {}, "Hata: " + err.message));
  }
}

nav.append(...TABS.map((t) => h("button", { type: "button", "data-id": t.id, onclick: () => open(t.id) }, t.label)));
window.addEventListener("hashchange", () => { const id = location.hash.slice(1); if (!nav.querySelector(`[data-id="${id}"][aria-current]`)) open(id); });
window.addEventListener("beforeunload", (e) => { if (dirty) e.preventDefault(); });
open(location.hash.slice(1));
