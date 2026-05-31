# Production Status

Last updated: 2026-05-31

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

Latest repository state documented by this status file:

- Course materials no longer store learning progress, learning status, page counts, or notes; material detail pages only show metadata, download, and preview.
- Assignment and material list pages are paginated, dashboard metrics use database aggregates, and protected file responses support streaming with HTTP `Range` plus optional Nginx `X-Accel-Redirect`.
- Writing detail page inline-blank answer inputs and Chinese structuring-name normalization are included in the documented behavior.
- Speaking assignments accept TXT only, split sentences locally without Kimi, support full-text recordings, per-sentence student recordings, teacher pronunciation recordings, and 10/5/0 pronunciation judgments.

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
- Protected upload acceleration prefix: `PROTECTED_FILE_ACCEL_REDIRECT_PREFIX="/_protected_uploads/"` when the matching internal Nginx location is enabled.

Back up `prisma/dev.db` and `uploads` before risky deployments or schema changes.

## Current Application Behavior

Writing assignment list page:

- The list has filters for `全部`, `已批阅`, and `未批阅`.
- The list is paginated to keep page render and query time stable as history grows.
- List cards are compact and place `查看` / `删除` actions beside each assignment record.
- Assignments with pending AI processing show `AI结构化中`.

Speaking assignment list page:

- The list is paginated and only loads card-rendering fields plus the unit count.

Speaking assignment upload:

- Uploads accept only `.txt` plain-text files.
- Speaking upload no longer calls Kimi or Kimi Files API.
- The server reads the TXT content directly and locally splits it into interactive sentence units by sentence-ending punctuation such as `;` and `.`.
- Non-TXT files are rejected before assignment creation.

Speaking assignment detail page:

- The page shows a styled reading-text panel rather than AI-generated unit groups.
- The reading-text panel includes a full-text recording area so a complete long passage can be recorded and played before sentence-level review.
- Full-text recordings attach to the assignment itself and do not count as any single sentence recording.
- Each sentence opens the sentence interaction panel for student audio input, teacher pronunciation recording, and pronunciation judgment.
- Teacher judgment options are `准确`, `一般`, and `叽里咕噜说些什么呢`, scored as 10, 5, and 0 respectively.
- Sentence labels show the 0-point state as `听不懂`.
- The assignment overall score is the arithmetic average of reviewed sentence scores.

Writing assignment upload:

- Uploads should return quickly and enter the assignment detail page.
- Kimi document structuring runs after upload.
- New writing uploads do not save or display the local fallback/basic split.
- While structuring is still pending, the detail page shows only a pending notice and a manual refresh button.
- Automatic polling is intentionally not enabled.
- If Kimi returns `finish_reason=length`, the writing assignment shows the AI failure reason and can be retried after token/config changes.

Writing assignment detail page:

- Questions, wrong-answer filtering, and the overall review panel are shown only after AI structuring succeeds.
- Question `______` blanks render as inline answer inputs that start at the blank width and expand with typed content.
- Questions without `______` blanks show a student-answer textarea so every question can accept an answer.
- The old separate student-answer textarea is not shown on fill-in-the-blank questions.
- Saving inline answers clears existing review feedback for that question so stale feedback is not reused.
- Review textareas start at one-line height and grow with entered content.
- The wrong-answer filter is available in the top status area.
- The right-side overall review panel is narrower than before and scrolls internally when content is long.
- Overall review cards can jump to the corresponding assignment section.
- Section state is color-coded: pending/incomplete states are visually distinct from completed states.
- The explicit `未批阅` status badge was removed from the overall review cards.
- Redundant cards for question filtering and original upload summary are not shown.
- AI structuring failures show fuller error details when available, including nested `cause` information.
- AI structuring removes blank lines inside a single question and keeps assignment/part names in Chinese.

AI configuration:

- `KIMI_MAX_TOKENS` is configurable in the server `.env`.
- `KIMI_REQUEST_TIMEOUT_MS` and `KIMI_MAX_RETRIES` are configurable in the server `.env` for slow upstream responses or transient Kimi network failures.
- The user intended to set production to `KIMI_MAX_TOKENS="16384"` after seeing length-limited Kimi responses.
- `.env` is server-local and is not committed to Git.
- Kimi configuration currently affects writing assignment extraction/structuring; speaking assignments no longer depend on Kimi.

Course materials:

- The list is paginated, type filters use indexed queries, and cards use a compact row layout for title, labels, upload time, and actions on wider screens.
- Uploads store title, original file name, protected file path, MIME type, file type, and course material category.
- The material detail page no longer shows learning progress or progress editing cards.
- The library does not record learning status, current page, total pages, completion percentage, or notes.

Dashboard and files:

- Dashboard totals, averages, and material library counts are calculated with database aggregate queries instead of full-table application-side scans.
- Dashboard and recent-assignment cards show speaking scores as points, not percentages.
- Protected assignment, material, and recording files stream from disk and support HTTP `Range`, improving large PDF/video/audio access and reducing memory pressure.
- Protected file responses include `ETag` and `Last-Modified` so repeat previews can reuse browser cache.
- When `PROTECTED_FILE_ACCEL_REDIRECT_PREFIX` is configured, `/api/files/[id]` still performs authentication and database lookup, then returns `X-Accel-Redirect` so Nginx sends the actual upload bytes instead of the Next.js process.

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

Protected upload acceleration requires this HTTPS server location:

```nginx
location /_protected_uploads/ {
    internal;
    alias /var/www/VietTutor-Studio/uploads/;
    sendfile on;
    tcp_nopush on;
}
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

The 2026-05-25 performance update adds Prisma indexes, the 2026-05-26 course material simplification removes progress-related columns, and the 2026-05-31 speaking assignment update adds assignment-level recordings plus sentence review fields. Deploy these releases with `--with-db-push`.

The script installs dependencies from `package-lock.json`, builds the app, and restarts `vietutor-studio`.

## Known Pitfalls

- PM2 should not be reintroduced unless there is a deliberate migration plan.
- An old service named `viettutor.service` previously relaunched `npm run start` and caused port `3000` conflicts.
- `certbot` validation was unreliable in this environment; the stable HTTPS path is manual Alibaba Cloud certificate deployment.
- Nginx `504 Gateway Time-out` during writing upload usually means the upstream Next.js request exceeded proxy timeout, often because AI structuring was blocking the response.
- Browser-side `Failed to find Server Action` logs can occur after deployments when an old page submits against a newer build; refreshing the browser usually clears it.
- Kimi `HeadersTimeoutError` / `UND_ERR_HEADERS_TIMEOUT` means the upstream did not return response headers in time; it is normally not a document-format issue. Tune `KIMI_REQUEST_TIMEOUT_MS` / `KIMI_MAX_RETRIES` and restart `vietutor-studio`.
- Kimi `.env` changes such as `KIMI_MAX_TOKENS`, `KIMI_REQUEST_TIMEOUT_MS`, or `KIMI_MAX_RETRIES` require restarting `vietutor-studio`.
- Speaking uploads now require TXT. If a teacher tries to upload DOC/PDF/PPT as a speaking assignment, the upload should fail by design.

## Verification

Local development checks used in this project:

```bash
npm run test
npm run build
```

There are currently no known build warnings that should be ignored during handoff.

## Handoff Checklist

For another agent or engineer taking over:

- Start by reading `CHANGELOG.md`, `DEPLOY_ALIYUN.md`, and this file.
- Check local Git status before editing because `.env.example` may have uncommitted local environment-example changes.
- On the server, verify the active commit before assuming production matches GitHub `main`.
- Treat `/var/www/VietTutor-Studio/.env`, `prisma/dev.db`, and `uploads` as server-local operational state.
- Use `bash scripts/deploy.sh` for code-only releases.
- Use `bash scripts/deploy.sh --with-db-push` only when Prisma schema changes are included.
