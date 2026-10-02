# Deploying receipt-generator

How to deploy this app to the shared VPS, and how to update it afterwards.
Server-wide conventions (the `deploy` user, PM2, Nginx, certbot, port registry)
are described in the VPS inventory (`VPS_INVENTORY.md`); this file covers only
what is specific to this app.

Throughout this guide, **`receipts.example.com`** stands for the app's real
hostname. Replace it everywhere.

---

## At a glance

| | |
|---|---|
| Path on server | `/var/www/receipt-generator` |
| Process | PM2 app `receipt-generator`, runs `node dist/server.js` |
| Port | `127.0.0.1:8792` (loopback only; Nginx proxies to it) |
| Database | SQLite at `data/companies.db`, **rebuilt from seed data on every start** |
| Secrets | `/var/www/receipt-generator/.env` (`ADMIN_PASSWORD`, `SESSION_SECRET`) |
| Login | single user `admin`, password = `ADMIN_PASSWORD` |
| Nginx | `/etc/nginx/sites-available/receipt-generator` |

---

## How the app is configured

Configuration comes from two files with separate jobs:

- **`ecosystem.config.js`** (committed) tells PM2 how to run the app: which file
  to start (`dist/server.js`), how many copies (exactly 1), restart on crash or
  if memory passes 1 GB, where logs go (`logs/`), and the non-secret settings
  `NODE_ENV=production`, `PORT=8792`, `HOST=127.0.0.1`. Without it you would
  have to pass all of this on the `pm2 start` command line each time.
- **`.env`** (server only, git-ignored, mode `600`) holds the secrets. The app
  reads it itself at startup, so PM2 doesn't need to know about it. Template:
  [`.env.example`](.env.example).

| Variable | Where | Purpose |
|---|---|---|
| `NODE_ENV` | ecosystem | `production` makes `SESSION_SECRET` mandatory |
| `PORT` | ecosystem | listen port (default 3001 when unset, e.g. locally) |
| `HOST` | ecosystem | listen address (default `0.0.0.0` when unset) |
| `ADMIN_PASSWORD` | `.env` | password for the `admin` login. **Required**; the app exits without it |
| `SESSION_SECRET` | `.env` | signs session cookies. 32+ chars, required in production |

---

## First-time deployment

### 1. DNS

Create **A** records for `receipts.example.com` and `www.receipts.example.com`
pointing at the server's IP (`curl -4 ifconfig.me` on the server). Use DNS only,
not the Cloudflare proxy. DNS must resolve before step 8.

### 2. Check the server

```bash
ssh deploy@<server-ip>

sudo ss -ltnp | grep 8792 || echo "8792 free"   # must be free
node -v                                          # v20.x or newer
pm2 -v
```

`bcrypt` and `better-sqlite3` normally download prebuilt binaries. If `npm ci`
later fails while compiling either of them, install the toolchain and retry:

```bash
sudo apt-get install -y build-essential python3
```

### 3. Give the server read access to the repo

Use a read-only deploy key. Never clone with a personal access token in the URL.

```bash
ssh-keygen -t ed25519 -C "deploy@vps receipt-generator" -f ~/.ssh/receipt_generator -N ""
cat ~/.ssh/receipt_generator.pub
```

Add the printed key on GitHub: **repo → Settings → Deploy keys → Add deploy
key** (leave "Allow write access" unticked). Then:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github-receipt-generator
  HostName github.com
  IdentityFile ~/.ssh/receipt_generator
EOF
```

### 4. Clone

```bash
sudo mkdir -p /var/www/receipt-generator
sudo chown deploy:deploy /var/www/receipt-generator
git clone git@github-receipt-generator:zagham-mughal/receipt-generator.git /var/www/receipt-generator
cd /var/www/receipt-generator
```

### 5. Create `.env`

```bash
cd /var/www/receipt-generator
cat > .env <<EOF
ADMIN_PASSWORD='$(openssl rand -hex 24)'
SESSION_SECRET='$(openssl rand -hex 32)'
EOF
chmod 600 .env
cat .env    # note the ADMIN_PASSWORD; it's the admin login
```

Store the admin password in your password manager. Never reuse a password that
has been committed to git.

### 6. Install and build

```bash
npm ci
mkdir -p logs
```

`npm ci` builds the app automatically through the `postinstall` script: it
compiles the frontend (`public/*.ts`) and the backend (`src/` → `dist/`). There
is no separate build step. Don't use `npm run dev` on the server.

### 7. Start with PM2

```bash
pm2 start ecosystem.config.js
pm2 save                 # remember it across reboots
pm2 logs receipt-generator --lines 30
```

The log should show `Server running at: http://localhost:8792`. If it shows
`ADMIN_PASSWORD is not set` or `SESSION_SECRET must be at least 32 characters`,
fix `.env` (step 5) and run `pm2 restart receipt-generator`.

Check it locally on the server:

```bash
curl -s http://127.0.0.1:8792/api/companies
# {"error":"Authentication required"}   ← correct, the API needs a login
```

### 8. Nginx

```bash
sudo tee /etc/nginx/sites-available/receipt-generator >/dev/null <<'EOF'
server {
    listen 80;
    server_name receipts.example.com www.receipts.example.com;

    location / {
        proxy_pass http://127.0.0.1:8792;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/receipt-generator /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**Optional:** to put a second password in front of everything, including the
generated PDFs under `/receipts/` (which the app's login does not protect), add
HTTP basic auth:

```bash
printf "admin:$(openssl passwd -apr1 'CHOOSE_A_PASSWORD')\n" | sudo tee /etc/nginx/receipt-generator.htpasswd
sudo chown root:www-data /etc/nginx/receipt-generator.htpasswd
sudo chmod 640 /etc/nginx/receipt-generator.htpasswd
```

Then add these two lines inside the `server { … }` block, and run
`sudo nginx -t && sudo systemctl reload nginx`:

```nginx
    auth_basic "Receipt Generator";
    auth_basic_user_file /etc/nginx/receipt-generator.htpasswd;
```

### 9. HTTPS

```bash
sudo certbot --nginx -d receipts.example.com -d www.receipts.example.com
```

certbot adds the 443 block and the HTTP → HTTPS redirect, and renews the
certificate automatically.

### 10. Verify

1. Open `https://receipts.example.com`. You should get the login page.
2. Log in as `admin` with the `ADMIN_PASSWORD` from `.env`.
3. Generate a test receipt and download the PDF.

### 11. Clean up old PDFs automatically

Every generated receipt is written to `receipts/` and never deleted. This daily
job removes PDFs older than 7 days:

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * find /var/www/receipt-generator/receipts -name '*.pdf' -mtime +7 -delete") | crontab -
```

### 12. Record it in the VPS inventory

Update `VPS_INVENTORY.md` (and the playbook's port registry):

- Add a `receipt-generator` row under deployed applications.
- Mark port 8792 as taken, and 8793 as next to assign.
- Increase the hostname count by 2.
- Increase the app process count in the status commands by 1.
- Add the `.env` path to the secrets table.

---

## Redeploying (after new commits are pushed)

```bash
cd /var/www/receipt-generator
git pull
npm ci                              # reinstalls and rebuilds
pm2 restart receipt-generator
pm2 logs receipt-generator --lines 20
```

If `ecosystem.config.js` itself changed, `restart` won't pick up the change.
Use this instead:

```bash
pm2 delete receipt-generator && pm2 start ecosystem.config.js && pm2 save
```

---

## Operations

```bash
pm2 status                              # is it running?
pm2 logs receipt-generator              # live logs (also in logs/)
pm2 restart receipt-generator           # restart
sudo ss -ltnp | grep 8792               # is it listening?
sudo certbot certificates               # certificate expiry
du -sh /var/www/receipt-generator/receipts   # PDF disk usage
```

**Change the admin password:** edit `ADMIN_PASSWORD` in `.env`, then
`pm2 restart receipt-generator`. The admin user is recreated from `.env` on
every start.

**Rotate the session secret:** edit `SESSION_SECRET` in `.env`, then restart.
Everyone is logged out.

---

## Things to know

- **The database resets on every start.** On startup the app drops the
  companies, stores and users tables and re-seeds them from code. Companies
  added or edited through the UI are lost on every restart, redeploy or reboot.
  Make permanent changes in the seed data in `src/database.ts`.
- **Sessions are kept in memory**, so a restart logs everyone out. That's also
  why `instances` must stay at `1`. The `MemoryStore is not designed for a
  production environment` warning in the logs is expected.
- **Generated PDFs at `/receipts/<file>.pdf` don't require a login.** Use the
  optional basic auth (step 8) if that matters.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| PM2 shows `errored` or keeps restarting | `pm2 logs receipt-generator --lines 50`. Usually `.env` is missing or invalid |
| `errored` but the logs show no error | Run it directly to see the error: `NODE_ENV=production PORT=8792 HOST=127.0.0.1 node dist/server.js` |
| `502 Bad Gateway` | App not running or not on 8792: `pm2 status`, `sudo ss -ltnp \| grep 8792` |
| `npm ci` fails on `bcrypt` / `better-sqlite3` | `sudo apt-get install -y build-essential python3`, then `npm ci` again |
| certbot fails | DNS not pointing at the server yet: `dig +short receipts.example.com` |
