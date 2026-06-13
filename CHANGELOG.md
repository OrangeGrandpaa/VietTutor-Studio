# Changelog

## 2026-06-13

### Changed

- Matched the speaking assignment list layout and filters with the writing assignment list, including `全部`、`已批阅`、`未批阅`.
- Replaced the settings button on writing and speaking assignment detail pages with an assignment title editor.
- Removed extra helper copy from the speaking detail sentence panel and teacher pronunciation area.
- Kept the speaking sentence interaction panel fully visible on desktop by making it sticky with internal scrolling.

## 2026-06-01

### Changed

- Fixed speaking recording retry controls so `重录` keeps the current full-text or sentence recording panel open and immediately starts a new recording.
- Added `取消` controls to speaking recording panels for recording, paused, and preview-ready states so unsaved audio can be discarded without saving.

## 2026-05-31

### Added

- Added a full-text recording area on the speaking detail page so teachers can listen to a complete reading before jumping into specific problem sentences.
- Added teacher pronunciation recordings per speaking sentence, separate from student recordings.
- Added per-sentence pronunciation judgments for speaking assignments: `准确` = 10, `一般` = 5, `叽里咕噜说些什么呢` = 0.

### Changed

- Changed speaking assignments to accept `.txt` plain-text and `.rtf` rich-text uploads, then split extracted text locally into sentence units instead of calling Kimi.
- Reworked the speaking detail page into a styled reading-text panel plus a sentence interaction panel.
- Changed speaking assignment scores to the arithmetic average of reviewed sentence scores.
- Updated recording storage so full-text recordings attach to the assignment, while sentence recordings attach to individual speaking units.
- Updated dashboard and recent assignment displays to show speaking scores as points instead of percentages.

## 2026-05-28

### Changed

- Added a student-answer textarea for writing questions that do not contain `______` inline blanks, while keeping inline blank inputs for fill-in-the-blank questions.
- Changed new writing uploads to hide the local basic split and show questions only after AI structuring succeeds.

## 2026-05-26

### Changed

- Simplified the course material library so it no longer records learning progress, learning status, current page, total pages, or notes.
- Removed the course material detail cards for learning progress and progress editing.
- Removed material upload notes and page-count detection for course materials.
- Improved material preview repeat-load behavior with file cache validators and lighter detail-page data loading.
- Added optional Nginx `X-Accel-Redirect` support so protected upload downloads and previews can be served by Nginx after Next.js authentication.
- Compact course material list cards so title, labels, upload time, and actions sit on one row on wider screens.
- Added configurable Kimi request timeouts and transient retry handling for upstream header timeout failures.
- Updated dashboard course material stats to show library counts instead of progress status.

## 2026-05-25

### Added

- Added database indexes for assignment and course material list, filter, and dashboard queries.
- Added protected-file streaming with HTTP `Range` support for smoother large file, audio, video, and PDF access.

### Changed

- Paginated writing assignment, speaking assignment, and course material list pages.
- Reworked dashboard statistics to use database aggregate queries instead of loading full assignment and material tables into application memory.
- Reduced list-page database payloads by selecting only fields needed for card rendering.

## 2026-05-24

### Added

- Added automatic total-page detection for uploaded course materials where the file type exposes a page or slide count.

### Changed

- Compact course material detail layout by narrowing the progress form and reducing the learning-position card height.
- Simplified course progress editing so teachers enter only the current page; completion percentage is calculated from the detected total page count.
- Reduced the course progress note field to one-line height with auto-growth as more text is entered.

## 2026-05-22

### Changed

- Replaced writing detail `______` blanks with inline answer inputs that start at the blank width and expand with typed content.
- Removed the separate writing student-answer textarea and moved answer saving beside the inline blank inputs.
- Improved writing structuring guidance and normalization so question bodies drop internal blank lines, while assignment and part names are kept in Chinese.
- Updated writing fallback titles and part labels to use Chinese defaults.

## 2026-05-18

### Added

- Added writing assignment list filters for all, reviewed, and unreviewed records.
- Added an `AI结构化中` status badge for writing assignments still being structured by AI.
- Added fuller AI structuring failure details on writing assignment detail pages.

### Changed

- Compact writing assignment list cards by removing helper copy and tightening action placement.
- Moved the writing detail wrong-answer filter into the top status area.
- Removed redundant writing detail cards for question filtering and original upload summary.
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
