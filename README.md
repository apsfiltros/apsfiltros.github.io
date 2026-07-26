# apsfiltros.github.io
APS Filtros website

## Editing content

`index.html`, `en/index.html`, `es/index.html`, `fr/index.html`, `vi/index.html`
and `zh/index.html` are **generated** — don't edit them directly, changes will
be overwritten. Edit these instead:

- `template.html` — page structure/markup, shared by every language
- `lang/*.json` — per-language text, metadata, and UI labels

Then regenerate every language page and `sitemap.xml`:

```
node build.mjs
```

A GitHub Action does this automatically for pull requests that touch
`template.html`, `lang/**`, or `build.mjs`, and commits the regenerated
output back to the PR branch — but running it locally lets you preview the
result before pushing.
