# Production Status

Last updated: 2026-05-18

This file records the current real-world production state for VietTutor Studio. Use it with:

- `CHANGELOG.md`: version-by-version project changes.
- `DEPLOY_ALIYUN.md`: repeatable Alibaba Cloud deployment procedure.
- `PRODUCTION_STATUS.md`: current server facts, operational notes, and known pitfalls.

## Current Production URLs

- `https://vietkiet.cn`
- `https://www.vietkiet.cn`

Expected behavior:

- HTTPS is enabled for both domains.
- Unauthenticated page requests redirect to `/login`.
- `https://vietkiet.cn/api/health` should return HTTP `200`.

## Server Snapshot

- Provider: Alibaba Cloud ECS.
- OS: Alibaba Cloud Linux 3.
- App directory: `/var/www/VietTutor-Studio`.
- Runtime: Next.js 15 on Node.js.
- Process manager: `systemd`.
- Active service: `vietutor-studio`.
- App port: `3000`.
- Reverse proxy: Nginx.
- Active Nginx config: `/etc/nginx/conf.d/viettutor.conf`.

Production does not use PM2. PM2 was attempted earlier, but the final stable setup uses `systemd`.

## Repository State

Latest repository commit documented by this status file:

- `e8a2549` - `Remove writing review status badges`

Do not assume the server is on this exact commit without checking it directly:

```bash
cd /var/www/VietTutor-Studio
git rev-parse --short HEAD
git log --oneline -n 3
```

## Data And Storage

- Database: SQLite.
- SQLite file: `/var/www/VietTutor-Studio/prisma/dev.db`.
- Upload directory: `/var/www/VietTutor-Studio/uploads`.
- Environment file: `/var/www/VietTutor-Studio/.env`.

Back up `prisma/dev.db` and `uploads` before risky deployments or schema changes.

## Current Application Behavior

Writing assignment upload:

- Uploads should return quickly and enter the assignment detail page.
- Kimi document structuring runs after upload.
- While structuring is still pending, the detail page shows a pending notice and a manual refresh button.
- Automatic polling is intentionally not enabled.
- If Kimi returns `finish_reason=length`, the app accepts the fallback structure and records the truncation note instead of blocking the upload.

Writing assignment detail page:

- Answer and review textareas start at one-line height and grow with entered content.
- Student answer text is larger and bold.
- The right-side overall review panel is narrower than before and scrolls internally when content is long.
- Overall review cards can jump to the corresponding assignment section.
- Section state is color-coded: pending/incomplete states are visually distinct from completed states.
- The explicit `未批阅` status badge was removed from the overall review cards.
- A `只看错题` toggle is available.

AI configuration:

- `KIMI_MAX_TOKENS` is configurable in the server `.env`.
- The user intended to set production to `KIMI_MAX_TOKENS="16384"` after seeing length-limited Kimi responses.
- `.env` is server-local and is not committed to Git.

## HTTPS Certificate

HTTPS uses manually deployed Alibaba Cloud personal test certificates.

Certificate coverage:

- `vietkiet.cn`
- `www.vietkiet.cn`

Server paths:

- Certificate: `/etc/nginx/ssl/vietkiet.cn/fullchain.pem`
- Private key: `/etc/nginx/ssl/vietkiet.cn/privkey.pem`

Certificate replacement procedure:

```bash
nginx -t
systemctl reload nginx
```

The free personal test certificate is short-lived. Replace it before expiry.

## Service Commands

Application service:

```bash
systemctl status vietutor-studio --no-pager
systemctl restart vietutor-studio
journalctl -u vietutor-studio -n 100 --no-pager
```

Nginx:

```bash
nginx -t
systemctl reload nginx
systemctl status nginx --no-pager
```

Health checks:

```bash
curl -I http://127.0.0.1:3000
curl -I https://vietkiet.cn/api/health
curl -I https://www.vietkiet.cn
```

## Release Flow

Normal update:

```bash
cd /var/www/VietTutor-Studio
bash scripts/deploy.sh
```

Update with Prisma schema changes:

```bash
cd /var/www/VietTutor-Studio
bash scripts/deploy.sh --with-db-push
```

The script installs dependencies from `package-lock.json`, builds the app, and restarts `vietutor-studio`.

## Known Pitfalls

- PM2 should not be reintroduced unless there is a deliberate migration plan.
- An old service named `viettutor.service` previously relaunched `npm run start` and caused port `3000` conflicts.
- `certbot` validation was unreliable in this environment; the stable HTTPS path is manual Alibaba Cloud certificate deployment.
- Nginx `504 Gateway Time-out` during writing upload usually means the upstream Next.js request exceeded proxy timeout, often because AI structuring was blocking the response.
- Browser-side `Failed to find Server Action` logs can occur after deployments when an old page submits against a newer build; refreshing the browser usually clears it.
- `KIMI_MAX_TOKENS` changes require editing the server `.env` and restarting `vietutor-studio`.

## Verification

Local development checks used in this project:

```bash
npm run test
npm run build
```

Known non-blocking build warning:

- `src/app/materials/[id]/page.tsx` uses `<img>` and Next.js suggests `next/image`.

## Handoff Checklist

For another agent or engineer taking over:

- Start by reading `CHANGELOG.md`, `DEPLOY_ALIYUN.md`, and this file.
- Check local Git status before editing because `.env.example` may have uncommitted local environment-example changes.
- On the server, verify the active commit before assuming production matches GitHub `main`.
- Treat `/var/www/VietTutor-Studio/.env`, `prisma/dev.db`, and `uploads` as server-local operational state.
- Use `bash scripts/deploy.sh` for code-only releases.
- Use `bash scripts/deploy.sh --with-db-push` only when Prisma schema changes are included.
