# VietTutor Studio Alibaba Cloud Deployment

This document describes the current recommended deployment path for Alibaba Cloud ECS:

- Alibaba Cloud Linux 3
- Nginx
- systemd
- Next.js
- Prisma + SQLite
- Local `uploads/` storage

For the already-running production server, read `PRODUCTION_STATUS.md` first. This file is for rebuilding or reproducing the deployment.

## 1. Server Prerequisites

Recommended minimum:

- Alibaba Cloud Linux 3
- 2 vCPU / 2 GB RAM or higher
- Public IP assigned
- Security group inbound rules open for `22`, `80`, and `443`
- ICP filing completed if the ECS is in mainland China and a custom domain is used

The current production domains are:

- `vietkiet.cn`
- `www.vietkiet.cn`

## 2. Install Runtime Packages

Log in to the server:

```bash
ssh root@your-server-ip
```

Install the base packages:

```bash
dnf install -y nginx git curl
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs
node -v
npm -v
nginx -v
```

Node.js 20 LTS is preferred. Newer versions may work, but if native dependencies behave oddly, use Node.js 20.

## 3. Clone the Repository

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/OrangeGrandpaa/VietTutor-Studio.git
cd VietTutor-Studio
```

## 4. Configure Environment Variables

```bash
cp .env.example .env
vi .env
```

Required or commonly used values:

```env
DATABASE_URL="file:./dev.db"
SITE_ACCESS_PASSWORD="change-this-password"
SESSION_SECRET="replace-with-a-long-random-secret"
SESSION_MAX_AGE_DAYS="14"
KIMI_API_KEY=""
KIMI_BASE_URL="https://api.moonshot.ai/v1"
KIMI_MODEL="moonshot-v1-8k"
KIMI_MAX_TOKENS="8192"
MAX_UPLOAD_SIZE_MB="20"
```

Generate a strong session secret:

```bash
openssl rand -base64 32
```

Notes:

- `.env` is server-local and should not be committed.
- `DATABASE_URL="file:./dev.db"` stores SQLite at `prisma/dev.db`.
- `KIMI_MAX_TOKENS` controls the Kimi structured-output token budget. Production may set this higher, for example `16384`, if the selected model supports it.

## 5. Install Dependencies and Initialize Data

```bash
npm ci
npm run db:init
```

This generates Prisma Client, syncs the SQLite schema, and prepares local upload storage.

## 6. Build the App

```bash
npm run build
```

## 7. Configure systemd

Create `/etc/systemd/system/vietutor-studio.service`:

```ini
[Unit]
Description=VietTutor Studio
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/VietTutor-Studio
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node /var/www/VietTutor-Studio/node_modules/next/dist/bin/next start -p 3000
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```bash
systemctl daemon-reload
systemctl enable --now vietutor-studio
systemctl status vietutor-studio --no-pager
curl -I http://127.0.0.1:3000
```

Expected response is usually `200`, `302`, or `307` depending on auth redirects.

## 8. Configure Nginx

Create `/etc/nginx/conf.d/viettutor.conf`.

HTTP should redirect to HTTPS:

```nginx
server {
    listen 80;
    server_name vietkiet.cn www.vietkiet.cn;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        try_files $uri =404;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

HTTPS should proxy to the local Next.js app:

```nginx
server {
    listen 443 ssl http2;
    server_name vietkiet.cn www.vietkiet.cn;

    ssl_certificate /etc/nginx/ssl/vietkiet.cn/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/vietkiet.cn/privkey.pem;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        send_timeout 300s;
        client_body_timeout 300s;
    }
}
```

Apply the config:

```bash
nginx -t
systemctl reload nginx
```

## 9. HTTPS Certificate

The current production server uses a manually downloaded Alibaba Cloud Nginx certificate.

Expected paths:

```bash
/etc/nginx/ssl/vietkiet.cn/fullchain.pem
/etc/nginx/ssl/vietkiet.cn/privkey.pem
```

The certificate should cover both:

- `vietkiet.cn`
- `www.vietkiet.cn`

After replacing a certificate:

```bash
nginx -t
systemctl reload nginx
```

## 10. Release Flow

For normal releases:

```bash
cd /var/www/VietTutor-Studio
bash scripts/deploy.sh
```

If `prisma/schema.prisma` changed:

```bash
cd /var/www/VietTutor-Studio
bash scripts/deploy.sh --with-db-push
```

The script runs `git pull`, `npm ci`, optionally `npm run db:push`, `npm run build`, and restarts `vietutor-studio`.

The performance update from 2026-05-25 adds Prisma indexes, and the course material simplification from 2026-05-26 removes progress-related columns, so deploy those releases with `--with-db-push`.

## 11. Verification

```bash
systemctl status vietutor-studio --no-pager
curl -I http://127.0.0.1:3000
curl -I https://vietkiet.cn
curl -I https://www.vietkiet.cn
curl -I https://vietkiet.cn/api/health
```

## 12. Backups

At minimum, back up:

```bash
/var/www/VietTutor-Studio/prisma/dev.db
/var/www/VietTutor-Studio/uploads
/etc/nginx/conf.d/viettutor.conf
/etc/nginx/ssl/vietkiet.cn
```

Example:

```bash
tar -czf /root/vietutor-backup-$(date +%F).tar.gz \
  /var/www/VietTutor-Studio/prisma/dev.db \
  /var/www/VietTutor-Studio/uploads \
  /etc/nginx/conf.d/viettutor.conf \
  /etc/nginx/ssl/vietkiet.cn
```

## 13. Troubleshooting

Check the app:

```bash
systemctl status vietutor-studio --no-pager
journalctl -u vietutor-studio -n 100 --no-pager
ss -tlnp | grep 3000
```

Check Nginx:

```bash
nginx -t
systemctl status nginx --no-pager
tail -n 100 /var/log/nginx/error.log
```

If upload requests return `504`, confirm `proxy_read_timeout` is high enough. Writing uploads now return quickly and run AI structuring in the background, but large PDF/PPT/Excel extraction can still take longer than simple text uploads.

If Kimi structuring reports `finish_reason=length`, either increase `KIMI_MAX_TOKENS` in the server `.env` if the model supports it, or rely on the fallback structure retained by the app.
