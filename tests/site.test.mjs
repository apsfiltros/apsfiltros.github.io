// Run with: npm test   (Node's built-in test runner — no dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync, cpSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.apsfiltros.com.br";
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const PAGES = [
  { file: "index.html", lang: "pt-BR", url: `${SITE}/`, dict: "pt-BR.json" },
  { file: "en/index.html", lang: "en", url: `${SITE}/en/`, dict: "en.json" },
  { file: "es/index.html", lang: "es", url: `${SITE}/es/`, dict: "es.json" },
  { file: "fr/index.html", lang: "fr", url: `${SITE}/fr/`, dict: "fr.json" },
  { file: "vi/index.html", lang: "vi", url: `${SITE}/vi/`, dict: "vi.json" },
  { file: "zh/index.html", lang: "zh-Hans", url: `${SITE}/zh/`, dict: "zh.json" },
];

function flattenKeys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flattenKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );
}

// Every local URL a page points at: href, src, srcset candidates, data-full.
function localReferences(html) {
  const refs = [];
  for (const [, attr, value] of html.matchAll(/\s(href|src|srcset|data-full)="([^"]*)"/g)) {
    const urls = attr === "srcset" ? value.split(",").map((c) => c.trim().split(/\s+/)[0]) : [value];
    for (const url of urls) {
      if (/^(https?:|mailto:|tel:|\/\/)/.test(url)) continue;
      refs.push(url);
    }
  }
  return refs;
}

function fileForPath(urlPath) {
  const clean = urlPath.split(/[?#]/)[0];
  const rel = clean.endsWith("/") ? `${clean}index.html` : clean;
  return join(ROOT, rel.replace(/^\//, ""));
}

function blockedPatterns() {
  return read("_redirects")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => new RegExp("^" + l.split(/\s+/)[0].replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"));
}

test("generated files are in sync with src/ and lang/ (node build.mjs --check)", () => {
  const r = spawnSync(process.execPath, ["build.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

// Runs build.mjs on a throwaway copy of the sources after `mutate` edits it.
function buildCopy(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "aps-build-"));
  for (const f of ["build.mjs", "src", "lang", "style.css", "main.js", "sitemap.xml"]) {
    cpSync(join(ROOT, f), join(dir, f), { recursive: true });
  }
  symlinkSync(join(ROOT, "img"), join(dir, "img"));
  mutate(dir);
  const r = spawnSync(process.execPath, ["build.mjs"], { cwd: dir, encoding: "utf8" });
  return { ...r, dir };
}

const editJson = (file, fn) => {
  const data = JSON.parse(readFileSync(file, "utf8"));
  fn(data);
  writeFileSync(file, JSON.stringify(data));
};

test("build fails (instead of silently shipping Portuguese) when a translation is missing", () => {
  const r = buildCopy((dir) => editJson(join(dir, "lang/fr.json"), (d) => delete d.hero.subtitle));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /fr\.json: missing key "hero\.subtitle"/);
});

test("a quote in a translated title can't break the HTML attribute it lands in", () => {
  const r = buildCopy((dir) =>
    editJson(join(dir, "lang/pt-BR.json"), (d) => (d.meta.og_title = 'Filtros "APS" & cia'))
  );
  assert.equal(r.status, 0, r.stderr);
  const html = readFileSync(join(r.dir, "index.html"), "utf8");
  assert.ok(html.includes('<meta property="og:title" content="Filtros &quot;APS&quot; &amp; cia">'));
});

test("every language file has exactly the keys of pt-BR.json", () => {
  const ref = new Set(flattenKeys(JSON.parse(read("lang/pt-BR.json"))));
  for (const { dict } of PAGES.slice(1)) {
    const keys = new Set(flattenKeys(JSON.parse(read(`lang/${dict}`))));
    assert.deepEqual([...ref].filter((k) => !keys.has(k)), [], `${dict} is missing keys`);
    assert.deepEqual([...keys].filter((k) => !ref.has(k)), [], `${dict} has extra keys`);
  }
});

for (const page of PAGES) {
  test(`${page.file}: language, canonical, hreflang, metadata`, () => {
    const html = read(page.file);
    assert.match(html, new RegExp(`<html lang="${page.lang}">`));
    assert.ok(html.includes(`<link rel="canonical" href="${page.url}">`), "canonical");
    assert.ok(html.includes(`<meta property="og:url" content="${page.url}">`), "og:url");
    assert.equal(html.match(/<link rel="alternate" hreflang=/g)?.length, PAGES.length + 1, "one hreflang per language + x-default");
    assert.match(html, /<title>[^<]{10,}<\/title>/, "title");
    assert.match(html, /<meta name="description" content="[^"]{30,}">/, "description");
    assert.doesNotMatch(html, /\{\{|data-i18n=/, "no unreplaced template markers");
  });

  test(`${page.file}: structured data is valid JSON with contact details`, () => {
    const html = read(page.file);
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(json, "has JSON-LD");
    const data = JSON.parse(json);
    assert.equal(data["@type"], "LocalBusiness");
    assert.ok(data.telephone && data.email && data.address?.streetAddress);
    assert.equal(data.contactPoint?.name, "WhatsApp");
  });

  test(`${page.file}: every local link and asset exists and isn't blocked`, () => {
    const html = read(page.file);
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const blocked = blockedPatterns();
    for (const ref of localReferences(html)) {
      if (ref.startsWith("#")) {
        assert.ok(ref === "#" || ids.has(ref.slice(1)), `${ref} points to a missing id`);
        continue;
      }
      const file = fileForPath(ref);
      assert.ok(existsSync(file) && statSync(file).isFile(), `${ref} does not exist`);
      const path = ref.split(/[?#]/)[0];
      assert.ok(!blocked.some((re) => re.test(path)), `${ref} is blocked by _redirects`);
    }
  });

  test(`${page.file}: every image has alt text and real dimensions; galleries are complete`, () => {
    const html = read(page.file);
    for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
      assert.match(tag, /\salt="[^"]+"/, `no alt: ${tag}`);
      assert.match(tag, /\swidth="\d+" height="\d+"/, `no width/height: ${tag}`);
    }
    const galleries = JSON.parse(read("src/galleries.json"));
    for (const [name, photos] of Object.entries(galleries)) {
      const block = html.match(new RegExp(`id="gallery-${name}">([\\s\\S]*?)\\n        </div>`))?.[1] ?? "";
      for (const photo of photos) {
        assert.ok(block.includes(`data-full-webp="/img/${photo}.webp"`), `${name} gallery is missing ${photo}`);
      }
    }
  });

  test(`${page.file}: CSS and JS are versioned (they're cached for a year)`, () => {
    const html = read(page.file);
    assert.match(html, /href="\/style\.css\?v=[0-9a-f]{10}"/);
    assert.match(html, /src="\/main\.js\?v=[0-9a-f]{10}"/);
    assert.doesNotMatch(html, /"\/(style\.css|main\.js)"/, "no unversioned reference");
  });
}

test("404.html uses absolute paths (it's served at any depth) and versioned CSS", () => {
  const html = read("404.html");
  for (const ref of localReferences(html)) {
    assert.ok(ref.startsWith("/"), `${ref} must be absolute`);
    assert.ok(existsSync(fileForPath(ref)), `${ref} does not exist`);
  }
  assert.match(html, /href="\/style\.css\?v=[0-9a-f]{10}"/);
});

test("sitemap.xml lists every language page with alternates", () => {
  const xml = read("sitemap.xml");
  for (const { url } of PAGES) assert.ok(xml.includes(`<loc>${url}</loc>`), url);
  assert.equal(xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)?.length, PAGES.length);
});

test("llms.txt carries current contact details", () => {
  const txt = read("llms.txt");
  const site = JSON.parse(read("src/site.json"));
  for (const v of [site.email, site.phone.display, site.whatsapp.display, site.address.street]) {
    assert.ok(txt.includes(v), `missing ${v}`);
  }
  assert.doesNotMatch(txt, /fax/i);
});
