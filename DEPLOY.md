# Deploy & hosting notes

## Current topology

- **`www.apsfiltros.com.br`** → Cloudflare Pages, git-connected to this repo
  (confirmed).
- **`apsfiltros.com.br`** (bare apex) → still on GitHub Pages, 301-redirects
  to `www`. Confirmed via `curl -I`: `server: GitHub.com`.
- This split is what the fallback-to-200 behavior on unmatched paths was
  pointing at: Cloudflare Pages serves `index.html` for any unmatched route
  when the deployment has no `404.html`. The new `404.html` in this branch
  fixes that automatically once deployed — no dashboard action needed for
  that part.

## Step 1 — this branch isn't live yet

Everything referenced below (`404.html`, `_headers`, `robots.txt`,
`sitemap.xml`, `llms.txt`, the favicon fix, `manifest.webmanifest`) is
committed on `claude/aps-filtros-review-v8jg0x`, **not on `master`**.
Nothing changes on the live site until this branch is merged. Say the word
and I'll open a PR; otherwise merge it yourself whenever you're ready to
review the diff.

Also worth a quick check in the Pages project settings (**Settings → Builds
& deployments**): confirm the **Production branch** is set to `master` (or
whatever your default branch is) — that's what determines whether merging
this branch actually triggers a deploy.

## Step 2 — fix the apex redirect

1. Cloudflare dashboard → **Workers & Pages** → your Pages project →
   **Custom domains** → **Add a custom domain** → enter `apsfiltros.com.br`
   (the bare domain, no `www`).
2. Cloudflare will show you the exact DNS record to add (usually a
   CNAME-flattened record at the apex). Add it in the zone's **DNS** tab if
   it isn't added automatically.
3. This makes apex and `www` both served directly by the same Pages
   project — the GitHub Pages 301 hop goes away entirely, and going private
   later won't break the bare domain.
4. **Verify:**
   ```
   curl -sSI https://apsfiltros.com.br | grep -iE "server|location"
   ```
   Expect `server: cloudflare`, with no redirect hop through
   `server: GitHub.com`.

## Step 3 — going private

Once Step 2 is verified, flip the GitHub repo to private. Cloudflare Pages'
git integration uses an installed GitHub App with repo access (not
anonymous fetch), so it keeps working against a private repo without
further changes here.

## After you've made the Cloudflare-side change

Tell me and I'll re-run the same checks from the original audit against the
live site — apex redirect, `404.html` returning a real 404, `robots.txt` /
`sitemap.xml` / `llms.txt` serving as plain text, and cache headers on
images — before you flip the repo to private.
