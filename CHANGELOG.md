# Changelog

## 2026-05-07

### Added

- Added Alibaba Cloud deployment guide in `DEPLOY_ALIYUN.md`
- Added production handoff notes in `PRODUCTION_STATUS.md`
- Added server release helper script in `scripts/deploy.sh`
- Added structured application logger and lightweight audit logging helpers
- Added `/api/health` endpoint for basic runtime and database health checks
- Added `Vitest` test runner configuration and initial unit tests

### Changed

- Simplified Prisma schema by removing currently unused fields from `Assignment`, `TeacherFeedback`, `SpeakingFeedback`, and `CourseMaterial`
- Simplified AI prompt output and fallback payloads to match the active product surface
- Removed dead API parameters, dashboard references, and page display hooks tied to deleted schema fields

### Operations

- Schema-changing releases now require `npm run db:push` during deployment
- Latest deployed production commit at the time of writing: `696d9f8`
