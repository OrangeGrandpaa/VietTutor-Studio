# VietTutor Studio

VietTutor Studio 是一个面向越南语学习的私有教学工作台。它把作业上传、AI 结构化、逐题批阅、口语录音、课件进度和学习统计收在一个 Next.js 应用里，适合个人或小范围教学场景使用。

如果你是接手项目的人，建议先读本文件，再按需要查看：

- `CHANGELOG.md`：项目变更时间线。
- `DEPLOY_ALIYUN.md`：阿里云 ECS 从零部署或重建流程。
- `PRODUCTION_STATUS.md`：当前线上服务器状态、运维事实和已知坑。

## Current State

- 生产域名：`https://vietkiet.cn`、`https://www.vietkiet.cn`
- 生产环境：Alibaba Cloud Linux 3 + Nginx + systemd + Next.js
- 数据库：Prisma + SQLite
- 文件存储：本地 `uploads/`，通过鉴权 API 读取，不放入 `public/`
- AI 服务：Kimi / Moonshot，用于作业文本抽取和结构化
- 登录方式：全站访问密码 + HttpOnly 签名 Cookie + 数据库 session

生产环境不使用 PM2。仓库里保留的 `ecosystem.config.cjs` 是历史配置，当前稳定方案以 `systemd` 为准。

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Prisma 6
- SQLite
- Vitest
- Kimi / Moonshot API
- Nginx + systemd for production

主要依赖用途：

- `mammoth`：读取 `.docx` 文本。
- `word-extractor`：读取 `.doc` 文本。
- `gray-matter`：处理 Markdown frontmatter 和 fallback 拆分。
- `zod`：校验 Kimi 结构化 JSON。
- `sonner`：前端 toast。
- `recharts`：Dashboard 趋势图。
- `framer-motion`：页面进入动效。

## Quick Start

推荐使用 Node.js 20 LTS。

```bash
npm ci
cp .env.example .env
npm run db:init
npm run dev
```

打开：

```text
http://localhost:3000
```

首次本地运行时，登录密码来自 `.env` 里的 `SITE_ACCESS_PASSWORD`。

## Environment Variables

`.env.example` 已包含当前需要的环境变量：

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

说明：

- `DATABASE_URL="file:./dev.db"` 会让 SQLite 文件落在 `prisma/dev.db`。
- `SESSION_SECRET` 必须是强随机字符串，生产环境不要复用示例值。
- `KIMI_API_KEY` 为空时，依赖 Kimi 的上传或结构化路径会失败。
- `KIMI_MAX_TOKENS` 控制结构化输出 token 上限。生产可按模型能力调高，例如 `16384`。
- `MAX_UPLOAD_SIZE_MB` 控制所有受保护上传的最大文件大小。

生成 session secret：

```bash
openssl rand -base64 32
```

## Common Commands

```bash
npm run dev          # 本地开发
npm run build        # prisma generate + next build
npm run start        # 启动生产构建
npm run test         # 运行 Vitest
npm run test:watch   # 监听测试
npm run db:generate  # 生成 Prisma Client
npm run db:push      # 将 Prisma schema 推到 SQLite
npm run db:init      # 生成 Prisma Client、推 schema、创建 uploads 子目录
npm run db:seed      # 写入示例课件记录
```

注意：当前 `lint` 脚本是 `next lint`，Next.js 15 项目里如果命令不可用，需要后续迁移到 ESLint CLI。

## Project Structure

```text
.
├── src/app                 # Next.js App Router 页面和 API Routes
├── src/components          # 页面组件、业务组件和 UI primitives
├── src/lib                 # 认证、AI、作业、存储、dashboard、utils
├── src/prompts             # Kimi 结构化提示词
├── src/types               # 业务类型和第三方声明
├── prisma/schema.prisma    # SQLite 数据模型
├── scripts/init-db.ts      # 创建 uploads 子目录
├── scripts/deploy.sh       # 生产发布脚本
├── uploads/.gitkeep        # 本地上传目录占位
├── CHANGELOG.md            # 变更记录
├── DEPLOY_ALIYUN.md        # 阿里云部署手册
└── PRODUCTION_STATUS.md    # 当前生产状态
```

## Main Features

### Authentication

- `middleware.ts` 保护 `/`、`/dashboard`、`/assignments`、`/materials`、`/settings`。
- 登录页提交到 `/api/auth/login`。
- 登录成功后创建 `UserSession`，并写入 `viet_study_session` HttpOnly Cookie。
- Cookie 使用 HMAC-SHA256 签名，session token 的 hash 存入数据库。
- `/api/auth/logout` 会撤销当前 session 并清除 Cookie。

### Dashboard

Dashboard 汇总：

- 作业总数、待批阅数、已完成数。
- 写作平均正确率、口语平均分。
- 最近写作和口语作业。
- 正确率趋势。
- 课件进度和连续学习天数。

核心数据入口是 `src/lib/dashboard/get-dashboard-data.ts`。

### Writing Assignments

写作作业支持上传：

- `.md`、`.markdown`、`.txt`
- `.doc`、`.docx`
- `.pdf`
- `.ppt`、`.pptx`
- `.xls`、`.xlsx`
- `.csv`
- `.html`、`.htm`
- `.json`、`.xml`
- `.log`

处理流程：

1. 上传文件到 `uploads/assignments/writing`。
2. 从文件抽取文本。
3. 立即创建作业和 fallback 题目结构。
4. 返回详情页，页面显示“AI 正在后台结构化”。
5. 通过 Next.js `after()` 在后台调用 Kimi 重新结构化。
6. 如果 AI 成功且用户还没有填写答案/批阅，则替换为 AI 结构。
7. 如果 Kimi 返回 `finish_reason=length`，保留 fallback 结构并视为可继续使用。
8. 用户逐题输入学生答案，再标记正确/错误和批注。

重要行为：

- 写作作业列表支持 `全部`、`已批阅`、`未批阅` 三种筛选。
- AI 仍在后台结构化的作业会显示 `AI结构化中` 状态。
- AI 结构化失败时，详情页会展示完整错误信息，包括可用的底层 `cause` 字段。
- 题目中的 `______` 会在详情页渲染为内联答案输入框，输入框初始宽度匹配下划线长度，并会随输入内容延长。
- 保存学生答案会删除该题已有批阅，避免旧批阅套到新答案上；多空题答案会按空位顺序保存。
- 批阅分数当前是二值逻辑：正确 `100`，错误 `0`。
- 作业状态根据已批阅题数自动更新为 `PENDING_REVIEW`、`REVIEWING` 或 `REVIEWED`。
- 详情页顶部支持“只看错题”，右侧总体批阅可跳转到对应题目分组。
- AI 结构化和 fallback 会清理单道题目内部空行，并要求作业名称、部分名称使用中文概括。

### Speaking Assignments

口语作业也支持常见文本和复杂文档上传。

处理流程：

1. 上传文件到 `uploads/assignments/speaking`。
2. 抽取文本。
3. 同步调用 Kimi 结构化为朗读单元。
4. 如果 Kimi 失败，使用 fallback 结构并把 `aiStatus` 标记为 `FAILED`。
5. 学生可在浏览器中录音，录音保存到 `uploads/recordings`。
6. 老师对每条录音填写建议和综合分。
7. 作业综合分按已评分录音平均值计算。

注意：口语重试 AI 会删除该作业下已有朗读单元、录音和口语反馈，并删除对应录音文件。这是有数据破坏性的操作，接手时要谨慎。

### Course Materials

课件库支持上传：

- PDF、Word、PowerPoint
- Markdown / text
- 图片、音频、视频

文件保存到 `uploads/materials`。详情页会根据 MIME 类型内嵌预览图片、音频、视频和 PDF，其余类型提供下载。学习进度支持记录标题、备注、状态、当前页和由当前页/总页数计算出的完成百分比。

### Protected Files

所有上传文件都通过 `/api/files/[id]` 读取，参数如下：

```text
kind=assignment | material | recording
download=1      # 可选，强制下载
```

示例：

```text
/api/files/<assignmentId>?kind=assignment&download=1
/api/files/<materialId>?kind=material
/api/files/<recordingId>?kind=recording
```

`src/lib/storage/index.ts` 会限制读取路径必须位于 `uploads/` 内，避免路径穿越。

## AI And Extraction

作业文本抽取在 `src/lib/assignment/source-extraction.ts`：

- Markdown、txt、doc、docx 和 text/json/xml MIME 类型走本地抽取。
- PDF、PPT、Excel、CSV、HTML、JSON、XML、log 等复杂格式走 Kimi Files API。

Kimi 调用在 `src/lib/ai/kimi.ts`：

- `/files` 和 `/files/{id}/content` 用于复杂文件抽取。
- `/chat/completions` 用于结构化写作/口语内容。
- 结构化返回必须是 JSON，并通过 Zod schema 校验。

Fallback 在 `src/lib/ai/fallback.ts`：

- 写作 fallback 按标题、编号、字母序号、列表项等拆题。
- 口语 fallback 按段落和行拆朗读单元。

提示词在：

- `src/prompts/writing-assignment-structure.prompt.ts`
- `src/prompts/speaking-assignment-structure.prompt.ts`

## Data Model

主要 Prisma 模型：

- `UserSession`：登录 session。
- `Assignment`：写作或口语作业主表。
- `AssignmentSection`：写作题目。
- `TeacherFeedback`：写作题目批阅。
- `SpeakingUnit`：口语朗读单元。
- `Recording`：口语录音文件。
- `SpeakingFeedback`：口语录音批阅。
- `CourseMaterial`：课件和学习进度。

SQLite 文件默认位置：

```text
prisma/dev.db
```

本地和生产都要把 SQLite 文件视为真实数据，不要误删或随意覆盖。

## API Overview

认证：

- `POST /api/auth/login`
- `POST /api/auth/logout`

健康检查：

- `GET /api/health`

Dashboard：

- `GET /api/dashboard`

文件：

- `GET /api/files/[id]?kind=assignment|material|recording`

写作：

- `GET /api/assignments/writing`
- `POST /api/assignments/writing`
- `GET /api/assignments/writing/[id]`
- `PATCH /api/assignments/writing/[id]`
- `DELETE /api/assignments/writing/[id]`
- `PATCH /api/assignments/writing/[id]/answer`
- `POST /api/assignments/writing/[id]/feedback`
- `POST /api/assignments/writing/[id]/restructure`

口语：

- `GET /api/assignments/speaking`
- `POST /api/assignments/speaking`
- `GET /api/assignments/speaking/[id]`
- `PATCH /api/assignments/speaking/[id]`
- `DELETE /api/assignments/speaking/[id]`
- `POST /api/assignments/speaking/[id]/review`

录音：

- `POST /api/recordings`
- `DELETE /api/recordings/[id]`

课件：

- `GET /api/materials`
- `POST /api/materials`
- `GET /api/materials/[id]`
- `PATCH /api/materials/[id]`
- `DELETE /api/materials/[id]`

## Testing

当前测试覆盖：

- AI fallback 不包含已废弃字段。
- 写作结构 normalization 和批阅统计。
- sanitize 工具。
- 写作批阅 API 的鉴权、创建反馈和统计更新。
- 口语批阅 API 的鉴权、upsert 反馈和综合分更新。

运行：

```bash
npm run test
```

生产交接文档记录的本地验证命令：

```bash
npm run test
npm run build
```

已知非阻塞 build warning：

- `src/app/materials/[id]/page.tsx` 使用 `<img>`，Next.js 会建议改成 `next/image`。

## Production Release

生产服务器代码目录：

```text
/var/www/VietTutor-Studio
```

普通发布：

```bash
cd /var/www/VietTutor-Studio
bash scripts/deploy.sh
```

包含 Prisma schema 变更的发布：

```bash
cd /var/www/VietTutor-Studio
bash scripts/deploy.sh --with-db-push
```

发布脚本会执行：

1. `git pull`
2. `npm ci`
3. 可选 `npm run db:push`
4. `npm run build`
5. `systemctl restart vietutor-studio`
6. 输出服务状态

schema 变更、AI 行为变更、上传逻辑变更前，建议先备份：

```text
/var/www/VietTutor-Studio/prisma/dev.db
/var/www/VietTutor-Studio/uploads
/etc/nginx/conf.d/viettutor.conf
/etc/nginx/ssl/vietkiet.cn
```

## Production Operations

常用服务命令：

```bash
systemctl status vietutor-studio --no-pager
systemctl restart vietutor-studio
journalctl -u vietutor-studio -n 100 --no-pager
```

Nginx：

```bash
nginx -t
systemctl reload nginx
systemctl status nginx --no-pager
```

健康检查：

```bash
curl -I http://127.0.0.1:3000
curl -I https://vietkiet.cn/api/health
curl -I https://www.vietkiet.cn
```

HTTPS 当前使用手动部署的阿里云个人测试证书，路径见 `PRODUCTION_STATUS.md`。证书较短期，记得提前更换。

## Known Pitfalls

- 不要把 PM2 当成当前生产方案。生产稳定运行方式是 `systemd`。
- 老服务名 `viettutor.service` 曾造成 3000 端口冲突，排障时注意是否有遗留服务。
- `certbot` 在当前环境验证不稳定，现有 HTTPS 路径是手动部署阿里云证书。
- Kimi `finish_reason=length` 通常意味着结构化输出被截断，可调高 `KIMI_MAX_TOKENS` 或接受 fallback。
- `.env`、`prisma/dev.db` 和 `uploads/` 都是服务器本地状态，不应该提交到 Git。
- 部署后旧页面提交可能出现 `Failed to find Server Action`，通常刷新浏览器即可。
- 写作上传虽已后台结构化，但复杂文件的 Kimi Files API 文本抽取仍可能比纯文本慢。

## Handoff Checklist

接手或继续开发前：

- 先看 `git status --short`，确认工作区是否干净。
- 读 `PRODUCTION_STATUS.md`，不要假设线上一定等于本地或 GitHub main。
- 如果要发版，先确认生产当前 commit。
- 如果改 Prisma schema，发布前备份 SQLite 和 uploads，并用 `--with-db-push`。
- 如果改上传、AI、文件删除或重试逻辑，重点检查是否会覆盖用户答案、批阅或录音。
- 如果改认证，确认 middleware、API 鉴权和 Cookie 签名逻辑一起工作。
- 如果改文件访问，确认仍然只能从 `uploads/` 安全读取。

## Roadmap Notes

设置页里预留了后续方向：

- 词汇本模块
- 错题本模块
- 学习日历模块
- 自动发音评分
- AI 复习题生成

这些目前是产品方向提示，不代表已经实现。
