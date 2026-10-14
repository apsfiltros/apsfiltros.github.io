# apsfiltros.github.io

Website of APS Filtros — https://www.apsfiltros.com.br — in six languages
(Português, English, Español, Français, Tiếng Việt, 中文). Plain HTML, CSS and
JavaScript with no runtime dependencies. Every merge to `master` is deployed
by Cloudflare Pages; see [DEPLOY.md](DEPLOY.md) for hosting and DNS.

## What's where

| Path | What it is |
|---|---|
| `lang/*.json` | All page text, one file per language. `pt-BR.json` is the reference: every file must have exactly the same keys. |
| `src/template.html` | The page markup, shared by every language |
| `src/site.json` | Company name, email, phone, WhatsApp, address |
| `src/galleries.json` | Which photos appear in which gallery, in order |
| `src/404.html` | The "page not found" page |
| `style.css`, `main.js` | Styles and behaviour for every page |
| `img/original/` | Full-resolution product photos — the source for everything in `img/` (not public) |
| `img/` | Web-optimized photos, icons, logo |
| `fonts/` | Self-hosted fonts and their licences |
| `_headers`, `_redirects` | Cloudflare Pages config: caching, security headers, files kept private |
| `build.mjs` | Generates the pages from the sources above |
| `optimize-images.mjs` | Generates `img/` from `img/original/` |
| `tests/` | Automated checks (`npm test`) |

**Generated — never edit by hand** (changes are overwritten): `index.html`,
`en/`, `es/`, `fr/`, `vi/`, `zh/` (`index.html` in each), `404.html`,
`sitemap.xml`, `llms.txt`.

## Common tasks

Needs [Node.js](https://nodejs.org) 22 or newer.

**Change text** — edit the key in every `lang/*.json` file, then:
```
node build.mjs
npm test
```
The build stops with an error if a language is missing a key.

**Change contact details** — edit `src/site.json`, then `node build.mjs`. The
pages, the search-engine data and `llms.txt` all update from it.

**Change styles or scripts** — edit `style.css` / `main.js`, then
`node build.mjs`. That matters: pages load these as `style.css?v=<hash>` so
browsers can cache them for a year, and the build updates the hash.

**Add or replace a product photo**
1. Put the full-size JPEG in `img/original/` (e.g. `img/original/foto08.jpg`).
   Don't put photos straight into `img/` — those files are generated.
2. `npm install` (first time only), then `npm run optimize-images`.
3. Add the name (`foto08`) to the right gallery in `src/galleries.json`.
4. Add its description under `"gallery"` in every `lang/*.json` — that's the
   text screen readers and search engines get for the photo.
5. `node build.mjs` and `npm test`.

**Preview locally** — `python3 -m http.server` (or `npx serve`) in the repo
folder, then open http://localhost:8000. `_headers` and `_redirects` only
apply on Cloudflare, not locally; every pull request also gets a Cloudflare
preview link.

## Checks

- `npm test` — generated files match their sources, every language has every
  text, links and images exist, metadata and structured data are valid,
  nothing would be blocked by the security policy, and more.
- `npm run validate-html` — HTML validation.

CI (`.github/workflows/ci.yml`) runs the build and both checks on every pull
request and on every push to `master`. On a pull request it also commits the
regenerated pages back to the branch, so editing `lang/*.json` directly on
GitHub works too.
