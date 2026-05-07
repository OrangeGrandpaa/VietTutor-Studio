# Production Status

Last updated: 2026-05-07

This file is a handoff summary of the current deployment state for this project.
Use it together with `DEPLOY_ALIYUN.md`:

- `DEPLOY_ALIYUN.md`: generic deployment procedure
- `PRODUCTION_STATUS.md`: current real-world server state and operational notes

## Current production URLs

- https://vietkiet.cn
- https://www.vietkiet.cn

Current expected behavior:

- Both URLs respond over HTTPS
- Requests redirect to `/login` when unauthenticated
- The `/login` redirect is expected application behavior, not a deployment error

## Production server

- Provider: Alibaba Cloud ECS
- OS: Alibaba Cloud Linux 3
- App directory: `/var/www/VietTutor-Studio`
- App runtime: Next.js 15
- Process manager in production: `systemd`
- Active service name: `vietutor-studio`
- Listening port: `3000`
- Reverse proxy: `Nginx`

Important:

- Production does **not** use PM2
- `ecosystem.config.cjs` exists in the repo, but the final production setup switched to `systemd`

## Data and storage

- Database: SQLite
- SQLite file: `/var/www/VietTutor-Studio/prisma/dev.db`
- Upload directory: `/var/www/VietTutor-Studio/uploads`

These paths contain production data and should be backed up before risky changes.

## Environment and build status

The following were completed successfully on the server:

- `npm ci`
- `npm run db:init`
- `npm run build`

The application was verified locally on the server with:

- `curl -I http://127.0.0.1:3000`
- `curl -I https://vietkiet.cn`
- `curl -I https://www.vietkiet.cn`

## systemd service

Production is managed by `systemd`.

Useful commands:

```bash
systemctl status vietutor-studio --no-pager
systemctl restart vietutor-studio
journalctl -u vietutor-studio -n 100 --no-pager
```

## Nginx

Active Nginx site config:

- `/etc/nginx/conf.d/viettutor.conf`

Behavior:

- HTTP on port `80` redirects to HTTPS
- HTTPS on port `443` proxies to `http://127.0.0.1:3000`

Useful commands:

```bash
nginx -t
systemctl reload nginx
systemctl status nginx --no-pager
```

## TLS certificate

HTTPS was deployed manually with an Alibaba Cloud certificate.

Certificate coverage:

- `vietkiet.cn`
- `www.vietkiet.cn`

Deployed certificate paths on the server:

- `/etc/nginx/ssl/vietkiet.cn/fullchain.pem`
- `/etc/nginx/ssl/vietkiet.cn/privkey.pem`

Notes:

- Manual server-side deployment was used instead of Alibaba Cloud platform auto-deployment
- The free Alibaba Cloud personal test certificate is short-lived and needs manual replacement before expiry

Certificate reload procedure after replacement:

```bash
nginx -t
systemctl reload nginx
```

## Known deployment history / pitfalls

These issues were already encountered during setup:

1. PM2 was attempted first, but the environment left behind child `next-server` processes and repeatedly caused `EADDRINUSE` on port `3000`.
2. An older service named `viettutor.service` existed on the server and interfered with startup by relaunching `npm run start`.
3. Final production management was changed to `systemd` service `vietutor-studio`.
4. `certbot` HTTP validation paths were unreliable in this environment, so the final HTTPS setup used Alibaba Cloud certificates and manual deployment.

If port `3000` unexpectedly appears occupied in future debugging, first check for stray old services before changing app code.

## Recommended release flow

For normal application updates:

```bash
cd /var/www/VietTutor-Studio
git pull
npm ci
npm run build
systemctl restart vietutor-studio
systemctl status vietutor-studio --no-pager
```

If Prisma schema changes were made:

```bash
npm run db:push
```

Repository helper script:

```bash
bash scripts/deploy.sh
```

If the release includes Prisma schema changes:

```bash
bash scripts/deploy.sh --with-db-push
```

## Recommended backup scope

Before risky changes, at minimum back up:

- `/var/www/VietTutor-Studio/prisma/dev.db`
- `/var/www/VietTutor-Studio/uploads`
- `/etc/nginx/conf.d/viettutor.conf`
- `/etc/nginx/ssl/vietkiet.cn/`

## Quick handoff checklist

If another agent or engineer takes over, these are the minimum facts they need:

- Production is already live at `vietkiet.cn` and `www.vietkiet.cn`
- The server OS is Alibaba Cloud Linux 3
- The app runs from `/var/www/VietTutor-Studio`
- The active process manager is `systemd`, not PM2
- The active service name is `vietutor-studio`
- The active Nginx config is `/etc/nginx/conf.d/viettutor.conf`
- HTTPS is already working
- Production data lives in SQLite plus `uploads`
