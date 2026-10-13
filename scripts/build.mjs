import { build } from "esbuild";
import fs from "node:fs";
fs.mkdirSync("dist", { recursive: true });
await build({
  entryPoints: ["frontend/main.tsx"],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: "dist/app.js",
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".css": "css", ".png": "dataurl" },
});
fs.copyFileSync("frontend/index.html", "dist/index.html");
// Portable, offline browser simulation. No API server required to open this file.
const css = fs
  .readFileSync("dist/app.css", "utf8")
  .replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;]*;/g, "")
  .replace(/\/\*# sourceMappingURL=.*?\*\//g, "");
const js = fs
  .readFileSync("dist/app.js", "utf8")
  .replace(/\/\/# sourceMappingURL=.*$/gm, "")
  .replace(/<\/script/gi, "<\\/script");
const html = fs
  .readFileSync("dist/index.html", "utf8")
  .replace(/<link\b(?=[^>]*\brel="stylesheet")(?=[^>]*\bhref="\/app\.css")[^>]*>/i, () => `<style>${css}</style>`)
  .replace(
    '<script type="module" src="/app.js"></script>',
    () => `<script type="module">${js}</script>`,
  );
// Fail the build if formatting changes ever leave an external asset reference.
if (!html.includes(`<style>${css}</style>`) || /<(?:link|script)\b[^>]*(?:href="\/app\.css"|src="\/app\.js")/i.test(html)) {
  throw new Error("Portable demo must embed both CSS and JavaScript");
}
if (!css.startsWith(":root") || css.includes("@import")) {
  throw new Error("Portable demo CSS must start with its theme and contain no external imports");
}
fs.mkdirSync("release", { recursive: true });
fs.writeFileSync("release/TreasuryFlow-demo.html", html);
