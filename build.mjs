#!/usr/bin/env node
// Generates every page of the site from the sources in src/ and lang/*.json.
// No dependencies.
//
//   node build.mjs           write the generated files
//   node build.mjs --check   write nothing; exit 1 if any generated file is
//                            out of date or a translation is missing (CI)
//
// Generated (never edit by hand): index.html, {en,es,fr,vi,zh}/index.html,
// 404.html, sitemap.xml, llms.txt.
//
// Template syntax in src/*.html:
//   data-i18n="key"   replace the element's text with that translation
//   {{t:key}}         a translation, e.g. inside an attribute
//   {{site:key}}      a value from src/site.json (contact details etc.)
//   {{NAME}}          a value computed here (canonical URL, hreflang links...)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = "https://www.apsfiltros.com.br";
const CHECK = process.argv.includes("--check");

const LANGS = [
  { code: "pt-BR", path: "", ogLocale: "pt_BR", file: "pt-BR.json", label: "Português" },
  { code: "en", path: "en/", ogLocale: "en_US", file: "en.json", label: "English" },
  { code: "es", path: "es/", ogLocale: "es_ES", file: "es.json", label: "Español" },
  { code: "fr", path: "fr/", ogLocale: "fr_FR", file: "fr.json", label: "Français" },
  { code: "vi", path: "vi/", ogLocale: "vi_VN", file: "vi.json", label: "Tiếng Việt" },
  // Simplified Chinese script, so browsers don't fall back to Japanese glyphs.
  { code: "zh-Hans", path: "zh/", ogLocale: "zh_CN", file: "zh.json", label: "中文" },
];

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const errors = [];

// Text between tags only needs & < > escaped.
function escapeText(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// {{t:...}} and {{site:...}} can land inside attribute values (content="...",
// aria-label="..."), where an unescaped quote would end the attribute early.
function escapeHtml(str) {
  return escapeText(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function getNested(obj, path) {
  return path.split(".").reduce((acc, part) => (acc != null ? acc[part] : undefined), obj);
}

function flattenKeys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flattenKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );
}

const shortHash = (text) => createHash("sha256").update(text).digest("hex").slice(0, 10);

// --------------------------------------------------------------------------
// Inputs
// --------------------------------------------------------------------------

const site = JSON.parse(read("src/site.json"));
site.phone.url = `tel:${site.phone.e164}`;
site.whatsapp.url = `https://wa.me/${site.whatsapp.e164.replace(/^\+/, "")}`;

const dicts = Object.fromEntries(LANGS.map((l) => [l.code, JSON.parse(read(`lang/${l.file}`))]));

// Every language must have exactly the same keys as Portuguese.
const referenceKeys = new Set(flattenKeys(dicts["pt-BR"]));
for (const lang of LANGS.slice(1)) {
  const keys = new Set(flattenKeys(dicts[lang.code]));
  for (const k of referenceKeys) if (!keys.has(k)) errors.push(`lang/${lang.file}: missing key "${k}"`);
  for (const k of keys) if (!referenceKeys.has(k)) errors.push(`lang/${lang.file}: unexpected key "${k}" (not in pt-BR.json)`);
}

const computed = {
  YEAR: String(new Date().getUTCFullYear()),
  CSS_VERSION: shortHash(read("style.css")),
  JS_VERSION: shortHash(read("main.js")),
};

// --------------------------------------------------------------------------
// Rendering
// --------------------------------------------------------------------------

function render(source, sourceName, dict, perPage = {}) {
  let html = source;

  // Text content of every data-i18n="key" element (leaf elements only — no
  // nested tags inside a data-i18n target).
  html = html.replace(
    /(<([a-z0-9]+)\b[^>]*\bdata-i18n="([a-zA-Z0-9_.]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (match, openTag, _tagName, key, _oldContent, closeTag) => {
      const value = getNested(dict, key);
      if (typeof value !== "string") {
        errors.push(`${sourceName}: missing translation "${key}"`);
        return match;
      }
      return openTag.replace(/\s+data-i18n="[^"]*"/, "") + escapeText(value) + closeTag;
    }
  );

  html = html.replace(/\{\{t:([a-zA-Z0-9_.]+)\}\}/g, (match, key) => {
    const value = getNested(dict, key);
    if (typeof value !== "string") {
      errors.push(`${sourceName}: missing translation "${key}"`);
      return match;
    }
    return escapeHtml(value);
  });

  html = html.replace(/\{\{site:([a-zA-Z0-9_.]+)\}\}/g, (match, key) => {
    const value = getNested(site, key);
    if (value == null || typeof value === "object") {
      errors.push(`${sourceName}: unknown site value "${key}" (see src/site.json)`);
      return match;
    }
    return escapeHtml(value);
  });

  // Computed values are inserted as-is: they are either plain text built
  // here or already-escaped markup.
  const values = { ...computed, ...perPage };
  html = html.replace(/\{\{([A-Z_]+)\}\}/g, (match, name) => {
    if (!(name in values)) {
      errors.push(`${sourceName}: unknown placeholder "${match}"`);
      return match;
    }
    return values[name];
  });

  return html;
}

function buildHreflangLinks() {
  const links = LANGS.map((l) => `  <link rel="alternate" hreflang="${l.code}" href="${SITE}/${l.path}">`);
  links.push(`  <link rel="alternate" hreflang="x-default" href="${SITE}/">`);
  return links.join("\n");
}

const GLOBE_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20"/></svg>';

// Native language names (not flags — flags stand for countries, and Windows
// renders flag emojis as plain letters like "BR"). Each link declares its own
// language so screen readers pronounce it correctly.
function buildLangSwitcher(currentCode, languageLabel) {
  const current = LANGS.find((l) => l.code === currentCode);
  const items = LANGS.map((l) => {
    const attrs = l.code === currentCode ? ' aria-current="page" class="current"' : "";
    return `              <li><a href="/${l.path}" lang="${l.code}" hreflang="${l.code}"${attrs}>${l.label}</a></li>`;
  }).join("\n");

  return `        <li class="lang-switcher">
          <details>
            <summary>${GLOBE_ICON}<span class="sr-only">${escapeHtml(languageLabel)}: </span>${current.label}</summary>
            <ul>
${items}
            </ul>
          </details>
        </li>`;
}

function buildJsonLd(dict) {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: site.legalName,
    alternateName: site.brandName,
    description: dict.meta.description,
    foundingDate: String(site.foundingYear),
    url: `${SITE}/`,
    logo: `${SITE}/img/icon-512.png`,
    image: `${SITE}/img/og-image.jpg`,
    telephone: site.phone.e164,
    email: site.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    contactPoint: {
      "@type": "ContactPoint",
      name: "WhatsApp",
      contactType: "customer service",
      telephone: site.whatsapp.e164,
      url: site.whatsapp.url,
    },
  };
  // "<" escaped so no value can ever close the <script> element early.
  const json = JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
  return `  <script type="application/ld+json">\n${json.replace(/^/gm, "  ")}\n  </script>`;
}

// --------------------------------------------------------------------------
// sitemap.xml — lastmod only moves when a page's HTML actually changed, so
// search engines can trust it (it used to change on every build).
// --------------------------------------------------------------------------

function previousLastmods() {
  if (!existsSync(join(ROOT, "sitemap.xml"))) return {};
  const xml = read("sitemap.xml");
  return Object.fromEntries([...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));
}

function buildSitemap(lastmods) {
  const alternates = LANGS.map((l) => `      <xhtml:link rel="alternate" hreflang="${l.code}" href="${SITE}/${l.path}"/>`).join("\n");
  const xdefault = `      <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`;
  const urls = LANGS.map(
    (l) => `  <url>
    <loc>${SITE}/${l.path}</loc>
    <lastmod>${lastmods[l.code]}</lastmod>
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

// --------------------------------------------------------------------------
// llms.txt — a plain-text summary for AI assistants, generated from the same
// content as the pages so it can't drift out of date.
// --------------------------------------------------------------------------

const PRODUCTS = [
  ["agricola", "agricola.disleite"],
  ["agricola", "agricola.camisas"],
  ["industrial", "industrial.resinas"],
  ["industrial", "industrial.membranas"],
  ["fitas", "fitas"],
];

function productLines(dict, base) {
  return PRODUCTS.map(([section, key]) => {
    const p = getNested(dict, key);
    return `- [${p.title}](${base}#${section}): ${p.desc}`;
  }).join("\n");
}

function buildLlmsTxt() {
  const pt = dicts["pt-BR"];
  const en = dicts.en;
  const a = site.address;
  return `# ${site.brandName}

> ${pt.meta.og_description}

${pt.empresa.text}

## Produtos

${productLines(pt, `${SITE}/`)}

## Contato

- Email: ${site.email}
- Telefone: ${site.phone.display}
- WhatsApp: ${site.whatsapp.display} (${site.whatsapp.url})
- Endereço: ${site.legalName}, ${a.street}, CEP ${a.postalCode}, ${a.city}, ${a.region}, ${a.countryName}

## Idiomas / Languages

${LANGS.map((l) => `- [${l.label}](${SITE}/${l.path})`).join("\n")}

## English summary

> ${en.meta.og_description}

${en.empresa.text}

${productLines(en, `${SITE}/en/`)}
`;
}

// --------------------------------------------------------------------------
// Build
// --------------------------------------------------------------------------

const outputs = [];
const today = new Date().toISOString().slice(0, 10);
const prevLastmods = previousLastmods();
const lastmods = {};
const template = read("src/template.html");

for (const lang of LANGS) {
  const dict = dicts[lang.code];
  const langRoot = "/" + lang.path;
  const html = render(template, `src/template.html [${lang.code}]`, dict, {
    HTML_LANG: lang.code,
    CANONICAL_URL: `${SITE}${langRoot}`,
    OG_LOCALE: lang.ogLocale,
    LANG_ROOT: langRoot,
    HREFLANG_LINKS: buildHreflangLinks(),
    LANG_SWITCHER: buildLangSwitcher(lang.code, dict.ui.language),
    JSON_LD: buildJsonLd(dict),
  });
  const file = `${lang.path}index.html`;
  const unchanged = existsSync(join(ROOT, file)) && read(file) === html;
  lastmods[lang.code] = (unchanged && prevLastmods[`${SITE}/${lang.path}`]) || today;
  outputs.push({ file, content: html });
}

outputs.push({ file: "404.html", content: render(read("src/404.html"), "src/404.html", dicts["pt-BR"]) });
outputs.push({ file: "sitemap.xml", content: buildSitemap(lastmods) });
outputs.push({ file: "llms.txt", content: buildLlmsTxt() });

for (const { file, content } of outputs) {
  const leftover = content.match(/\{\{[^}]*\}\}|data-i18n=/);
  if (leftover) errors.push(`${file}: unreplaced "${leftover[0]}"`);
}

if (errors.length) {
  console.error(`Build failed:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

if (CHECK) {
  const stale = outputs.filter(({ file, content }) => !existsSync(join(ROOT, file)) || read(file) !== content);
  if (stale.length) {
    console.error(`Out of date — run \`node build.mjs\` and commit:\n  ${stale.map((o) => o.file).join("\n  ")}`);
    process.exit(1);
  }
  console.log("All generated files are up to date.");
} else {
  for (const { file, content } of outputs) {
    mkdirSync(dirname(join(ROOT, file)), { recursive: true });
    writeFileSync(join(ROOT, file), content);
    console.log(`built ${file}`);
  }
}
