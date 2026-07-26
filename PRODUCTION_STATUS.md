# VietTutor Studio 生产状态

最近核验：`2026-07-27 02:02 CST (UTC+8)`

核验范围：本次仅从公网检查 HTTPS、重定向和健康接口；未登录 ECS，因此线上 commit、Node 版本、systemd 用户、备份和磁盘状态仍需 SSH 复核。未核验内容不得当作已确认事实。

## 当前公开状态

| 项目 | 当前值 | 证据/核验方式 |
| --- | --- | --- |
| 主域名 | `https://vietkiet.cn` | 公网 HTTPS 请求 |
| www 域名 | `https://www.vietkiet.cn` | 公网 HTTPS 请求 |
| 未登录首页 | 两个域名均返回 `307` 到各自 `/login` | `curl` |
| 健康接口 | `200`，`status=ok`，`checks.database=ok` | `https://vietkiet.cn/api/health` |
| HTTPS 证书 | 新证书已部署，两个域名均通过公网验证 | `openssl s_client` |

公网验证命令：

```bash
curl -I https://vietkiet.cn
curl -I https://www.vietkiet.cn
curl --fail https://vietkiet.cn/api/health
```

## 当前证书事实

| 字段 | 当前值 |
| --- | --- |
| Subject | `CN=vietkiet.cn` |
| Issuer | `DigiCert Encryption Everywhere DV TLS CA - G2` |
| SAN | `vietkiet.cn`、`www.vietkiet.cn` |
| 生效时间 | `2026-07-26 08:00:00 CST` |
| 到期时间 | `2026-10-24 07:59:59 CST`（`2026-10-23 23:59:59 UTC`） |
| SHA-256 指纹 | `91:FB:37:CB:17:BD:74:44:67:B9:5E:CC:76:CB:6E:2B:7F:68:7A:15:CE:2A:7E:44:0C:D5:B4:B8:13:04:4E:98` |
| 公网核验时间 | `2026-07-27 02:02 CST` |

本轮证书已完成签发、Nginx 替换和两域名外部验证。两个 SNI 均返回上述新指纹，SAN 完整覆盖根域名与 `www`，健康接口同时验证通过。服务器内证书备份路径和暂存私钥清理状态仍需在下一次 SSH 核验中记录。完整换发、回滚、旧证书处理和监控步骤见 `DEPLOY_ALIYUN.md#10-生产数字证书续签换发`。

## 服务器待复核项

以下值来自历史部署记录，不是本次 SSH 核验结果：

| 项目 | 历史记录 | 本次状态 |
| --- | --- | --- |
| 云服务/系统 | Alibaba Cloud ECS / Alibaba Cloud Linux 3 | 待 SSH 复核 |
| 应用目录 | `/var/www/VietTutor-Studio` | 待 SSH 复核 |
| 应用端口 | `3000` | 公网链路间接可用，进程监听待复核 |
| 服务名 | `vietutor-studio` | 待 SSH 复核 |
| 反向代理 | Nginx | TLS 响应可见，配置文件待复核 |
| Nginx 配置 | `/etc/nginx/conf.d/viettutor.conf` | 待 SSH 复核 |
| SQLite | `/var/www/VietTutor-Studio/prisma/dev.db` | 健康接口显示数据库可用，路径/完整性待复核 |
| 上传目录 | `/var/www/VietTutor-Studio/uploads` | 待 SSH 复核 |
| 生产 commit | 未知 | 必须执行 `git rev-parse --short HEAD` |
| Node 版本 | 未知 | 必须执行 `node -v`；目标为 Node 24 LTS |
| systemd 运行用户 | 未知 | 必须确认迁移为 `vietutor`，不能是 root |
| 最近可恢复备份 | 未知 | 必须记录时间、位置、校验和及恢复演练日期 |

SSH 复核命令：

```bash
cd /var/www/VietTutor-Studio
git rev-parse --short HEAD
git status --short
node -v
systemctl show vietutor-studio -p User -p Group -p ActiveState -p SubState
systemctl status vietutor-studio --no-pager
nginx -t
sqlite3 prisma/dev.db 'PRAGMA integrity_check;'
df -h
```

## 开放行动

| 优先级 | 行动 | 负责人 | 截止时间 | 状态 | 完成证据 |
| --- | --- | --- | --- | --- | --- |
| P1 | SSH 核验线上 commit、Node、systemd 用户、Nginx、证书备份和磁盘 | 待指定 | 下一次代码发布窗口 | 待开始 | 上节命令输出摘要 |
| P1 | 升级生产到 Node 24，并以低权限 `vietutor` 用户运行 | 待指定 | 下一次代码发布 | 待开始 | `node -v`、`systemctl show` |
| P1 | 部署本轮安全/一致性修复并执行生产 smoke test | 待指定 | 证书完成后最近维护窗口 | 待开始 | commit、发布时间、健康和核心流程结果 |
| P1 | 建立异地加密备份和恢复演练记录 | 待指定 | `2026-08-07` | 待开始 | 最近备份时间、SHA-256、恢复演练日期 |
| P2 | 建立证书 30/14/7 天告警 | 待指定 | `2026-07-31` | 待开始 | 告警策略截图或任务记录 |
| P2 | 将 AI `after()` 改为持久任务队列 | 待指定 | 未排期 | 待评估 | 设计/实现链接 |

状态只允许：`待开始`、`进行中`、`阻塞中`、`已完成`。标为已完成时必须填写证据；完成项在下一次整理时移入 CHANGELOG，不在此长期堆积。

## 发布核验记录

下一次生产发布后，用本节替换旧值，不要追加无限流水账：

| 字段 | 值 |
| --- | --- |
| 发布 commit | `待填写` |
| 发布时间 | `待填写（含时区）` |
| 执行人 | `待填写` |
| 是否包含 schema 变化 | `是/否` |
| 发布前备份 | `路径/时间/SHA-256，或不适用` |
| `npm run check` | `通过/失败` |
| `npm run build` | `通过/失败` |
| `npm audit --omit=dev` | `结果` |
| 本地健康 | `结果` |
| 公网健康 | `结果` |
| 登录/写作/口语/课件 smoke test | `结果` |
| 回滚是否触发 | `否，或回滚原因与结果` |

## 本文件维护规则

- 每次编辑必须更新“最近核验”时间并注明时区和核验范围。
- “当前状态”只写亲自验证或有可靠输出支持的事实；推测和计划只能进入“开放行动”。
- 证书、commit、运行时、备份等值变化时直接替换旧值；旧事实移入 CHANGELOG 的 `Operations`，不要在本文件保留历史段落。
- 每个行动必须有优先级、负责人、截止时间、状态和完成证据。未知负责人写“待指定”，不能留空。
- 不在这里复制产品功能列表、部署步骤或故障长日志；分别放入 README、DEPLOY 和外部日志系统。
- 不记录密码、API Key、Cookie、私钥、完整 `.env`、服务器公网 IP 或备份下载地址。
- 公网核验不能证明服务器内部配置；没有 SSH 证据时必须明确标记“待复核”。
