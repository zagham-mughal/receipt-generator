# VPS Inventory — what is on the box

A snapshot of **the server's current state**: what is installed, what is
deployed, and which ports are taken. Nothing here explains *how* to deploy — that
is [`my-sites/VPS_PLAYBOOK.md`](my-sites/VPS_PLAYBOOK.md) for server conventions,
and each app's own `DEPLOY.md` for its specifics.

**Last verified:** 2026-09-24 · **Host:** single VPS, IP via `curl -4 ifconfig.me`

---

## 1. Deployed applications

| App | Domains | Path on server | Process (port) | Database |
|---|---|---|---|---|
| **dispatchers-sites** | gdgtransport.ca<br>gdgpetro.ca<br>eliteserv.ca<br>(each with `www` + `api`) | `/var/www/dispatchers-sites` | `form-api` — Node/Express (8787) | — |
| **load-sheet-generator** | loadsheets.softrucking.com<br>(+ `www`) | `/var/www/load-sheet-generator` | `load-sheet-generator` — Puma/Rails (8788) | `load_sheet_generator_production` |
| **pdf-tuner** | pdftuner.softrucking.com<br>(+ `www`) | `/var/www/pdf-tuner` | `pdf-tuner` — Uvicorn/FastAPI (8789) | `pdf_tuner_production` |
| **savereel** | savereel.net<br>(+ `www`) | `/var/www/savereel` | `savereel-web` — Next.js (8790)<br>`savereel-worker` — Node/Express + yt-dlp (8791) | — |

**9 + 2 + 2 + 2 = 15 hostnames** resolve to this box, each covered by a Let's
Encrypt cert. One certificate per app.

savereel's certificate is issued by certbot on the box like every other app's,
even though Cloudflare proxies its traffic. It has to be a real, publicly
trusted certificate, because Cloudflare runs in Full (strict) mode. Renewal
uses the HTTP-01 challenge through Cloudflare. If renewal fails, check
Cloudflare → Rules for a `www` redirect that catches `/.well-known/acme-challenge/`.

Local repo → server mapping is not one-to-one: the directory `my-sites/` in this
repo deploys as **`dispatchers-sites`** on the server.

### dispatchers-sites
Three Astro static sites served directly by Nginx from `sites/*/dist/`, plus one
shared Node backend handling contact-form submissions for all three.

- Each site posts to its **own** API subdomain (`api.gdgtransport.ca`, etc.) —
  all three resolve to the same box and the same `form-api` process.
- `form-api` relays mail through **Brevo SMTP**, sending `no-reply@<domain>` →
  `info@<domain>` per site.
- Nginx: `/etc/nginx/sites-available/dispatchers-sites`
- Details: [`my-sites/DEPLOY.md`](my-sites/DEPLOY.md)

### load-sheet-generator
Rails 8.1 monolith generating load-sheet PDFs. First Ruby app on this box — it is
what added PostgreSQL and rbenv to the server.

- Runs from `run-puma.sh`, **not** a bare PM2 command: PM2's daemon inherits
  neither rbenv's shims nor `.env`.
- Config comes from `.env` only — `SECRET_KEY_BASE` and `DATABASE_URL`. There is
  no `config/master.key` on the server.
- Postgres over **TCP** (`127.0.0.1:5432`), never the Unix socket.
- **Sends no email** — auth is sign-in only, no sign-up and no password reset, so
  it uses no Brevo sender. Accounts are created via `bin/rails console`.
- Nginx: `/etc/nginx/sites-available/load-sheet-generator`
- Details: [`load-sheet-generator/DEPLOY.md`](load-sheet-generator/DEPLOY.md)

### pdf-tuner
FastAPI app that rewrites a PDF's `/CreationDate` and `/ModDate`, stamping both
with a US Eastern offset. First **Python** app on this box — it is what added
`python3-venv` to the server.

- Runs from `run-uvicorn.sh`, **not** a bare PM2 command: PM2's daemon inherits
  neither the virtualenv (`/var/www/pdf-tuner/.venv`) nor `.env`.
- Config comes from `.env` only — `PDF_TUNER_SECRET_KEY` and
  `PDF_TUNER_DATABASE_URL`. With `PDF_TUNER_ENV=production` the app **refuses to
  start** without a 32+ character secret key.
- Postgres over **TCP** (`127.0.0.1:5432`), never the Unix socket.
- **No build step** — the two static assets are served by Nginx off disk and the
  HTML is rendered per request. A redeploy is `git pull` + `pm2 restart`.
- **Sends no email** — auth is sign-in only, no sign-up and no password reset,
  so it uses no Brevo sender. Accounts are created with `./manage.py create-user`.
- The Nginx block needs `client_max_body_size 100m` (100 MB uploads) and must
  set `X-Real-IP` — the login throttle keys on it.
- Nginx: `/etc/nginx/sites-available/pdf-tuner`
- Details: [`pdf-tuner/DEPLOY.md`](pdf-tuner/DEPLOY.md)

### savereel
SaveReel: free creator tools and a TikTok / Instagram / Facebook / X video
downloader. Migrated from Railway. It's the first app on this box with **two
processes**, the first behind the **Cloudflare proxy**, and it's what added
ffmpeg, yt-dlp and Playwright Chromium to the server.

- **Two PM2 processes**, each started from its own run script. PM2's daemon
  doesn't read `.env`, so a bare PM2 command won't work.
  - `savereel-web`: Next.js 15 on 8790, started by `run-web.sh`. It's the
    only one Nginx proxies to.
  - `savereel-worker`: yt-dlp + ffmpeg on 8791, started by `run-worker.sh`.
    Only web talks to it, using HMAC-signed requests (`INTERNAL_SECRET`).
- **Two `.env` files**, `web/.env` and `worker/.env`. They must hold the **same
  `INTERNAL_SECRET`**, or every download fails.
- **The build bakes in `NEXT_PUBLIC_*` values.** After changing one, run
  `npm run build`; a restart alone keeps the old value. A redeploy is
  `git pull` + `npm ci` + both builds + `pm2 restart` (≈1–2 GB RAM spike during
  `next build`).
- **No database.** Its external services (Firebase, Stripe, Upstash, Turnstile)
  are all configured from `web/.env`.
- **Persistent data** in `/var/www/savereel/data/`: `cookies/cookies.txt`
  (mode 600, platform login sessions) and `cookie-profile/` (headless Chromium
  profile).
  - The worker's cookie keeper re-exports the cookies every 6 h.
  - A platform logout means a fresh `cookies:login` on a Mac, then `scp`.
- **Self-updating yt-dlp** at `/var/www/savereel/bin/yt-dlp`, owned by
  `deploy`. The worker replaces it every 12 h (nightly channel).
- **Downloads stream through Nginx.** The block has `proxy_buffering off` and
  300 s timeouts. Temp files go to `/tmp/cd-*` and are removed after each
  download.
- **Heaviest bandwidth user on the box.** Every download comes in from the
  platform and goes back out to the user.
- **DNS is at Cloudflare**, proxied (orange), SSL mode **Full (strict)**. The
  Nginx block needs Cloudflare's real-IP ranges, or every visitor shares one
  rate-limit bucket.
- Nginx: `/etc/nginx/sites-available/savereel`
- Details: [`DEPLOY.md`](DEPLOY.md) in the `creator-kit` repo

---

## 2. Ports in use

### Public (open in `ufw`)
| Port | Service |
|---|---|
| 22 | SSH (key-only; root login and password auth disabled) |
| 80 | Nginx — HTTP, redirects to HTTPS |
| 443 | Nginx — HTTPS, terminates TLS for every domain |

### Loopback only (`127.0.0.1`, never exposed — reached through Nginx)
| Port | Owner | Notes |
|---|---|---|
| 5432 | PostgreSQL | local connections only |
| 8787 | `form-api` (dispatchers-sites) | Node/Express |
| 8788 | `load-sheet-generator` | Puma/Rails |
| 8789 | `pdf-tuner` | Uvicorn/FastAPI |
| 8790 | `savereel-web` | Next.js; the only savereel port Nginx proxies to |
| 8791 | `savereel-worker` | Node/Express + yt-dlp; reached only by `savereel-web` |
| 8792 | _free_ | **next to assign** |

> Record any new port here **and** in the playbook's registry (§2) before using
> it, so two services can never collide.

---

## 3. Installed software

| Layer | What | Notes |
|---|---|---|
| OS | Ubuntu/Debian | `lsb_release -a` for the exact release |
| Web server | Nginx | serves static files, reverse-proxies app servers, terminates TLS |
| JS runtime | Node 20 (NodeSource) + pnpm | global |
| Ruby runtime | rbenv + Ruby 3.4.4 | installed **per-user as `deploy`**, not system-wide; each app pins its version via `.ruby-version` |
| Python runtime | distro `python3` + `python3-venv` / `python3-dev` | no version manager; each app gets its own virtualenv inside its directory (`.venv`) |
| Database | PostgreSQL | one role + one database per app that needs it |
| Process manager | PM2 | runs as `deploy`; `pm2 startup` configured so processes survive reboot |
| TLS | Let's Encrypt / certbot (`--nginx`) | auto-renews via systemd timer |
| Firewall | ufw | only the three public ports above |
| PDF engine | wkhtmltopdf | from the `wkhtmltopdf-binary` gem, not apt; needs `libxrender1`, `libxext6`, `libx11-6`, `libfontconfig1`, `libjpeg-turbo8` + DejaVu/Liberation fonts |
| Mail | Brevo SMTP relay | one account, multiple verified sender domains |
| Media | ffmpeg | from apt; used by savereel's worker to merge video+audio and extract MP3 |
| Downloader | yt-dlp | **per-app binary**, not apt or pip: `/var/www/savereel/bin/yt-dlp`, owned by `deploy` so the worker can self-update it |
| Headless browser | Playwright Chromium | browser in `deploy`'s `~/.cache/ms-playwright`; system libs from `npx playwright install-deps chromium` (root). Used by savereel's cookie keeper |
| CDN / DNS | Cloudflare | savereel.net only, proxied with SSL mode Full (strict). The other apps' domains point at the box directly |

**Notably absent:** Apache (would fight Nginx for port 80), Docker, Redis
(savereel uses hosted Upstash), and any system-wide Ruby.

---

## 4. Users, ownership, secrets

- **`deploy`** — non-root user owning and running *all* app code under
  `/var/www/`. `sudo` is used only for system tasks (`apt`, `/etc/nginx`,
  `certbot`, `ufw`, `postgres`).
- **`root`** — SSH login disabled; password authentication disabled box-wide.
- **`postgres`** — system role, used only via `sudo -u postgres`.

Every secret lives in a server-side `.env` file (mode `600`, git-ignored),
never in the repo:

| App | Secret file |
|---|---|
| dispatchers-sites | `/var/www/dispatchers-sites/services/form-api/.env` |
| load-sheet-generator | `/var/www/load-sheet-generator/.env` |
| pdf-tuner | `/var/www/pdf-tuner/.env` |
| savereel | `/var/www/savereel/web/.env` and `/var/www/savereel/worker/.env` (same `INTERNAL_SECRET` in both) |
| savereel (sessions) | `/var/www/savereel/data/cookies/cookies.txt`: not a `.env`, but holds platform login cookies, so also mode `600` |

Values are single-quoted, because these files are **sourced by bash** rather than
parsed. Passwords are generated with `openssl rand -hex 24` so they carry no
characters that break a shell line or a connection URL.

---

## 5. Quick status commands

```bash
pm2 list                                  # all five app processes, uptime, restarts
pm2 monit                                 # live CPU / RAM per process
sudo ss -ltnp                             # every listening port and its owner
sudo nginx -t && ls /etc/nginx/sites-enabled/
sudo certbot certificates                 # certs and expiry dates
sudo -u postgres psql -lqt | cut -d\| -f1 # databases
systemctl is-active nginx postgresql
sudo ufw status
df -h / && free -m                        # disk and memory headroom
```

---

## 6. Keeping this file honest

Update it whenever an app is added or removed, a port is claimed, a domain
changes, or new system software is installed. It is a **description of the
server**, so a stale entry here is worse than none — anything you cannot confirm
with the commands in §5 should be corrected or removed rather than left to rot.
