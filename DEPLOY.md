# Hosting, DNS and deploys

## How it's set up today (October 2026)

| What | Where |
|---|---|
| Domain registration | registro.br |
| DNS | registro.br's own DNS (nameservers `a.sec.dns.br`, `b.sec.dns.br`), with DNSSEC on |
| `www.apsfiltros.com.br` | `CNAME` → `apsfiltros-github-io.pages.dev` → **Cloudflare Pages** project `apsfiltros-github-io` |
| `apsfiltros.com.br` (no www) | `A` → `185.199.108.153` → **GitHub Pages**, which only redirects to `www` |
| Email | Google Workspace (5 MX records + SPF). No DKIM, no DMARC |

**Deploys:** Cloudflare Pages deploys `master` automatically on every merge,
and gives every other branch its own preview URL (posted as a comment on
each pull request). There is no build step on Cloudflare — it serves the
repository files as committed. `_redirects` keeps the internal files
(`src/`, `lang/`, `tests/`, scripts, docs) from being served.

### Known problem: the bare domain's certificate has expired

GitHub Pages renews its certificate only for the domain in the `CNAME` file
(`www.apsfiltros.com.br`), and only while that domain points at GitHub. Since
`www` moved to Cloudflare, renewal silently stopped and the certificate
expired on 27 September 2026. `https://apsfiltros.com.br` now shows a browser
security warning; `http://apsfiltros.com.br` still redirects correctly.

Don't remove the custom domain from GitHub Pages in the meantime — that turns
the warning into a dead page. The fix is the DNS move below.

## Planned: move DNS hosting to Cloudflare

The domain stays registered at registro.br; only the nameservers change. That
gives the bare domain its own auto-renewing certificate and removes the last
dependency on GitHub Pages.

The one step that can take the whole domain (site **and** email) offline is
DNSSEC in step 4 — read it before starting.

### 0. Before you start
In **registro.br → domain → DNS → Editar zona**, take a screenshot of every
record. These are the ones visible from outside (the panel may have more):

| Type | Name | Value |
|---|---|---|
| MX | @ | `aspmx.l.google.com` (priority 1) |
| MX | @ | `alt1.aspmx.l.google.com` (5), `alt2.aspmx.l.google.com` (5) |
| MX | @ | `aspmx2.googlemail.com` (10), `aspmx3.googlemail.com` (10) |
| TXT | @ | `v=spf1 include:_spf.google.com ~all` |
| TXT | @ | `google-site-verification=8ASsdSvzet17y97OB2Vktjx0kMPCzmzReXge4b6fzX8` |
| CNAME | www | `apsfiltros-github-io.pages.dev` |
| A | @ | `185.199.108.153` (GitHub — replaced in step 2) |

### 1. Add the domain to Cloudflare
- Cloudflare dashboard → **Add a domain** → `apsfiltros.com.br` → **Free** plan.
- Let it scan the existing records and compare with your screenshot:
  - all 5 MX records with the same priorities, set to **DNS only** (grey
    cloud) — mail can't go through Cloudflare's proxy;
  - both TXT records, exactly as they are;
  - **delete** the imported `A @ 185.199.108.153` and any imported `www`
    record — step 2 recreates them.
- Note the **two nameservers** Cloudflare gives you.

### 2. Point the bare domain at the site
- **Workers & Pages → apsfiltros-github-io → Custom domains → Set up a custom
  domain** → `apsfiltros.com.br`. Do the same for `www.apsfiltros.com.br` if
  it isn't already listed as active. Cloudflare creates the DNS records.
- **Rules → Redirect Rules** → template *Redirect from root to WWW*:
  `apsfiltros.com.br/*` → `https://www.apsfiltros.com.br/${1}`, status 301.
  (`www` is the address the site's canonical tags use.)

### 3. (Recommended, same session) Email authentication
- **DKIM:** Google Admin → Apps → Google Workspace → Gmail → **Authenticate
  email** → generate the key, add it in Cloudflare as TXT `google._domainkey`,
  then click **Start authentication** in Google.
- **DMARC:** add TXT `_dmarc` with
  `v=DMARC1; p=none; rua=mailto:aps@apsfiltros.com.br`.
- Without these, mail from the domain is more likely to land in spam.

### 4. Switch the nameservers at registro.br
- registro.br → domain → **DNS → Alterar servidores DNS** → external servers →
  enter Cloudflare's two nameservers.
- **DNSSEC:** in the same area, make sure **no DS record is left**. registro.br
  usually removes its own when you switch to external servers, but check
  before saving. A leftover DS record makes every lookup of the domain fail.
- Changes at the .br registry usually take effect within the hour, sometimes
  a few hours. Undo = switch back to registro.br's DNS on the same screen.

### 5. Check
```
curl -sSI https://apsfiltros.com.br | grep -iE "^(HTTP|server|location)"
#   expect a 301 to https://www.apsfiltros.com.br/ from server: cloudflare,
#   with no certificate error
curl -sSI https://www.apsfiltros.com.br | grep -iE "^(HTTP|server|content-security)"
```
Send a test email **to** `aps@apsfiltros.com.br` from an outside address, and
one **from** it.

### 6. Afterwards
- Cloudflare → **DNS → Settings → DNSSEC → Enable**, then add the DS record it
  shows in registro.br's DNSSEC section — DNSSEC is back on, now signed by
  Cloudflare.
- After a day or two of everything working: GitHub repo **Settings → Pages**
  → remove the custom domain and unpublish, then delete the `CNAME` file
  from the repository (and its line in `_redirects`).

## Making the repository private

Only after the DNS move above:
- GitHub Pages on the Free plan doesn't serve private repositories, so today
  the bare domain would stop working completely.
- Cloudflare Pages keeps deploying from a private repository — it reads the
  repo through its installed GitHub app, not anonymously.
- Branch protection (below) isn't enforced on private repositories on the
  Free plan; it needs GitHub Pro or higher.

## Protecting `master`

Every change should arrive through a pull request, so CI checks it first.
GitHub → **Settings → Rules → Rulesets → New branch ruleset**:
- Enforcement status **Active**; target **Include default branch**.
- Leave the bypass list empty (or add yourself as an emergency exit).
- Rules: **Restrict deletions**, **Block force pushes**, **Require a pull
  request before merging** with required approvals **0** (GitHub doesn't let
  you approve your own PR), and **Require status checks to pass** → `build`.

## Cloudflare Pages settings worth confirming

**Workers & Pages → apsfiltros-github-io → Settings → Builds:** production
branch `master`, no build command, build output directory = repository root.

A possible later improvement: let Cloudflare run `node build.mjs` and publish
only the generated site from an output folder. Then the generated pages no
longer need committing, CI no longer pushes commits to pull requests, and the
blocking rules in `_redirects` become unnecessary. The trade-off: deploys then
depend on that build step succeeding.
