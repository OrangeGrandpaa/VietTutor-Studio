# Changelog

## 2026-05-18

### Changed

- Updated documentation to match the current Alibaba Cloud Linux 3 + systemd production setup.
- Clarified release, environment, certificate, and handoff notes across deployment docs.

## 2026-05-15

### Changed

- Improved the writing assignment review page layout.
- Narrowed the right-side overall review panel and enlarged the student answer input text.
- Made the overall review panel section list scroll internally when many sections exist.
- Removed explicit review-state text badges from the overall review section cards while keeping color-coded states.

## 2026-05-13

### Added

- Added a pending AI-structuring notice on writing assignment detail pages.
- Added a manual refresh button for checking whether background AI structuring has completed.
- Added wrong-answer filtering on writing assignment detail pages.
- Added clickable section navigation from the overall review panel to the corresponding assignment section.
- Added auto-growing textareas for student answers and review notes.

### Changed

- Changed writing assignment upload to create the assignment quickly and run Kimi structuring in the background.
- Improved writing upload error reporting so server-side failures surface concrete messages in the UI.
- Added graceful handling for Kimi `finish_reason=length`; fallback structure is kept instead of showing a failure state.
- Made Kimi structured-output token limit configurable via `KIMI_MAX_TOKENS`.

## 2026-05-07

### Added

- Added Alibaba Cloud deployment guide in `DEPLOY_ALIYUN.md`.
- Added production handoff notes in `PRODUCTION_STATUS.md`.
- Added server release helper script in `scripts/deploy.sh`.
- Added structured application logger and lightweight audit logging helpers.
- Added `/api/health` endpoint for basic runtime and database health checks.
- Added `Vitest` test runner configuration and initial unit tests.

### Changed

- Simplified Prisma schema by removing currently unused fields from `Assignment`, `TeacherFeedback`, `SpeakingFeedback`, and `CourseMaterial`.
- Simplified AI prompt output and fallback payloads to match the active product surface.
- Removed dead API parameters, dashboard references, and page display hooks tied to deleted schema fields.
- Updated login page copy.

### Operations

- Schema-changing releases now require `npm run db:push` during deployment.
- Production release flow is documented around `scripts/deploy.sh`.
