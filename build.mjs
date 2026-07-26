#!/usr/bin/env node
// Generates index.html (pt-BR) and en/es/fr/vi/zh/index.html from
// template.html + lang/*.json, plus sitemap.xml. No dependencies.
//
// Run after editing template.html or lang/*.json:
//   node build.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = "https://www.apsfiltros.com.br";

const LANGS = [
  { code: "pt-BR", path: "", ogLocale: "pt_BR", file: "pt-BR.json", label: "🇧🇷 Português" },
  { code: "en", path: "en/", ogLocale: "en_US", file: "en.json", label: "🇬🇧 English" },
  { code: "es", path: "es/", ogLocale: "es_ES", file: "es.json", label: "🇪🇸 Español" },
  { code: "fr", path: "fr/", ogLocale: "fr_FR", file: "fr.json", label: "🇫🇷 Français" },
  { code: "vi", path: "vi/", ogLocale: "vi_VN", file: "vi.json", label: "🇻🇳 Tiếng Việt" },
  { code: "zh", path: "zh/", ogLocale: "zh_CN", file: "zh.json", label: "🇨🇳 中文" },
];

const template = readFileSync(join(ROOT, "template.html"), "utf8");

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getNested(obj, path) {
  return path.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function buildHreflangLinks() {
  const links = LANGS.map(
    (l) => `  <link rel="alternate" hreflang="${l.code}" href="${SITE}/${l.path}">`
  );
  links.push(`  <link rel="alternate" hreflang="x-default" href="${SITE}/">`);
  return links.join("\n");
}

function buildLangSwitcher(currentCode) {
  const current = LANGS.find((l) => l.code === currentCode);
  const items = LANGS.map((l) => {
    const isCurrent = l.code === currentCode;
    const attrs = isCurrent ? ' aria-current="page" class="current"' : "";
    return `              <li><a href="/${l.path}"${attrs}>${l.label}</a></li>`;
  }).join("\n");

  return `        <li class="lang-switcher">
          <details>
            <summary aria-label="Idioma / Language">${current.label}</summary>
            <ul>
${items}
            </ul>
          </details>
        </li>`;
}

function renderPage(lang, dict) {
  let html = template;

  // Text content for every data-i18n="key" element (leaf elements only —
  // no nested tags inside a data-i18n target in this template).
  html = html.replace(
    /(<([a-z0-9]+)\b[^>]*\bdata-i18n="([a-zA-Z0-9_.]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (match, openTag, _tagName, key, _oldContent, closeTag) => {
      const value = getNested(dict, key);
      if (value === undefined) {
        console.warn(`  ! missing key "${key}" for ${lang.code}`);
        return match;
      }
      const cleanOpenTag = openTag.replace(/\s+data-i18n="[^"]*"/, "");
      return cleanOpenTag + escapeHtml(value) + closeTag;
    }
  );

  const meta = dict.meta || {};
  const ui = dict.ui || {};
  const langRoot = "/" + lang.path;

  html = html
    .split("{{HTML_LANG}}").join(lang.code)
    .split("{{META_TITLE}}").join(escapeHtml(meta.title || ""))
    .split("{{META_DESCRIPTION}}").join(escapeHtml(meta.description || ""))
    .split("{{META_OG_TITLE}}").join(escapeHtml(meta.og_title || ""))
    .split("{{META_OG_DESCRIPTION}}").join(escapeHtml(meta.og_description || ""))
    .split("{{CANONICAL_URL}}").join(`${SITE}${langRoot}`)
    .split("{{OG_LOCALE}}").join(lang.ogLocale)
    .split("{{LANG_ROOT}}").join(langRoot)
    .split("{{HREFLANG_LINKS}}").join(buildHreflangLinks())
    .split("{{LANG_SWITCHER}}").join(buildLangSwitcher(lang.code))
    .split("{{UI_OPEN_MENU}}").join(escapeHtml(ui.open_menu || ""))
    .split("{{UI_LIGHTBOX_LABEL}}").join(escapeHtml(ui.lightbox_label || ""))
    .split("{{UI_LIGHTBOX_CLOSE}}").join(escapeHtml(ui.lightbox_close || ""))
    .split("{{UI_LIGHTBOX_PREV}}").join(escapeHtml(ui.lightbox_prev || ""))
    .split("{{UI_LIGHTBOX_NEXT}}").join(escapeHtml(ui.lightbox_next || ""))
    .split("{{UI_BACK_TO_TOP}}").join(escapeHtml(ui.back_to_top || ""));

  return html;
}

function buildSitemap() {
  const alternates = LANGS.map((l) => `      <xhtml:link rel="alternate" hreflang="${l.code}" href="${SITE}/${l.path}"/>`).join("\n");
  const xdefault = `      <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`;

  const urls = LANGS.map(
    (l) => `  <url>
    <loc>${SITE}/${l.path}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${l.code === "pt-BR" ? "1.0" : "0.8"}</priority>
${alternates}
${xdefault}
  </url>`
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

for (const lang of LANGS) {
  const dict = JSON.parse(readFileSync(join(ROOT, "lang", lang.file), "utf8"));
  const html = renderPage(lang, dict);
  const outDir = join(ROOT, lang.path);
  if (lang.path) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html);
  console.log(`built ${"/" + lang.path}index.html`);
}

writeFileSync(join(ROOT, "sitemap.xml"), buildSitemap());
console.log("built sitemap.xml");
