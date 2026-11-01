/*  ASCII background scenes — home page only.
    Scenes: steppe · spring · summer · autumn · winter · sunset
    All drawn with a fine pixel renderer (shading, glow, wind-blown grass,
    weather particles) at 60fps.
    Pick one in src/_data/site.yaml → `scene:` (auto = by season).
    Preview any with ?scene=winter. Everything is drawn on a cell grid:
    each cell is a filled square with a glyph on top, like pixel art made of text.
*/
(() => {
  "use strict";

  const canvas = document.getElementById("scene");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const root = document.documentElement;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const prefersDark = matchMedia("(prefers-color-scheme: dark)");

  const ORDER = ["steppe", "spring", "summer", "autumn", "winter", "sunset"];
  const LABEL = { steppe: "bozkır", spring: "bahar", summer: "yaz", autumn: "güz", winter: "kış", sunset: "sahil" };

  /* ── shared state ─────────────────────────────────────────── */
  let W = 0, H = 0, DPR = 1, CS = 11, COLS = 0, ROWS = 0, narrow = false;
  let t = 0;
  let P = {};             // palette
  let S = null;           // active scene
  let sceneName = "steppe";
  let staticLayer = null;
  const mouse = { x: -1e4, y: -1e4, vx: 0, vy: 0, active: false };

  /* ── utils ────────────────────────────────────────────────── */
  const hash = (x, y) => {
    let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (e0, e1, x) => { const k = clamp((x - e0) / (e1 - e0), 0, 1); return k * k * (3 - 2 * k); };
  const SPIN = ["-", "\\", "|", "/"];
  const spinGlyph = (a) => SPIN[((Math.round(a / (Math.PI / 4)) % 4) + 4) % 4];

  // desktop: keep the text column (left) calm. narrow: full width.
  const sideFade = (x) => (narrow ? 1 : smooth(0.36, 0.62, x / COLS));
  const depthFade = (d) => (narrow ? Math.exp(-d * 0.3) : 1);
  // spawn x biased to the right on desktop
  const spawnX = () => (narrow ? rand(0, W) : W * (1 - Math.pow(Math.random(), 1.4) * 0.75));

  const isDark = () => (root.dataset.theme || (prefersDark.matches ? "dark" : "light")) === "dark";

  function readPalette() {
    const d = isDark();
    const cs = getComputedStyle(root);
    P = {
      dark: d,
      bg: cs.getPropertyValue("--bg").trim() || (d ? "#1b1a18" : "#f2efe8"),
      ground: d ? "#2c2a27" : "#cdc7ba",
      grass: d ? "#4a4741" : "#9b9483",
      figure: d ? "#8e8a81" : "#3a3732",
      skin: d ? "#a9876b" : "#b58e6e",
      sky: d ? "#3b3934" : "#b9b3a6",
      cloud: d ? "#2a2926" : "#e4dfd5",
      orange: "#d0742f",
      ochre: "#d9a441",
      rust: d ? "#b2482a" : "#a8432a",
      sage: d ? "#879a62" : "#7d8f5a",
      green1: d ? "#7f9f55" : "#8fb062",
      green2: d ? "#5d7f46" : "#6a904c",
      green3: d ? "#3f5f35" : "#4c7239",
      bark: d ? "#5e4c3b" : "#7b6650",
      twig: d ? "#75644f" : "#7b6a55",
      pink: d ? "#e091a8" : "#d97a96",
      blossom: d ? "#e8b9c6" : "#e8a6b8",
      red: "#c8402f",
      yellow: "#e6c34a",
      violet: d ? "#9b7fc4" : "#8a6bb8",
      white: d ? "#d9d6cf" : "#fbfaf7",
      rain: d ? "#6f8396" : "#8399ad",
      snow: d ? "#cfd3d6" : "#e1e7ec",
      snowEdge: d ? "#9aa3ab" : "#aab5bf",
      pine: d ? "#3d5a45" : "#4a6b52",
      pineFar: d ? "#2f3a33" : "#a9b5aa",
      sun: "#e6b84a",
    };
  }

  /* ── wind ─────────────────────────────────────────────────── */
  const gust = (time) => 0.55 + 0.45 * Math.sin(time * 0.23) * Math.sin(time * 0.071 + 1.3);
  const wind = (x, y, time) => ({
    x: 1.2 + 2.4 * gust(time - x * 0.004) + 0.5 * Math.sin(y * 0.05 + time * 0.6),
    y: 0.35 * Math.sin(x * 0.03 + time * 0.9) + 0.25 * Math.cos(y * 0.07 - time * 0.5),
  });
  function push(p, r = 120, k = 0.5) {
    if (!mouse.active) return;
    const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
    if (d2 > r * r) return;
    const f = (1 - Math.sqrt(d2) / r) * k;
    p.vx += (dx / r) * f + mouse.vx * 0.04 * f;
    p.vy += (dy / r) * f + mouse.vy * 0.04 * f;
  }

  /* ── drawing primitives ───────────────────────────────────── */
  function setFont(c) {
    c.font = `${Math.round(CS * 0.9)}px ui-monospace, Menlo, Consolas, monospace`;
    c.textAlign = "center";
    c.textBaseline = "middle";
  }

  const scenes = {};

  /* ════════════════════════════════════════════════════════════
     PIXEL RENDERER — the detailed scenes (steppe, forest, avenue, sunset)
     Each grid cell is one "pixel" in a float RGB buffer. A frame is painted
     into the buffer, faded toward the page colour where text lives, pushed to
     a small canvas in one putImageData and scaled up with a thin mosaic grid.
     ════════════════════════════════════════════════════════════ */
  const PXL = { cs: 5, w: 0, h: 0, R: null, G: null, B: null, cv: null, cx: null, img: null, colF: null, rowF: null, grid: null };
  const rgbCache = {};
  const rgb = (hex) => rgbCache[hex] || (rgbCache[hex] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 17, y * 2.1 + 9) * 0.3 + vnoise(x * 4.3 + 41, y * 4.3 + 3) * 0.15;

  function pxLayout() {
    const cs = (PXL.cs = W < 640 ? 4 : 5);
    const w = (PXL.w = Math.ceil(W / cs)), h = (PXL.h = Math.ceil(H / cs));
    PXL.R = new Float32Array(w * h); PXL.G = new Float32Array(w * h); PXL.B = new Float32Array(w * h);
    PXL.cv = document.createElement("canvas"); PXL.cv.width = w; PXL.cv.height = h;
    PXL.cx = PXL.cv.getContext("2d");
    PXL.img = PXL.cx.createImageData(w, h);
    // desktop: calm on the left where the text column is. phones: a band under the nav.
    PXL.colF = Float32Array.from({ length: w }, (_, x) => (narrow ? 1 : smooth(0.33, 0.6, x / w)));
    PXL.rowF = Float32Array.from({ length: h }, (_, y) => (narrow ? smooth(0.13, 0.19, y / h) * (1 - smooth(0.44, 0.5, y / h)) : 1));
    // mosaic grid, drawn once
    const g = (PXL.grid = document.createElement("canvas"));
    g.width = canvas.width; g.height = canvas.height;
    const gc = g.getContext("2d");
    gc.scale(DPR, DPR);
    gc.fillStyle = P.bg;
    gc.globalAlpha = 0.5;
    const gap = cs >= 5 ? 1 : 0.75;
    for (let x = 0; x <= w; x++) gc.fillRect(x * cs - gap / 2, 0, gap, H);
    for (let y = 0; y <= h; y++) gc.fillRect(0, y * cs - gap / 2, W, gap);
  }
  const visible = (x, y) => PXL.colF[x] * PXL.rowF[y] > 0.01;
  function put(x, y, c, a = 1) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= PXL.w || y >= PXL.h || a <= 0) return;
    const i = y * PXL.w + x;
    if (a >= 1) { PXL.R[i] = c[0]; PXL.G[i] = c[1]; PXL.B[i] = c[2]; return; }
    PXL.R[i] += (c[0] - PXL.R[i]) * a; PXL.G[i] += (c[1] - PXL.G[i]) * a; PXL.B[i] += (c[2] - PXL.B[i]) * a;
  }
  function pxClear(c) { PXL.R.fill(c[0]); PXL.G.fill(c[1]); PXL.B.fill(c[2]); }
  // soft-edged disc; shade(dx, dy, r) may return a colour per pixel
  function disc(cx, cy, r, c, a = 1, shade) {
    const r2 = (r + 0.5) * (r + 0.5);
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      if (y < 0 || y >= PXL.h) continue;
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x < 0 || x >= PXL.w || !visible(x, y)) continue;
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        put(x, y, shade ? shade(dx, dy, r) : c, a * clamp(r + 0.5 - Math.sqrt(d2), 0, 1));
      }
    }
  }
  // radial glow with a smooth falloff
  function glow(cx, cy, R, c, amax) {
    for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / R;
      if (d < 1) put(x, y, c, amax * (1 - d) * (1 - d));
    }
  }
  // thick line as a chain of discs
  function stroke(x0, y0, x1, y1, wd, c, a = 1) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) disc(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, wd / 2, c, a);
  }
  function rectF(x0, y0, x1, y1, c, a = 1) {
    for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) put(x, y, c, a);
  }
  function pxFlush() {
    const { w, h, R, G, B, colF, rowF } = PXL, d = PXL.img.data, bg = rgb(P.bg);
    for (let y = 0, i = 0; y < h; y++) {
      const rf = rowF[y];
      for (let x = 0; x < w; x++, i++) {
        const f = colF[x] * rf, j = i * 4;
        d[j] = bg[0] + (R[i] - bg[0]) * f; d[j + 1] = bg[1] + (G[i] - bg[1]) * f; d[j + 2] = bg[2] + (B[i] - bg[2]) * f; d[j + 3] = 255;
      }
    }
    PXL.cx.putImageData(PXL.img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(PXL.cv, 0, 0, w * PXL.cs * DPR, h * PXL.cs * DPR);
    ctx.drawImage(PXL.grid, 0, 0);
  }
  // cache / restore a painted static layer
  const snap = () => [PXL.R.slice(), PXL.G.slice(), PXL.B.slice()];
  const restore = (s) => { PXL.R.set(s[0]); PXL.G.set(s[1]); PXL.B.set(s[2]); };

  // palette for the detailed scenes
  function PAL() {
    const d = P.dark;
    return d ? {
      bg: rgb(P.bg),
      skyTop: [30, 30, 33], skyHor: [78, 66, 56], cloud: [92, 84, 76], sun: [236, 196, 120],
      far: [56, 60, 66], mid: [66, 70, 54], near: [86, 80, 50], soil: [62, 54, 40],
      grassA: [58, 66, 38], grassB: [138, 128, 68], grassTip: [204, 182, 104],
      jacket: [62, 66, 74], jacketLit: [132, 116, 92], pants: [46, 46, 52], hair: [34, 28, 24], skin: [170, 128, 98], scarf: [204, 104, 48],
      pack: [178, 92, 44], packLit: [222, 140, 76], boot: [58, 44, 34],
      bark: [48, 40, 33], barkLit: [104, 86, 64], leafD: [30, 46, 32], leafM: [52, 80, 46], leafL: [104, 134, 66], leafH: [190, 170, 92],
      fogTop: [36, 44, 40], fogLow: [58, 66, 56], beam: [236, 208, 140], path: [74, 64, 52], pathLit: [118, 102, 78], litter: [150, 96, 50],
      road: [72, 66, 58], roadLit: [138, 120, 90], shadow: [34, 34, 32],
      blossom: [226, 160, 180], blossomD: [160, 96, 120], rust: [178, 72, 42], leafOrange: [214, 128, 52], umbrella: [178, 64, 52], scarfSpring: [120, 150, 200], ochreRGB: [214, 164, 66], pine: [44, 74, 58], pineLit: [80, 112, 88], hat: [168, 58, 48], snow: [210, 214, 220],
      dusk: [[34, 32, 52], [74, 50, 74], [150, 74, 70], [214, 120, 64], [238, 178, 92]],
      silh: [30, 28, 34], silhLit: [70, 50, 52], sea: [30, 36, 50], seaHi: [70, 76, 98], glitter: [255, 214, 140], stone: [40, 36, 34], white: [214, 210, 202],
    } : {
      bg: rgb(P.bg),
      skyTop: [240, 237, 230], skyHor: [232, 214, 186], cloud: [250, 247, 240], sun: [236, 180, 96],
      far: [176, 182, 184], mid: [160, 164, 120], near: [190, 172, 112], soil: [168, 146, 104],
      grassA: [120, 132, 72], grassB: [186, 166, 92], grassTip: [222, 198, 124],
      jacket: [72, 78, 90], jacketLit: [176, 146, 110], pants: [60, 60, 66], hair: [52, 42, 34], skin: [196, 150, 116], scarf: [206, 96, 44],
      pack: [196, 104, 50], packLit: [232, 152, 88], boot: [84, 64, 48],
      bark: [104, 86, 68], barkLit: [164, 138, 106], leafD: [78, 110, 66], leafM: [112, 150, 82], leafL: [164, 192, 108], leafH: [226, 206, 128],
      fogTop: [214, 222, 206], fogLow: [196, 204, 184], beam: [255, 238, 190], path: [196, 178, 146], pathLit: [228, 212, 180], litter: [196, 128, 70],
      road: [196, 184, 162], roadLit: [232, 220, 196], shadow: [150, 146, 128],
      blossom: [236, 168, 188], blossomD: [204, 120, 146], rust: [176, 72, 44], leafOrange: [222, 136, 60], umbrella: [190, 70, 56], scarfSpring: [90, 130, 190], ochreRGB: [214, 164, 66], pine: [70, 104, 84], pineLit: [110, 146, 118], hat: [180, 60, 50], snow: [255, 255, 255],
      dusk: [[196, 196, 222], [216, 180, 200], [236, 168, 150], [242, 160, 104], [248, 204, 128]],
      silh: [96, 84, 96], silhLit: [150, 112, 104], sea: [142, 156, 182], seaHi: [196, 204, 220], glitter: [255, 226, 160], stone: [120, 110, 102], white: [252, 250, 244],
    };
  }

  // seated, seen from behind (steppe, sunset). o: { scarf, wind }
  function sitter(cx, groundY, Hc, C, o = {}) {
    const s = Hc / 100;
    const top = groundY - 70 * s;
    // coat: a soft trapezoid, lit on the right edge
    for (let y = top + 22 * s; y < groundY; y++) {
      const k = (y - (top + 22 * s)) / (groundY - top - 22 * s), half = (16 + k * 12) * s;
      for (let x = cx - half; x < cx + half; x++) {
        const e = (x - cx) / half;
        put(x, y, mix(C.jacket, C.jacketLit, clamp((e - 0.55) * 2.2, 0, 1) * 0.8));
      }
    }
    // shoulders round
    disc(cx - 10 * s, top + 26 * s, 7 * s, C.jacket);
    disc(cx + 10 * s, top + 26 * s, 7 * s, C.jacket, 1, (dx, dy, r) => mix(C.jacket, C.jacketLit, clamp(dx / r, 0, 1) * 0.6));
    // neck, scarf, head
    rectF(cx - 4 * s, top + 14 * s, cx + 4 * s, top + 22 * s, C.skin);
    if (o.scarf) {
      rectF(cx - 9 * s, top + 18 * s, cx + 9 * s, top + 23 * s, o.scarf);
      const g = o.wind ?? 0.5;
      for (let i = 0; i < 22; i++) {
        const k = i / 22, x = cx + 7 * s + i * 1.1 * s * (0.6 + g * 0.6), y = top + 21 * s + Math.sin(t * 5.5 - i * 0.55) * k * 3.2 * s + k * (1 - g) * 10 * s;
        disc(x, y, (2.6 - k * 1.2) * s, o.scarf, 1 - k * 0.3);
      }
    }
    disc(cx - 9 * s, top + 10 * s, 2 * s, C.skin);
    disc(cx + 9 * s, top + 10 * s, 2 * s, C.skin);
    disc(cx, top + 8 * s, 9 * s, C.hair, 1, (dx, dy, r) => mix(C.hair, C.jacketLit, clamp(dx / r, 0, 1) * clamp(-dy / r + 0.4, 0, 1) * 0.5));
  }

  /* ════════════════════════════════════════════════════════════
     LANDSCAPES — steppe and the four seasons share one close-up meadow:
     sky, sun, clouds, three ridges, a tree, someone sitting on the near
     hill seen from behind, wind-blown grass and season particles.
     ════════════════════════════════════════════════════════════ */
  const SEASON = {
    steppe: (d) => ({}),
    spring: (d) => d
      ? { skyTop: [30, 34, 40], skyHor: [70, 76, 84], sun: [236, 214, 160], far: [58, 66, 74], mid: [58, 80, 56], near: [70, 96, 58], soil: [52, 62, 40], grassA: [56, 92, 48], grassB: [96, 136, 64], grassTip: [160, 192, 104], cloud: [96, 100, 108] }
      : { skyTop: [236, 240, 242], skyHor: [214, 228, 228], sun: [250, 226, 160], far: [178, 192, 196], mid: [150, 182, 130], near: [140, 176, 104], soil: [120, 150, 90], grassA: [96, 150, 76], grassB: [134, 182, 92], grassTip: [196, 222, 140], cloud: [252, 252, 250] },
    summer: (d) => d
      ? { skyTop: [28, 34, 44], skyHor: [64, 76, 86], sun: [248, 222, 150], far: [56, 66, 76], mid: [54, 76, 48], near: [66, 88, 46], soil: [58, 64, 38], grassA: [52, 84, 40], grassB: [104, 128, 56], grassTip: [178, 186, 96], cloud: [104, 112, 120] }
      : { skyTop: [226, 236, 242], skyHor: [222, 230, 220], sun: [255, 230, 150], far: [170, 186, 196], mid: [128, 164, 104], near: [150, 170, 92], soil: [130, 140, 80], grassA: [92, 140, 64], grassB: [160, 176, 88], grassTip: [222, 214, 130], cloud: [255, 255, 255] },
    autumn: (d) => d
      ? { skyTop: [34, 34, 36], skyHor: [62, 62, 62], sun: [120, 116, 108], far: [54, 56, 60], mid: [72, 62, 48], near: [86, 66, 44], soil: [64, 48, 36], grassA: [88, 66, 40], grassB: [150, 96, 50], grassTip: [196, 132, 66], cloud: [70, 70, 72] }
      : { skyTop: [214, 214, 212], skyHor: [200, 196, 188], sun: [230, 220, 200], far: [168, 170, 172], mid: [176, 150, 110], near: [184, 140, 90], soil: [150, 112, 76], grassA: [150, 112, 66], grassB: [196, 140, 74], grassTip: [226, 170, 96], cloud: [232, 230, 226] },
    winter: (d) => d
      ? { skyTop: [32, 34, 40], skyHor: [72, 78, 88], sun: [200, 204, 210], far: [96, 104, 116], mid: [150, 158, 168], near: [190, 196, 204], soil: [160, 168, 178], grassA: [110, 106, 98], grassB: [134, 126, 110], grassTip: [170, 164, 150], cloud: [84, 88, 96], snow: [214, 220, 228] }
      : { skyTop: [226, 230, 236], skyHor: [236, 238, 240], sun: [255, 248, 232], far: [196, 206, 216], mid: [216, 224, 232], near: [240, 244, 248], soil: [226, 232, 240], grassA: [150, 142, 124], grassB: [170, 160, 140], grassTip: [196, 188, 172], cloud: [246, 248, 250], snow: [255, 255, 255] },
  };

  function landscape(name, cfg) {
    let C, w, h, hy, ridges, blades = [], parts = [], flies = [], birds = [], splashes = [], base, fig, s;
    const sitH = () => (narrow ? 22 : 46);
    const spawnPart = (p, initial) => {
      if (p === "seed") return { x: initial ? rand(0, w) : rand(-20, w * 0.4), y: rand(h * 0.1, h * 0.8), vx: rand(0.15, 0.35), vy: 0, ph: rand(0, 6.28) };
      if (p === "petal") return { x: initial ? rand(w * 0.4, w) : rand(w * 0.55, w + 20), y: initial ? rand(0, h) : rand(-20, h * 0.3), vx: rand(-0.05, 0.15), vy: rand(0.08, 0.18), ph: rand(0, 6.28), c: Math.random() };
      if (p === "leaf") return { x: initial ? rand(w * 0.35, w) : rand(w * 0.45, w + 30), y: initial ? rand(0, h) : rand(-30, -2), vx: rand(-0.05, 0.25), vy: rand(0.12, 0.25), ph: rand(0, 6.28), c: Math.random(), spin: rand(0, 6) };
      if (p === "snow") { const z = Math.random(); return { x: rand(0, w), y: initial ? rand(0, h) : rand(-10, -1), vx: 0, vy: 0.06 + z * 0.22, z, ph: rand(0, 6.28) }; }
      if (p === "rain") return { x: rand(-10, w + 20), y: initial ? rand(0, h) : rand(-20, -1), vy: rand(1.4, 2.1), z: Math.random() };
    };
    const counts = { seed: [8, 18], petal: [14, 34], leaf: [10, 26], snow: [90, 260], rain: [70, 200] };
    return {
      pixel: true,
      init() {
        C = { ...PAL(), ...SEASON[name](P.dark) };
        ({ w, h } = PXL);
        s = narrow ? 0.5 : 1;
        hy = Math.round(h * (narrow ? 0.28 : 0.5));
        const amp = narrow ? 7 : 16;
        ridges = [0, 1, 2].map((i) => Float32Array.from({ length: w + 2 }, (_, x) => hy + i * (narrow ? 5 : 11) - fbm(x * 0.011 + i * 7.3, i * 3.1) * amp * (1 - i * 0.3) - (i === 2 ? Math.exp(-(((x - w * 0.74) / (w * 0.16)) ** 2)) * amp * 0.7 : 0)));
        fig = { x: Math.round(w * (narrow ? 0.62 : 0.74)) };
        fig.y = Math.round(ridges[2][fig.x]) + 2;
        // grass, rooted on the near slope, taller toward the viewer
        blades = [];
        const bottom = narrow ? Math.round(h * 0.5) : h, g = cfg.grass;
        for (let x = 0; x < w; x += 0.5) {
          const r = ridges[2][Math.floor(x)];
          for (let k = 0; k < 2; k++) {
            if (Math.random() > g.density) continue;
            const y = r + Math.pow(Math.random(), 1.4) * (bottom - r);
            const depth = (y - r) / (bottom - r + 1);
            const flower = g.flowers && Math.random() < g.flowers ? pick(g.flowerColors) : null;
            blades.push({ x: x + rand(-0.4, 0.4), y, len: (2 + depth * (narrow ? 12 : 30) * g.height) * rand(0.55, 1), tint: Math.random(), lean: rand(-0.3, 0.3), depth, flower });
          }
        }
        blades.sort((a, b) => a.y - b.y);
        parts = [cfg.particle, cfg.extraParticles].filter(Boolean).flatMap((type) => Array.from({ length: counts[type][narrow ? 0 : 1] }, () => ({ ...spawnPart(type, true), p: type })));
        flies = cfg.butterflies ? Array.from({ length: narrow ? 2 : 4 }, () => ({ x: rand(w * 0.5, w), y: rand(hy, h * 0.8), vx: 0, vy: 0, ph: rand(0, 6), c: pick(cfg.butterflies) })) : [];
        birds = []; splashes = [];

        // ── static layer: sky, sun, ridges, tree
        pxClear(C.bg);
        for (let y = 0; y < h; y++) {
          const k = Math.pow(clamp(y / hy, 0, 1), 1.6);
          for (let x = 0; x < w; x++) put(x, y, mix(C.skyTop, C.skyHor, k));
        }
        if (cfg.sun) {
          const [fx, fy, r, a] = cfg.sun;
          const sx = w * (narrow ? 0.3 : fx), sy = h * (narrow ? 0.18 : fy);
          glow(sx, sy, (narrow ? 40 : 80) * r, C.sun, a);
          disc(sx, sy, (narrow ? 4 : 7) * r, mix(C.sun, C.cloud, 0.35), 0.95);
        }
        const layer = [C.far, C.mid, C.near];
        ridges.forEach((rg, i) => {
          for (let x = 0; x < w; x++) for (let y = Math.floor(rg[x]); y < h; y++) {
            const n = fbm(x * 0.05 + i * 9, y * 0.12);
            const c = mix(layer[i], i === 2 ? C.soil : C.skyHor, i === 2 ? clamp((y - rg[x]) / 60, 0, 0.5) : 0.15 + (2 - i) * 0.1);
            put(x, y, mix(c, cfg.snowy ? C.snow : C.grassTip, (n - 0.5) * (i === 2 ? 0.5 : 0.25) + (cfg.snowy && i === 2 && y - rg[x] < 2 ? 0.6 : 0)));
          }
        });
        cfg.tree?.(C, ridges, w, h, s);
        base = snap();
      },
      step(dt) {
        const g = gust(t);
        for (const q of parts) {
          const p = q.p;
          if (p === "seed") {
            q.vx += ((0.25 + g * 0.5) - q.vx) * 0.02 * dt;
            q.vy += (Math.sin(t * 1.3 + q.ph) * 0.06 - q.vy) * 0.03 * dt;
          } else if (p === "petal" || p === "leaf") {
            q.vx += ((g - 0.3) * 0.35 + Math.sin(t * 1.6 + q.ph) * 0.2 - q.vx) * 0.03 * dt;
            q.spin = (q.spin || 0) + 0.08 * dt;
          } else if (p === "snow") {
            q.vx = Math.sin(t * 0.8 + q.ph) * 0.08 * (0.5 + q.z) + (g - 0.4) * 0.12;
          } else if (p === "rain") {
            q.vx = 0.35 + g * 0.3;
          }
          if (p !== "rain") {
            const m = { x: q.x * PXL.cs, y: q.y * PXL.cs, vx: q.vx * PXL.cs, vy: q.vy * PXL.cs };
            push(m, 120, 0.35);
            q.vx = m.vx / PXL.cs; q.vy = p === "seed" ? m.vy / PXL.cs : q.vy;
          }
          q.x += q.vx * dt; q.y += q.vy * dt;
          if (p === "rain" && q.y > (narrow ? h * 0.5 : h) - rand(0, h * 0.3) && Math.random() < 0.3) {
            splashes.push({ x: q.x, y: q.y, a: 1 });
            Object.assign(q, spawnPart(p, false));
          }
          if (q.x > w + 30 || q.x < -40 || q.y > h + 5 || q.y < -60) Object.assign(q, spawnPart(p, false));
        }
        for (let i = splashes.length - 1; i >= 0; i--) { splashes[i].a -= 0.08 * dt; if (splashes[i].a <= 0) splashes.splice(i, 1); }
        for (const f of flies) {
          const tx = w * 0.62 + Math.sin(t * 0.21 + f.ph) * w * 0.22, ty = hy + (h - hy) * 0.35 + Math.cos(t * 0.33 + f.ph) * h * 0.12;
          f.vx += ((tx - f.x) * 0.002 + Math.sin(t * 3 + f.ph) * 0.04 - f.vx * 0.02) * dt;
          f.vy += ((ty - f.y) * 0.002 + Math.cos(t * 2.3 + f.ph) * 0.05 - f.vy * 0.02) * dt;
          f.x += f.vx * dt; f.y += f.vy * dt;
        }
        if (cfg.birds && Math.random() < 0.002 * dt && birds.length < 2) birds.push({ x: -10, y: rand(h * 0.1, hy - 20), v: rand(0.25, 0.4), n: 2 + ((Math.random() * 3) | 0), ph: rand(0, 6) });
        for (let i = birds.length - 1; i >= 0; i--) { birds[i].x += birds[i].v * dt; if (birds[i].x > w + 20) birds.splice(i, 1); }
      },
      render() {
        restore(base);
        // clouds drift
        const ct = cfg.clouds ?? 0.6;
        for (let y = Math.floor(h * 0.04); y < hy - 4; y++) for (let x = Math.floor(w * 0.3); x < w; x++) {
          const n = fbm((x + t * 1.2) * 0.018, y * 0.07);
          if (n > ct) put(x, y, C.cloud, Math.min(0.9, (n - ct) * 2.6));
        }
        for (const b of birds) for (let i = 0; i < b.n; i++) {
          const bx = b.x - i * 7, by = b.y + (i % 2) * 3, f = Math.sin(t * 9 + b.ph + i) * 1.5;
          stroke(bx - 3, by - f, bx, by, 1, C.hair, 0.8); stroke(bx, by, bx + 3, by - f, 1, C.hair, 0.8);
        }
        // far snow/rain behind the figure
        const drawParts = (front) => {
          for (const q of parts) {
            const p = q.p;
            if (p === "snow") {
              if ((q.z > 0.55) !== front) continue;
              const r = 0.4 + q.z * (narrow ? 0.8 : 1.4);
              if (r > 1) disc(q.x, q.y, r, C.snow, 0.6 + q.z * 0.4); else put(q.x, q.y, C.snow, 0.5 + q.z * 0.5);
            } else if (p === "rain") {
              if ((q.z > 0.6) !== front) continue;
              const len = 3 + q.z * 5;
              for (let i = 0; i < len; i++) put(q.x - q.vx * i * 0.5, q.y - i, C.seaHi || C.cloud, (0.25 + q.z * 0.4) * (1 - i / len));
            } else if (front) {
              if (p === "seed") { put(q.x, q.y, C.cloud, 0.9); put(q.x - 1, q.y, C.grassTip, 0.4); }
              else {
                const flip = Math.sin(q.spin || q.ph + t * 3);
                const col = p === "petal" ? (q.c < 0.6 ? C.blossom : C.white) : q.c < 0.4 ? C.rust : q.c < 0.75 ? C.leafOrange : C.leafH;
                put(q.x, q.y, col); if (Math.abs(flip) > 0.3) put(q.x + (flip > 0 ? 1 : -1), q.y, col, 0.8);
                if (p === "leaf" && !narrow) put(q.x, q.y + 1, col, 0.6);
              }
            }
          }
        };
        drawParts(false);
        const g = gust(t);
        const bend = (b, k) => {
          const wave = 0.5 + 0.5 * Math.sin(b.x * 0.06 - t * 2.2 + b.y * 0.02);
          return (b.lean + (0.25 + g * 0.9) * (0.4 + wave * 0.8) * (cfg.grass.stiff ?? 1) + Math.sin(t * 3 + b.x) * 0.06) * k * k * b.len;
        };
        const figure = () => cfg.figure(fig.x, fig.y, sitH(), C, g);
        let drew = false;
        for (const b of blades) {
          if (!drew && b.y > fig.y - 1) { figure(); drew = true; }
          const x0 = Math.floor(b.x);
          if (x0 < 0 || x0 >= w || PXL.colF[x0] < 0.02) continue;
          const n = Math.ceil(b.len);
          for (let i = 0; i <= n; i++) {
            const k = i / n;
            put(b.x + bend(b, k), b.y - k * b.len, mix(b.tint < 0.5 ? C.grassA : C.grassB, C.grassTip, k * (0.4 + b.tint * 0.6)), 0.55 + b.depth * 0.45);
          }
          if (b.flower) {
            const fx = b.x + bend(b, 1), fy = b.y - b.len, r = 0.6 + b.depth * (narrow ? 0.8 : 1.6);
            if (r > 1) disc(fx, fy, r, b.flower); else put(fx, fy, b.flower);
          }
        }
        if (!drew) figure();
        for (const f of flies) {
          const flap = Math.sin(t * 14 + f.ph) > 0, sz = narrow ? 1 : 2;
          put(f.x, f.y, C.hair);
          for (let i = 1; i <= sz; i++) { put(f.x - i, f.y - (flap ? i : 0), f.c); put(f.x + i, f.y - (flap ? i : 0), f.c); }
        }
        for (const sp of splashes) { put(sp.x - 1, sp.y, C.cloud, sp.a * 0.5); put(sp.x + 1, sp.y, C.cloud, sp.a * 0.5); put(sp.x, sp.y - 1, C.cloud, sp.a * 0.4); }
        drawParts(true);
      },
    };
  }

  // trees
  const treeAt = (ridges, w, fx) => { const x = Math.round(w * (narrow ? Math.min(0.9, fx) : fx)); return { x, y: Math.round(ridges[1][x]) }; };
  function canopy(cx, cy, rx, ry, n, cols, seed) {
    for (let i = 0; i < n; i++) {
      const bx = cx + (hash(i, seed) - 0.5) * rx * 2, by = cy - hash(i, seed + 1) * ry, r = (0.25 + hash(i, seed + 2) * 0.25) * rx;
      disc(bx, by, r, null, 1, (dx, dy, rr) => {
        const lit = clamp(0.55 - (dy / rr) * 0.45 + (dx / rr) * 0.2 + (hash(Math.floor(bx + dx), Math.floor(by + dy)) - 0.5) * 0.4, 0, 1);
        return lit > 0.93 ? cols[2] : mix(cols[0], cols[1], lit);
      });
    }
  }
  function branchy(x, y, len, ang, depth, wd, col, tips) {
    const x1 = x + Math.sin(ang) * len, y1 = y - Math.cos(ang) * len;
    stroke(x, y, x1, y1, wd, col);
    if (depth === 0) { tips?.(x1, y1); return; }
    branchy(x1, y1, len * 0.72, ang - 0.45 - hash(depth, Math.round(x)) * 0.2, depth - 1, Math.max(1, wd * 0.65), col, tips);
    branchy(x1, y1, len * 0.7, ang + 0.4 + hash(Math.round(y), depth) * 0.2, depth - 1, Math.max(1, wd * 0.65), col, tips);
  }

  const sitWith = (extra) => (x, y, H, C, g) => {
    if (extra.umbrella) {
      const s = H / 100, ux = x + 2 * s, uy = y - 92 * s, R = 34 * s, sway = Math.sin(t * 0.9) * 1.5 * s;
      stroke(ux, uy, x + 6 * s, y - 40 * s, 1.6 * s + 0.6, C.hair);
      for (let dy = 0; dy <= R * 0.5; dy++) {
        const half = Math.sqrt(Math.max(0, R * R - (R - dy * 2) ** 2)) * 0.55 + dy * 0.6;
        for (let dx = -half; dx <= half; dx++) {
          const seg = Math.floor(((dx + half) / (2 * half + 1)) * 6);
          put(ux + dx + sway * (1 - dy / R), uy + dy - R * 0.08, mix(C.umbrella, C.white, seg % 2 ? 0.0 : 0.12 + (dy / R) * 0.2));
        }
      }
      put(ux + sway, uy - R * 0.08 - 2, C.hair);
    }
    sitter(x, y, H, C, { scarf: extra.scarf?.(C), wind: g });
    if (extra.hat) {
      const s = H / 100;
      disc(x, y - 66 * s, 9.6 * s, extra.hat(C), 1, (dx, dy, r) => (dy > 3 * s ? C.hair : mix(extra.hat(C), C.white, clamp(dx / r, 0, 1) * 0.25)));
      rectF(x - 9.6 * s, y - 64 * s, x + 9.6 * s, y - 61 * s, mix(extra.hat(C), C.white, 0.3));
      disc(x, y - 77 * s, 3 * s, C.white);
      // breath on cold air
      const ph = (t * 0.5) % 1;
      if (ph < 0.6) disc(x + 14 * s + ph * 10 * s, y - 60 * s - ph * 6 * s, (2 + ph * 5) * s, C.snow, (0.6 - ph) * 0.6);
    }
  };

  scenes.steppe = landscape("steppe", {
    sun: [0.86, 0.22, 1, 0.45], clouds: 0.6, particle: "seed", birds: true,
    grass: { density: 1, height: 1 },
    tree: (C, R, w, h, s) => {
      const tr = treeAt(R, w, 0.9);
      stroke(tr.x, tr.y + 2, tr.x + 1, tr.y - 16 * s, 2.5 * s, C.bark);
      for (let i = 0; i < 14; i++) disc(tr.x + (hash(i, 1) - 0.5) * 18 * s, tr.y - 18 * s - hash(i, 2) * 10 * s, (3 + hash(i, 3) * 4) * s, mix(C.mid, C.leafD, 0.4 + hash(i, 4) * 0.4));
    },
    figure: sitWith({ scarf: (C) => C.scarf }),
  });

  scenes.spring = landscape("spring", {
    sun: [0.82, 0.18, 0.9, 0.35], clouds: 0.62, particle: "petal", birds: true,
    grass: { density: 0.9, height: 0.75, flowers: 0.05, get flowerColors() { return P.dark ? [[214, 90, 96], [236, 232, 220], [230, 196, 90], [176, 140, 210]] : [[214, 70, 80], [255, 255, 250], [236, 196, 70], [160, 120, 200]]; } },
    butterflies: [[236, 220, 120], [240, 240, 236], [222, 150, 90]],
    tree: (C, R, w, h, s) => {
      const tr = treeAt(R, w, 0.88);
      branchy(tr.x, tr.y + 2, 14 * s, 0.05, 3, 3 * s, C.bark);
      canopy(tr.x, tr.y - 24 * s, 16 * s, 14 * s, 26, [C.blossomD, C.blossom, C.white], 31);
    },
    figure: sitWith({ scarf: (C) => C.scarfSpring }),
  });

  scenes.summer = landscape("summer", {
    sun: [0.9, 0.12, 1.2, 0.55], clouds: 0.64, particle: "seed", birds: true,
    grass: { density: 1, height: 1.1, flowers: 0.015, flowerColors: [[236, 210, 90], [250, 250, 244]] },
    butterflies: [[240, 240, 236], [236, 200, 90]],
    tree: (C, R, w, h, s) => {
      const tr = treeAt(R, w, 0.88);
      stroke(tr.x, tr.y + 4, tr.x - 1, tr.y - 22 * s, 5 * s, C.bark);
      stroke(tr.x, tr.y - 14 * s, tr.x - 10 * s, tr.y - 26 * s, 2.5 * s, C.bark);
      stroke(tr.x, tr.y - 16 * s, tr.x + 12 * s, tr.y - 28 * s, 2.5 * s, C.bark);
      canopy(tr.x, tr.y - 30 * s, 26 * s, 20 * s, 34, [C.leafD, C.leafL, C.leafH], 57);
    },
    figure: sitWith({ scarf: (C) => C.ochreRGB }),
  });

  scenes.autumn = landscape("autumn", {
    sun: null, clouds: 0.42, particle: "rain",
    grass: { density: 0.85, height: 0.85 },
    tree: (C, R, w, h, s) => {
      const tr = treeAt(R, w, 0.88);
      branchy(tr.x, tr.y + 2, 16 * s, 0, 4, 3.5 * s, C.bark, (x, y) => { if (hash(Math.round(x), Math.round(y)) < 0.5) disc(x, y, 1.6 * s, hash(Math.round(y), 3) < 0.5 ? C.leafOrange : C.rust); });
    },
    figure: sitWith({ scarf: (C) => C.scarf, umbrella: true }),
    extraParticles: "leaf",
  });

  scenes.winter = landscape("winter", {
    sun: [0.8, 0.2, 0.8, 0.25], clouds: 0.5, particle: "snow", snowy: true,
    grass: { density: 0.07, height: 0.28, stiff: 0.25 },
    tree: (C, R, w, h, s) => {
      for (const [fx, sc] of [[0.84, 1], [0.9, 1.3], [0.96, 0.9], [0.7, 0.6]]) {
        const tr = treeAt(R, w, fx), H = 30 * s * sc;
        for (let r = 0; r < H; r++) {
          const k = r / H, half = (2 + k * 9) * s * sc * (0.75 + 0.25 * Math.sin(r * 0.9));
          for (let dx = -half; dx <= half; dx++) {
            const tier = (r % 6) / 6, n = hash(Math.round(tr.x + dx), Math.round(tr.y - H + r));
            const snowy = (tier < 0.25 && n < 0.7) || (dx < -half * 0.3 && n < 0.18);
            put(tr.x + dx, tr.y - H + r, snowy ? mix(C.snow, C.pineLit, n * 0.3) : mix(C.pine, C.pineLit, clamp(dx / half, 0, 1) * 0.5 + (n - 0.5) * 0.2));
          }
        }
        rectF(tr.x - 1.2 * s * sc, tr.y, tr.x + 1.2 * s * sc, tr.y + 3 * s, C.bark);
      }
    },
    figure: sitWith({ scarf: (C) => C.scarf, hat: (C) => C.hat }),
  });

  /* ── 8. sunset · istanbul sahili ──────────────────────────── */
  scenes.sunset = (() => {
    let C, w, h, hy, qy, sun, base, gulls = [], ferry, smoke = [], lights = [], fig, cat;
    const makeGull = (initial) => ({ x: initial ? rand(w * 0.4, w) : w + rand(5, 40), y: rand(h * (narrow ? 0.14 : 0.1), hy - (narrow ? 10 : 30)), v: rand(0.12, 0.3), ph: rand(0, 6), sz: rand(2.5, narrow ? 4 : 6) });
    return {
      pixel: true,
      init() {
        C = PAL(); ({ w, h } = PXL);
        hy = Math.round(h * (narrow ? 0.33 : 0.62));
        qy = Math.round(h * (narrow ? 0.47 : 0.9));
        sun = { x: w * (narrow ? 0.56 : 0.74), y: hy - (narrow ? 5 : 9), r: narrow ? 6 : 11 };
        pxClear(C.bg);
        // sky: dusk gradient, streaky clouds lit from below
        const D = C.dusk;
        for (let y = 0; y < hy; y++) {
          const k = Math.pow(y / hy, 0.9) * (D.length - 1), i = Math.min(D.length - 2, Math.floor(k));
          const row = mix(D[i], D[i + 1], k - i);
          for (let x = 0; x < w; x++) {
            const glow = Math.exp(-(((x - sun.x) / (w * 0.25)) ** 2 + ((y - sun.y) / (h * 0.25)) ** 2));
            let c = mix(row, D[4], glow * 0.55);
            const n = fbm(x * 0.012, y * 0.22);
            if (y < hy - 4 && n > 0.56) c = mix(c, mix(D[1], D[3], y / hy), clamp((n - 0.56) * 4, 0, 0.7));
            put(x, y, c);
          }
        }
        glow(sun.x, sun.y, sun.r * 5, C.sun, 0.35);
        disc(sun.x, sun.y, sun.r, mix(C.sun, C.white, 0.35));
        // the far shore: city line, Süleymaniye-like mosque, a smaller one, Galata-like tower
        const s = narrow ? 0.55 : 1, sil = [];
        const add = (x, y) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < w && y >= 0) sil.push(x * 10000 + y); };
        const fillCol = (x, y0) => { for (let y = Math.round(y0); y <= hy; y++) add(x, y); };
        for (let x = Math.round(w * (narrow ? 0 : 0.45)); x < w; x++) fillCol(x, hy - 2 - fbm(x * 0.08, 3) * 6 * s - (hash(x >> 2, 7) < 0.3 ? 2 : 0));
        const dome = (cx, r, y0) => { for (let dx = -r; dx <= r; dx++) fillCol(cx + dx, y0 - Math.sqrt(r * r - dx * dx) * 0.85); for (let y = 0; y < 3 * s; y++) add(cx, y0 - r * 0.85 - y); };
        const minaret = (x, hgt) => {
          for (let y = 0; y < hgt; y++) { add(x, hy - y); add(x + 1, hy - y); }
          for (const f of [0.55, 0.78]) for (let dx = -1; dx <= 2; dx++) add(x + dx, hy - hgt * f);
          for (let i = 0; i < 6 * s; i++) add(x + (i < 3 * s ? 0 : 0.5), hy - hgt - i);
        };
        const mosque = (cx, R) => {
          const base = hy - 6 * s;
          for (let x = cx - R * 2.6; x < cx + R * 2.6; x++) fillCol(x, base - 2 * s);
          dome(cx - R * 1.4, R * 0.55, base - 2 * s); dome(cx + R * 1.4, R * 0.55, base - 2 * s);
          dome(cx, R, base - 4 * s);
          minaret(Math.round(cx - R * 2.9), R * 3.2); minaret(Math.round(cx + R * 2.9), R * 3.2);
          minaret(Math.round(cx - R * 3.6), R * 2.5); minaret(Math.round(cx + R * 3.6), R * 2.5);
        };
        mosque(Math.round(w * (narrow ? 0.3 : 0.6)), Math.round(9 * s));
        mosque(Math.round(w * (narrow ? 0.8 : 0.86)), Math.round(5 * s));
        const gx = Math.round(w * (narrow ? 0.95 : 0.95)), gh = 26 * s;
        for (let y = 0; y < gh; y++) for (let dx = -2.5 * s; dx <= 2.5 * s; dx++) add(gx + dx, hy - 3 - y);
        for (let i = 0; i < 9 * s; i++) for (let dx = -(9 * s - i) * 0.4; dx <= (9 * s - i) * 0.4; dx++) add(gx + dx, hy - 3 - gh - i);
        for (const v of sil) { const x = Math.floor(v / 10000), y = v % 10000; put(x, y, mix(C.silh, C.dusk[2], 0.15 + 0.25 * (1 - (hy - y) / 60))); }
        lights = sil.filter((v) => (v % 10000) > hy - 5 && hash(Math.floor(v / 10000), v % 10000) < 0.04).map((v) => [Math.floor(v / 10000), v % 10000]);
        // sea mirrors the sky, darker
        for (let y = hy + 1; y < qy; y++) {
          const k = (y - hy) / (qy - hy);
          for (let x = 0; x < w; x++) put(x, y, mix(mix(C.dusk[3], C.sea, 0.55 + k * 0.4), C.sea, 0.2));
        }
        // quay
        for (let y = qy; y < h; y++) for (let x = 0; x < w; x++) put(x, y, mix(C.stone, C.silh, hash(x >> 1, y) * 0.3));
        base = snap();
        gulls = Array.from({ length: narrow ? 3 : 5 }, () => makeGull(true));
        ferry = { x: w * 0.95, y: hy + Math.max(3, (qy - hy) * 0.22) };
        smoke = [];
        fig = { x: w * (narrow ? 0.24 : 0.6) };
        cat = { x: fig.x + (narrow ? 15 : 30) };
      },
      step(dt) {
        ferry.x -= 0.05 * dt;
        if (ferry.x < -40) ferry.x = w + 30;
        if (Math.random() < 0.25 * dt) smoke.push({ x: ferry.x + 4, y: ferry.y - (narrow ? 9 : 14), a: 0.5, r: 1 });
        for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.x += 0.12 * dt; p.y -= 0.05 * dt; p.r += 0.02 * dt; p.a -= 0.004 * dt; if (p.a <= 0) smoke.splice(i, 1); }
        for (const g of gulls) {
          g.x -= g.v * dt; g.y += Math.sin(t * 0.8 + g.ph) * 0.04 * dt;
          if (g.x < -20) Object.assign(g, makeGull(false));
        }
      },
      render() {
        restore(base);
        // waves and the glittering sun path
        for (let y = hy + 1; y < qy; y++) {
          const k = (y - hy) / (qy - hy), half = sun.r * (0.5 + k * 1.5);
          for (let x = 0; x < w; x++) {
            if (PXL.colF[x] < 0.01) continue;
            const wv = vnoise(x * 0.12 + t * 0.4, y * 0.9 - t * 0.2);
            const inPath = Math.abs(x - sun.x) < half * (0.7 + vnoise(y * 0.5, t * 0.8) * 0.6);
            if (inPath) {
              const sp = hash(x + Math.floor(t * 12), y);
              const edge = 1 - Math.abs(x - sun.x) / half;
              if (sp < 0.3 * edge + 0.05) put(x, y, sp < 0.08 ? C.glitter : mix(C.glitter, C.dusk[3], 0.5), (0.85 - k * 0.3) * (0.5 + edge * 0.5));
            } else if (wv > 0.62) put(x, y, C.seaHi, (wv - 0.62) * 1.6);
            else if (wv < 0.3) put(x, y, C.sea, 0.35);
          }
        }
        for (const [x, y] of lights) if (Math.sin(t * 1.3 + x) > -0.4) put(x, y, C.glitter, 0.9);
        // ferry: lit white decks, dark hull, funnel and smoke
        const s = narrow ? 0.55 : 1, fx = ferry.x, fy = ferry.y;
        for (const p of smoke) disc(p.x, p.y, p.r * s * 2, C.cloud || C.white, p.a * 0.5);
        rectF(fx - 18 * s, fy - 3 * s, fx + 18 * s, fy + 1, C.silh);
        rectF(fx - 15 * s, fy - 7 * s, fx + 14 * s, fy - 3 * s, mix(C.white, C.dusk[3], 0.25));
        rectF(fx - 10 * s, fy - 10 * s, fx + 8 * s, fy - 7 * s, mix(C.white, C.dusk[3], 0.35));
        for (let i = -13; i < 12; i += 3) put(fx + i * s, fy - 5 * s, C.silh, 0.8);
        rectF(fx + 2 * s, fy - 15 * s, fx + 6 * s, fy - 10 * s, C.silh);
        for (let i = 0; i < 20; i++) put(fx + 18 * s + i * 1.2, fy + (i % 2), C.seaHi, 0.5 - i * 0.02);
        // gulls: two flapping arcs
        for (const g of gulls) {
          const f = Math.sin(t * 7 + g.ph), sz = g.sz;
          stroke(g.x - sz, g.y - f * sz * 0.6, g.x - sz * 0.35, g.y - sz * 0.25, 1, C.silh, 0.9);
          stroke(g.x - sz * 0.35, g.y - sz * 0.25, g.x, g.y, 1, C.silh, 0.9);
          stroke(g.x, g.y, g.x + sz * 0.35, g.y - sz * 0.25, 1, C.silh, 0.9);
          stroke(g.x + sz * 0.35, g.y - sz * 0.25, g.x + sz, g.y - f * sz * 0.6, 1, C.silh, 0.9);
        }
        // railing, someone sitting with tea, a cat
        const rail = qy - (narrow ? 8 : 16);
        for (let x = 0; x < w; x += narrow ? 14 : 26) rectF(x, rail, x + (narrow ? 1.5 : 2.5), qy, C.silh);
        rectF(0, rail, w, rail + (narrow ? 1.2 : 2), C.silh);
        const sc = { ...C, jacket: C.silh, jacketLit: C.dusk[3], hair: C.silh, skin: mix(C.silh, C.dusk[3], 0.3) };
        sitter(fig.x, qy, narrow ? 26 : 56, sc, { scarf: mix(C.scarf, C.silh, 0.35), wind: 0.3 });
        const gx = fig.x - (narrow ? 14 : 26);
        rectF(gx - 1.5 * s, qy - 6 * s, gx + 1.5 * s, qy, mix(C.glitter, C.scarf, 0.6), 0.9);
        for (let i = 0; i < 8; i++) put(gx + Math.sin(t * 2 + i * 0.7) * 1.2, qy - 7 * s - i * 1.3, C.white, 0.35 - i * 0.04);
        // cat from behind: body, head with ears, curling tail
        const cs2 = narrow ? 0.5 : 1, cx = cat.x, cy = qy;
        disc(cx, cy - 6 * cs2, 6 * cs2, sc.jacket, 1, (dx, dy, r) => mix(C.silh, C.dusk[3], clamp(dx / r, 0, 1) * 0.35));
        disc(cx, cy - 14 * cs2, 4 * cs2, C.silh);
        for (const sd of [-1, 1]) for (let i = 0; i < 4 * cs2; i++) for (let j = 0; j <= (4 * cs2 - i) * 0.5; j++) put(cx + sd * (2.4 * cs2 + j - (4 * cs2 - i) * 0.25), cy - 17 * cs2 - i, C.silh);
        const tw = Math.sin(t * 1.6);
        for (let i = 0; i < 14; i++) { const k = i / 14; disc(cx + 5 * cs2 + k * 7 * cs2, cy - 1 - Math.sin(k * 2.6 + tw * 0.6) * 6 * cs2 * k, 1.2 * cs2, C.silh); }
      },
    };
  })();

  /* ════════════════════════════════════════════════════════════
     engine
     ════════════════════════════════════════════════════════════ */
  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    narrow = W < 900 || W / H < 1.05;
    CS = W < 640 ? 8 : W < 1200 ? 10 : 11;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.height = H + "px";
    COLS = Math.ceil(W / CS);
    ROWS = Math.ceil(H / CS);
    if (S.pixel) pxLayout();
    S.init();
    buildStatic();
  }
  function buildStatic() {
    staticLayer = document.createElement("canvas");
    staticLayer.width = canvas.width;
    staticLayer.height = canvas.height;
    const c = staticLayer.getContext("2d");
    c.scale(DPR, DPR);
    setFont(c);
    S.stat?.(c);
  }
  function draw() {
    if (S.pixel) { S.render(); pxFlush(); return; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(staticLayer, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    setFont(ctx);
    S.draw(ctx);
  }

  let last = 0, raf = 0, acc = 0;
  const FRAME = 1000 / 60;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!last) last = now;
    let elapsed = now - last;
    last = now;
    if (elapsed > 250) elapsed = FRAME;
    acc += elapsed;
    if (acc < FRAME) return;
    const dt = Math.min(3, acc / (1000 / 60));
    acc = 0;
    t += dt / 60;
    S.step(dt);
    mouse.vx *= 0.9; mouse.vy *= 0.9;
    draw();
  }

  function seasonNow() {
    const m = new Date().getMonth();
    return m === 11 || m < 2 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "autumn";
  }
  function resolveScene() {
    const q = new URLSearchParams(location.search).get("scene");
    if (q && scenes[q]) return q;
    if (canvas.hasAttribute("data-picker")) {
      try { const s = localStorage.getItem("scene"); if (s && scenes[s]) return s; } catch (e) {}
    }
    const cfg = canvas.dataset.scene;
    return scenes[cfg] ? cfg : seasonNow();
  }
  function use(name) {
    sceneName = name;
    S = scenes[name];
    canvas.dataset.active = name;
    const label = document.querySelector("[data-scene-label]");
    if (label) label.textContent = LABEL[name];
    layout();
    if (still) { t = 12; for (let i = 0; i < 90; i++) S.step(1); draw(); }
  }

  /* ── events ───────────────────────────────────────────────── */
  let resizeTimer = 0, lastW = window.innerWidth;
  addEventListener("resize", () => {
    // mobile browsers fire resize when the URL bar slides; ignore height-only jitter there
    if (narrow && Math.abs(window.innerWidth - lastW) < 2) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { layout(); if (still) draw(); }, 120);
  });
  addEventListener("pointermove", (e) => {
    const y = e.clientY + (narrow ? window.scrollY : 0);
    mouse.vx = e.clientX - (mouse.active ? mouse.x : e.clientX);
    mouse.vy = y - (mouse.active ? mouse.y : y);
    mouse.x = e.clientX; mouse.y = y;
    mouse.active = true;
  }, { passive: true });
  document.addEventListener("pointerleave", () => { mouse.active = false; });
  document.addEventListener("visibilitychange", () => {
    if (still) return;
    if (document.hidden) cancelAnimationFrame(raf);
    else { last = 0; raf = requestAnimationFrame(loop); }
  });
  const repaint = () => { readPalette(); if (S.pixel) pxLayout(); S.init(); buildStatic(); if (still) draw(); };
  new MutationObserver(repaint).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  prefersDark.addEventListener?.("change", repaint);

  // once the reader scrolls past the hero, the scene steps back so text stays readable
  const fadeOnScroll = () => {
    if (narrow) { canvas.style.opacity = ""; return; }
    canvas.style.opacity = String(Math.max(0.12, 1 - window.scrollY / (H * 0.7)));
  };
  addEventListener("scroll", fadeOnScroll, { passive: true });

  const picker = document.querySelector(".scene-switch");
  if (picker && canvas.hasAttribute("data-picker")) {
    picker.hidden = false;
    picker.addEventListener("click", () => {
      const next = ORDER[(ORDER.indexOf(sceneName) + 1) % ORDER.length];
      try { localStorage.setItem("scene", next); } catch (e) {}
      use(next);
    });
  }

  readPalette();
  use(resolveScene());
  fadeOnScroll();
  if (!still) raf = requestAnimationFrame(loop);
})();
