# Deploy & hosting notes

## Current topology (as observed from outside — no dashboard access)

- **`apsfiltros.com.br`** (bare apex) → GitHub Pages, 301-redirects to `www`.
  Confirmed via `curl -I`: `server: GitHub.com`.
- **`www.apsfiltros.com.br`** → Cloudflare (`server: cloudflare`, `cf-ray` present).
- Both currently serve the **same commit** from this repo's `master` branch.
- `www` returns HTTP 200 with the homepage for *any* unmatched path
  (`/robots.txt`, `/nonexistent-xyz`, etc. all return the homepage). This
  specific behavior — silently falling back to `index.html` instead of a
  real 404 — is a **Cloudflare Pages** feature (it does this automatically
  when a deployment has no `404.html`). A plain DNS/CDN proxy sitting in
  front of GitHub Pages would not do this on its own; it would pass through
  GitHub Pages' own 404 response. That's evidence `www` is a real Cloudflare
  Pages project, not just DNS pointed through Cloudflare at GitHub Pages —
  but I can't be certain without dashboard access. Confirm with **Step 0**
  below before doing anything else, since it changes which of Step 2's two
  paths applies.

## Step 0 — confirm which setup you have

In the Cloudflare dashboard:

1. Go to **Workers & Pages**. If there's a project there (something like
   `apsfiltros` or `apsfiltros-github-io`) with a **Production branch**
   set to `master` — **you're on Cloudflare Pages, git-connected to this
   repo.** Follow **Step 2A**.
2. If there's no such project, check the zone's **DNS** records for
   `apsfiltros.com.br`. If the `www` record is a proxied (orange-cloud)
   CNAME pointing at `apsfiltros.github.io`, **you're on plain DNS
   proxy in front of GitHub Pages.** Follow **Step 2B** — but also check
   **Workers & Pages → Workers** and the zone's **Workers Routes** for
   anything intercepting `www.apsfiltros.com.br/*`, since that would
   explain the fallback-to-200 behavior in a proxy-only setup.

## Step 1 — this branch isn't live yet

Everything described in this doc (the new `404.html`, `_headers`,
`robots.txt`, `sitemap.xml`, `llms.txt`, favicon fix) is committed on
`claude/aps-filtros-review-v8jg0x`, **not on `master`**. Nothing changes on
the live site until this branch is merged. Say the word and I'll open a PR;
otherwise merge it yourself whenever you're ready to review the diff.

## Step 2A — if it's Cloudflare Pages (git-connected)

1. **Fix the apex redirect.** Pages project → **Custom domains** → **Add a
   custom domain** → enter `apsfiltros.com.br` (the bare domain, no `www`).
   Cloudflare will show you the exact DNS record to add (usually a
   CNAME-flattened record at the apex). Add it. This makes apex and `www`
   both served directly by the same Pages project — the GitHub Pages 301
   hop goes away entirely, and going private later won't break anything.
2. **Verify:**
   ```
   curl -sSI https://apsfiltros.com.br | grep -iE "server|location"
   ```
   Expect `server: cloudflare` with no `location:` redirect hop through
   GitHub, or a redirect straight to `https://www...` served by Cloudflare
   itself.
3. **`404.html` and `_headers`** need nothing further from you — Cloudflare
   Pages reads both automatically from the deployed output once this branch
   is merged.
4. **When you're ready to go private:** flip the GitHub repo to private only
   *after* step 1's custom domain is active and verified. Cloudflare Pages
   git integration still works with private repos (it uses an installed
   GitHub App with repo access, not anonymous fetch), so nothing else should
   break.

## Step 2B — if it's DNS proxy only, in front of GitHub Pages

1. `_headers` does nothing here — it's a Cloudflare Pages-only convention.
   GitHub Pages doesn't read it either. Custom cache headers would need a
   Cloudflare **Cache Rule** (dashboard → Caching → Cache Rules) set up by
   hand instead.
2. `404.html` **does** work here — GitHub Pages serves it natively for any
   unmatched path, proxied or not. But that contradicts what I observed live
   (200 + homepage for missing paths) — so if this is really your setup,
   something else is rewriting those responses (see the Worker note in
   Step 0.2). Track that down first; the fix is in the Worker's logic, not
   in this repo.
3. **Fix the apex redirect:** add a Cloudflare **Redirect Rule** —
   `apsfiltros.com.br/*` → `https://www.apsfiltros.com.br/$1`, 301 — or,
   simpler, just proxy the apex DNS record directly at GitHub Pages the same
   way `www` already is, so both hostnames terminate at Cloudflare instead
   of one bouncing through GitHub.
4. **Going private breaks this setup on GitHub's free plan** — GitHub Pages
   does not serve private repos without GitHub Pro/Team/Enterprise. Confirm
   your plan covers it, or this whole approach needs to move to genuine
   Cloudflare Pages (Step 2A) before going private.

## After you've made the Cloudflare-side change

Tell me and I'll re-run the same checks from the original audit against the
live site — apex redirect, `404.html` returning a real 404, `robots.txt` /
`sitemap.xml` / `llms.txt` serving as plain text, and cache headers on
images — before you flip the repo to private.
