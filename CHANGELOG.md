# Changelog

本文件只记录已经完成的产品、代码、安全、运维和迁移变化。新内容先写入 `Unreleased`；生产发布后，将整段改为 `## YYYY-MM-DD`，同一天只保留一个标题。

记录规则：

- 分类只使用 `Added`、`Changed`、`Fixed`、`Security`、`Operations`、`Removed`、`Migrations`，没有内容的分类可省略。
- `Migrations` 每次必须保留，明确写“无数据库迁移”或具体命令、备份和兼容要求。
- 每条记录写结果和影响，不写开发过程、个人待办、模糊的“优化了一些内容”。
- 线上 commit、证书当前值和未完成行动不写在这里，统一维护在 `PRODUCTION_STATUS.md`。
- 部署命令不在这里重复，统一链接到 `DEPLOY_ALIYUN.md`。
- 修正已发布记录时保留原意；新版本改变旧行为时，在新版本新增一条，不改写历史。

## Unreleased

### Changed

- 将移动端布局改为紧凑顶部导航，并补充当前导航、进度条和文件操作的可访问性状态。
- Dashboard 趋势只统计已有评分的数据，分别展示写作正确率和口语得分，不再将未评分记录绘制为 0。
- 将空白作业状态文案从 `还没做:3` 统一为 `还没做`。
- Kimi 增加输入字符上限，并对网络错误、超时、HTTP 429 和 5xx 使用有限重试。

### Fixed

- 写作和口语详情 API、页面按 `AssignmentType` 隔离，错误类型 ID 不再读取、修改或删除另一类作业。
- 写作 AI 重试增加并发占用、答案/批阅保护、零题保护和事务内二次检查，避免覆盖用户工作。
- 保存相同写作答案时保留原批阅，选择相同选项时不再重复请求。
- 新增或删除学生录音时，使旧口语评分失效并原子重算作业汇总；没有学生录音时禁止批阅。
- 口语本地拆句保留末尾没有句号的最后一句。
- 修复录音请求、上传、删除、重录、组件卸载和 Object URL 的竞态与资源清理。
- 修复独立 TypeScript 检查失败，并新增统一的 `typecheck` / `check` 命令。

### Security

- 登录后的 `next` 参数只允许安全的站内路径，阻止开放重定向和 `javascript:` 等协议注入。
- 上传改为扩展名与 MIME 明确配对校验；不安全的内嵌类型强制下载，文件响应增加 `nosniff` 并禁用敏感缓存。
- 增加全站 `Referrer-Policy`、`X-Frame-Options`、`Permissions-Policy` 和 `nosniff` 响应头。
- 升级 Next.js 15.5、Undici、PostCSS 和 Sharp 的安全修复版本，生产依赖审计降为 0 项。

### Operations

- 生产运行时基线改为 Node.js 24 LTS，并增加 `.nvmrc`、`engines` 和生产环境变量预检。
- 发布脚本改用 fast-forward 拉取，拒绝覆盖 tracked 改动，执行完整检查；schema 更新前创建一致性 SQLite 备份，重启后验证健康接口。
- 部署手册改为低权限 systemd 服务、登录限流、可信代理头、备份/恢复、发布回滚和完整证书换发 runbook。
- 重新划分 README、部署手册、生产状态和 CHANGELOG 的记录职责与维护规则。

### Removed

- 删除未接入的 AI fallback、历史口语 AI 提示词、旧口语录音组件、未使用类型和 PM2 配置，并移除 `gray-matter`。

### Migrations

- 无数据库 schema 迁移。
- 生产发布前需升级到 Node.js 22+（推荐 24），补充 `KIMI_MAX_INPUT_CHARS`，并按部署手册核验低权限 systemd 用户和 Nginx 配置。

## 2026-07-27

### Operations

- 完成 `vietkiet.cn` 与 `www.vietkiet.cn` 生产 TLS 证书换发；从公网确认两个 SNI 返回同一张新证书、完整双域名 SAN 和新指纹，站点重定向及数据库健康接口正常。
- 将当前证书有效期、指纹和验证时间同步到生产状态，并补充换证后暂存私钥清理、旧证书吊销判断及 30/14/7 天监控要求。

### Migrations

- 无数据库 schema 迁移。

## 2026-07-09

### Changed

- Added derived assignment and per-item progress states across writing and speaking pages: `还没做:3`, `还没做完！`, `未批阅`, `批阅中`, and `已批阅`.
- Dashboard recent assignments, assignment list cards, detail headers, writing question cards, speaking sentence chips, and review navigation cards now show the richer progress states.

### Fixed

- Fixed reading-comprehension multiple-choice answers so selecting an option for a later sub-question no longer overwrites earlier sub-question answers.
- Fixed writing assignment text extraction and display for Chinese content that was decoded as Latin-1 mojibake, such as `ÄÑÊÜ` instead of `难受`.
- Added GBK/GB18030 fallback decoding for writing TXT/Markdown uploads and mojibake repair for RTF, DOC, DOCX, and stored writing structure text.

## 2026-07-08

### Changed

- Limited writing assignment uploads to TXT, Word, Markdown, and RTF files.
- Removed Kimi Files API extraction from the writing upload path; writing uploads now extract supported files locally before Kimi structuring.
- Added writing review navigation cards for detected exercise headings such as `练习 13：句型转换`.
- Changed writing multiple-choice options to clickable answers that save immediately.
- Moved writing answer save controls next to the relevant answer input area to reduce vertical space.

## 2026-06-21

### Added

- Added a dedicated reading-comprehension display type for writing assignments, with a two-panel layout that separates reading passages from answer requirements and options.

### Changed

- Updated the writing structuring prompt so Kimi can mark reading-comprehension questions as `reading`.

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
