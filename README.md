# VietTutor Studio

VietTutor Studio 是一个私有的越南语教学工作台，集中管理写作作业、AI 结构化、逐题批阅、口语录音、课件和学习统计。项目适合单机、小规模教学场景，目前采用 Next.js 单体架构、SQLite 和本地文件存储。

## 文档地图

| 文件 | 唯一职责 | 何时更新 |
| --- | --- | --- |
| `README.md` | 稳定的开发入口、架构和业务规则 | 安装方式、目录、核心流程或接口契约变化时 |
| `DEPLOY_ALIYUN.md` | 可重复执行的部署、发布、备份、证书和回滚手册 | 运维步骤或生产基础设施变化时 |
| `PRODUCTION_STATUS.md` | 最近一次核验的线上事实和未完成行动 | 每次生产核验、发布、证书或故障状态变化时 |
| `CHANGELOG.md` | 已完成变更的时间线 | 合并或发布用户可见、运维、安全、迁移变更时 |

记录规则：

- README 不追加发布日志、临时故障和线上实时值。
- 部署手册中的每项操作必须同时写明前置条件、命令、验证和回滚。
- 生产状态只写有证据的事实；计划写入“开放行动”，并填写负责人、截止时间和状态。
- CHANGELOG 新内容先进入 `Unreleased`，发布后再移动到日期标题；不要把待办事项写成已完成变更。
- 密码、API Key、Cookie、私钥、服务器公网 IP 等敏感值不得写入任何 Markdown。

## 技术栈

- Next.js 15 App Router、React 19、TypeScript
- Tailwind CSS、Recharts、Framer Motion
- Prisma 6、SQLite
- Vitest
- Kimi / Moonshot Chat Completions API
- Nginx + systemd（生产）

主要文件解析依赖：

- `mammoth`：读取 `.docx`
- `word-extractor`：读取 `.doc`
- 本地解析器：读取 TXT、Markdown 和 RTF
- `zod`：校验 AI 结构化 JSON

生产环境不使用 PM2。

## 快速开始

推荐 Node.js 24 LTS；项目允许 Node.js 22 到 26。版本基线记录在 `.nvmrc` 和 `package.json#engines`。

```bash
nvm use
npm ci
cp .env.example .env
npm run db:init
npm run dev
```

打开 `http://localhost:3000`，使用 `.env` 中的 `SITE_ACCESS_PASSWORD` 登录。

## 环境变量

以 `.env.example` 为准，不要在文档中复制真实生产值。

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | SQLite 地址，默认 `file:./dev.db` 对应 `prisma/dev.db` |
| `SITE_ACCESS_PASSWORD` | 全站共享访问密码；生产至少 12 个字符 |
| `SESSION_SECRET` | Cookie HMAC 密钥；生产至少 32 个字符 |
| `SESSION_MAX_AGE_DAYS` | 登录会话有效天数 |
| `KIMI_API_KEY` | 写作结构化所需的 Kimi API Key |
| `KIMI_BASE_URL` | Kimi API 地址 |
| `KIMI_MODEL` | Kimi 模型标识 |
| `KIMI_MAX_TOKENS` | 单次结构化最大输出 token |
| `KIMI_MAX_INPUT_CHARS` | 送入 AI 的最大字符数，避免超大请求和意外费用 |
| `KIMI_REQUEST_TIMEOUT_MS` | 单次上游请求超时 |
| `KIMI_MAX_RETRIES` | 网络、超时、429 和 5xx 的最大重试次数 |
| `MAX_UPLOAD_SIZE_MB` | 受保护上传的最大文件大小 |
| `PROTECTED_FILE_ACCEL_REDIRECT_PREFIX` | 可选的 Nginx `X-Accel-Redirect` 内部路径 |

生成随机 session secret：

```bash
openssl rand -base64 32
```

## 常用命令

```bash
npm run dev          # 本地开发
npm run build        # 生成 Prisma Client 并构建生产包
npm run start        # 启动生产构建
npm run lint         # 静态检查
npm run typecheck    # 独立 TypeScript 检查
npm run test         # 运行测试
npm run check        # lint + typecheck + test
npm run env:check    # 校验生产 .env 的最低要求
npm run db:init      # 生成 Client、同步 schema、创建上传目录
npm run db:push      # 将当前 schema 同步到 SQLite
npm run db:seed      # 写入示例记录
```

`next lint` 在 Next.js 15 中已弃用；升级 Next.js 16 时应一并迁移到 ESLint CLI。

## 项目结构

```text
.
├── src/app                 # 页面与 Route Handlers
├── src/components          # 布局、业务组件和 UI primitives
├── src/lib                 # 认证、AI、作业、存储、统计和工具
├── src/prompts             # 写作结构化提示词
├── src/types               # 业务类型和第三方声明
├── prisma/schema.prisma    # SQLite 数据模型
├── scripts/init-db.ts      # 初始化上传目录
├── scripts/deploy.sh       # 生产发布脚本
├── scripts/validate-production-env.mjs
├── uploads/.gitkeep        # 本地上传目录占位
├── DEPLOY_ALIYUN.md
├── PRODUCTION_STATUS.md
└── CHANGELOG.md
```

## 业务流程

### 认证

1. `/api/auth/login` 校验共享密码。
2. 服务端生成随机 session，仅把 SHA-256 hash 存入数据库。
3. 浏览器收到 HMAC 签名的 HttpOnly Cookie。
4. 页面通过 `requireAuth()`，API 通过 `ensureAuthenticatedApi()` 校验数据库 session。
5. 登录后的 `next` 只允许站内绝对路径，拒绝协议、双斜杠、反斜杠和控制字符。

中间件只负责快速跳转，不能替代页面和 API 的服务端鉴权。

### 写作作业

支持 `.txt`、`.md`、`.markdown`、`.rtf`、`.doc` 和 `.docx`。

1. 服务端先校验扩展名和 MIME 的明确配对，再保存原文件。
2. TXT、Markdown、RTF、DOC、DOCX 在本地抽取文本并修复常见乱码。
3. 创建 `WRITING` 作业，使用 Next.js `after()` 在后台调用 Kimi。
4. AI JSON 通过 Zod 和业务 normalization 后，事务替换题目 sections。
5. 用户逐题作答、批阅，汇总作业状态和正确率。

重要约束：

- AI 未成功前不展示本地 fallback 题目；历史 fallback 代码已删除。
- AI 重试进行中拒绝并发重试；已有答案或批阅时禁止重构，避免覆盖用户工作。
- AI 返回零道题时视为失败，不删除原有题目。
- 选择相同答案不会重复发请求，也不会清空已有批阅。
- 作业详情查询和修改必须同时限定 `AssignmentType.WRITING`。

### 口语作业

支持 `.txt` 和 `.rtf`，不调用 Kimi。

1. 服务端本地抽取文本并按句末标点拆句，末尾无标点文本也会保留。
2. 全文录音挂在 `Recording.assignmentId`。
3. 逐句学生录音和教师示范录音挂在 `Recording.speakingUnitId`，以 `kind` 区分。
4. 句子发音判断为 10 / 5 / 0 分，综合分是已批阅句子的算术平均。

录音新增或删除后，相关句子的旧评分会失效并重新计算作业汇总。没有学生录音时不能提交发音判断。作业详情查询和修改必须同时限定 `AssignmentType.SPEAKING`。

### 课件

课件支持 PDF、Word、PowerPoint、Markdown、文本、图片、音频和视频。文件存入 `uploads/materials`，数据库只保存元数据；课件不再记录阅读进度、页数或备注。

### 受保护文件

所有文件通过以下入口鉴权读取：

```text
/api/files/<id>?kind=assignment|material|recording
```

- 读取路径必须位于 `uploads/` 内。
- 支持流式响应和 HTTP Range。
- 上传时必须通过扩展名与 MIME 的配对校验。
- PDF、安全位图、纯文本和音视频可内嵌；Office、RTF、HTML、SVG 等强制下载。
- 响应包含 `nosniff`，并使用 `private, no-store`，避免退出登录后复用敏感缓存。
- 生产可使用 Nginx `X-Accel-Redirect` 传输文件，但 Next.js 仍先完成鉴权和归属查询。

## 状态与统计口径

写作和口语统一使用以下派生状态：

- `还没做`：没有答案或学生录音
- `还没做完！`：只完成一部分
- `未批阅`：已完成但尚无批阅
- `批阅中`：只批阅一部分
- `已批阅`：全部完成批阅

Dashboard 的趋势图只统计已有评分的数据，并分别展示写作正确率和口语得分，不把“未评分”伪装成 0 分。

## 数据与边界

核心模型：

- `UserSession`
- `Assignment`
- `AssignmentSection` / `TeacherFeedback`
- `SpeakingUnit` / `Recording`
- `CourseMaterial`

SQLite 和 `uploads/` 共同构成业务数据，必须一起备份。当前架构假设单实例和本地磁盘；如果需要多实例或多用户并发，应先迁移到 PostgreSQL、对象存储和持久任务队列。

写作 AI 当前依赖进程内 `after()`，不是持久任务队列。进程重启可能留下 `PENDING` 作业，这是后续架构优化项。

## API 概览

- 认证：`POST /api/auth/login`、`POST /api/auth/logout`
- 健康：`GET /api/health`
- Dashboard：`GET /api/dashboard`
- 文件：`GET /api/files/[id]`
- 写作：`GET|POST /api/assignments/writing`，`GET|PATCH|DELETE /api/assignments/writing/[id]`
- 写作答案与批阅：`PATCH .../answer`、`POST .../feedback`
- 口语：`GET|POST /api/assignments/speaking`，`GET|PATCH|DELETE /api/assignments/speaking/[id]`
- 口语批阅：`POST /api/assignments/speaking/[id]/review`
- 录音：`POST /api/recordings`、`DELETE /api/recordings/[id]`
- 课件：`GET|POST /api/materials`、`GET|DELETE /api/materials/[id]`

## 验证与发布

提交前至少执行：

```bash
npm run check
npm run build
npm audit --omit=dev
```

生产部署、SQLite 备份、Nginx、证书续签和回滚只维护在 `DEPLOY_ALIYUN.md`。当前线上证据、证书到期时间和待办只维护在 `PRODUCTION_STATUS.md`。
