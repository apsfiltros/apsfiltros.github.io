# apsfiltros.github.io
APS Filtros website

## Editing content

`index.html`, `en/index.html`, `es/index.html`, `fr/index.html`, `vi/index.html`,
`zh/index.html`, `404.html`, `sitemap.xml` and `llms.txt` are **generated** —
don't edit them directly, changes will be overwritten. Edit these instead:

- `src/template.html` — page structure/markup, shared by every language
- `src/404.html` — the "page not found" page
- `src/site.json` — company name, email, phone, WhatsApp, address
- `lang/*.json` — per-language text, metadata, and UI labels

Then regenerate everything:

```
node build.mjs
```

Run `npm test` to check the result. The CI workflow does both on every pull
request and commits the regenerated output back to the PR branch — but running
it locally lets you preview the result before pushing.
