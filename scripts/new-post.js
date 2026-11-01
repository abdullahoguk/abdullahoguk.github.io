// usage: npm run new:post -- "Yazı başlığı"
import fs from "node:fs";
const title = process.argv.slice(2).join(" ").trim();
if (!title) { console.error('usage: npm run new:post -- "Post title"'); process.exit(1); }
const map = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
const slug = title.toLowerCase().replace(/[çğıİöşüâîû]/g, (c) => map[c] || c).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const date = new Date().toISOString().slice(0, 10);
const file = `src/blog/posts/${slug}.md`;
if (fs.existsSync(file)) { console.error(`exists: ${file}`); process.exit(1); }
fs.writeFileSync(file, `---\ntitle: "${title.replace(/"/g, '\\"')}"\ndescription: ""\ndate: ${date}\nlang: tr\ntags: [post]\ndraft: true\n---\n\n`);
console.log(`created ${file}  (draft: true → yayınlamak için kaldır)`);
