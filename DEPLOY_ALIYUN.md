# VietTutor Studio 阿里云部署与运维手册

本手册是 Alibaba Cloud Linux 3 + Nginx + systemd + Next.js + SQLite + 本地 `uploads/` 的唯一运维真源。线上当前事实和未完成行动见 `PRODUCTION_STATUS.md`。

所有命令默认由具备 `root` 或等效 sudo 权限的运维人员执行。示例中的 `your-server-ip`、证书文件名和备份目录必须先替换为实际值；不要把真实密码、API Key、IP 或私钥提交到仓库。

## 1. 前置条件

- Alibaba Cloud Linux 3，建议至少 2 vCPU / 2 GB RAM
- 安全组开放 TCP `22`、`80`、`443`
- `vietkiet.cn` 与 `www.vietkiet.cn` 已解析到服务器
- 中国大陆 ECS 已完成所需备案
- 仓库访问权限和 Kimi API Key 已准备
- 发布前已查看 `PRODUCTION_STATUS.md` 的开放行动

## 2. 安装运行环境

项目推荐 Node.js 24 LTS，允许 Node.js 22 到 26。Node.js 20 已结束维护，不应继续作为生产基线。

```bash
dnf install -y nginx git curl sqlite tar
curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
dnf install -y nodejs
node -v
npm -v
nginx -v
sqlite3 --version
```

创建低权限应用用户：

```bash
useradd --system --home-dir /var/www/VietTutor-Studio --shell /sbin/nologin vietutor
```

应用进程不得使用 `root` 运行。root 只用于安装、发布、备份、Nginx 和 systemd 管理。

## 3. 获取代码与配置环境

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/OrangeGrandpaa/VietTutor-Studio.git
cd VietTutor-Studio
npm ci
cp .env.example .env
```

编辑 `.env`，至少填写：

```env
DATABASE_URL="file:./dev.db"
SITE_ACCESS_PASSWORD="replace-with-a-strong-password"
SESSION_SECRET="replace-with-a-long-random-secret"
SESSION_MAX_AGE_DAYS="14"
KIMI_API_KEY="replace-with-the-production-key"
KIMI_BASE_URL="https://api.moonshot.cn/v1"
KIMI_MODEL="kimi-k2.6"
KIMI_MAX_TOKENS="8192"
KIMI_MAX_INPUT_CHARS="200000"
KIMI_REQUEST_TIMEOUT_MS="600000"
KIMI_MAX_RETRIES="1"
MAX_UPLOAD_SIZE_MB="20"
PROTECTED_FILE_ACCEL_REDIRECT_PREFIX="/_protected_uploads/"
```

```bash
openssl rand -base64 32
npm run env:check
chown root:vietutor .env
chmod 640 .env
```

`.env` 是服务器本地状态，不得提交 Git。修改 Kimi、密码或 session 配置后必须重启应用服务。

## 4. 初始化、构建和目录权限

```bash
npm run db:init
npm run check
npm run build
mkdir -p uploads prisma .next/cache
chown -R vietutor:vietutor uploads prisma .next/cache
chmod 750 uploads prisma .next/cache
```

首次初始化后确认：

```bash
test -f prisma/dev.db
sqlite3 prisma/dev.db 'PRAGMA integrity_check;'
```

结果应为 `ok`。

## 5. 配置 systemd

创建 `/etc/systemd/system/vietutor-studio.service`：

```ini
[Unit]
Description=VietTutor Studio
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=vietutor
Group=vietutor
WorkingDirectory=/var/www/VietTutor-Studio
EnvironmentFile=/var/www/VietTutor-Studio/.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node /var/www/VietTutor-Studio/node_modules/next/dist/bin/next start -p 3000
Restart=on-failure
RestartSec=5
UMask=0027

NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectHome=true
ProtectSystem=strict
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
CapabilityBoundingSet=
ReadWritePaths=/var/www/VietTutor-Studio/uploads
ReadWritePaths=/var/www/VietTutor-Studio/prisma
ReadWritePaths=/var/www/VietTutor-Studio/.next/cache

[Install]
WantedBy=multi-user.target
```

应用配置：

```bash
systemctl daemon-reload
systemctl enable --now vietutor-studio
systemctl status vietutor-studio --no-pager
curl --fail http://127.0.0.1:3000/api/health
```

如果服务因权限失败，检查 `uploads`、`prisma`、`.next/cache` 和 `.env` 的 owner/group；不要把服务改回 root 来绕过问题。

## 6. 配置 Nginx

创建 `/etc/nginx/conf.d/viettutor.conf`。`limit_req_zone` 位于 `http` 上下文中，Alibaba Cloud Linux 默认会在该上下文加载 `conf.d/*.conf`。

```nginx
limit_req_zone $binary_remote_addr zone=vietutor_login:10m rate=5r/m;

server {
    listen 80;
    server_name vietkiet.cn www.vietkiet.cn;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name vietkiet.cn www.vietkiet.cn;

    ssl_certificate /etc/nginx/ssl/vietkiet.cn/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/vietkiet.cn/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000" always;

    client_max_body_size 25m;

    location /_protected_uploads/ {
        internal;
        alias /var/www/VietTutor-Studio/uploads/;
        sendfile on;
        tcp_nopush on;
    }

    location = /api/auth/login {
        limit_req zone=vietutor_login burst=5 nodelay;
        limit_req_status 429;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        send_timeout 300s;
        client_body_timeout 300s;
    }
}
```

使用 `$remote_addr` 覆盖 `X-Forwarded-For`，因为当前服务器直接面向公网且只有一层受信任 Nginx；这样客户端不能伪造审计 IP。若以后增加 CDN/WAF/SLB，必须重新配置可信代理网段，不能直接沿用此规则。

首次启用 HSTS 前必须确认两个域名都能稳定使用 HTTPS。应用配置：

```bash
nginx -t
systemctl reload nginx
systemctl status nginx --no-pager
```

## 7. 首次上线验证

```bash
systemctl is-active vietutor-studio
systemctl is-active nginx
curl --fail http://127.0.0.1:3000/api/health
curl -I https://vietkiet.cn
curl -I https://www.vietkiet.cn
curl --fail https://vietkiet.cn/api/health
```

还需在浏览器中完成登录、写作上传、口语录音、课件预览各一次。公开检查通过后，把核验时间、线上 commit 和证据更新到 `PRODUCTION_STATUS.md`。

## 8. 日常发布

发布前：

1. 确认本地 `npm run check`、`npm run build`、`npm audit --omit=dev` 通过。
2. 确认 CHANGELOG 的 `Unreleased` 已记录本次变化和是否需要数据库操作。
3. 在服务器确认当前 commit、服务状态和可用磁盘空间。
4. Prisma schema 变化时先安排维护窗口；发布脚本会创建一致性 SQLite 备份。

普通发布：

```bash
cd /var/www/VietTutor-Studio
git rev-parse --short HEAD
bash scripts/deploy.sh
```

包含 `prisma/schema.prisma` 变化：

```bash
cd /var/www/VietTutor-Studio
bash scripts/deploy.sh --with-db-push
```

脚本会：

1. 拒绝覆盖 tracked 本地改动并执行 `git pull --ff-only`
2. 从 lockfile 安装依赖
3. 校验生产 `.env`
4. 运行 lint、typecheck 和测试
5. schema 变化时使用 `sqlite3 .backup` 写入 `/var/backups/vietutor-studio`
6. 构建并重启服务
7. 检查 systemd 和本地健康接口

发布后记录：

```bash
git rev-parse --short HEAD
node -v
systemctl status vietutor-studio --no-pager
curl --fail https://vietkiet.cn/api/health
```

## 9. 数据备份与恢复

SQLite 与 `uploads/` 必须作为同一份业务快照处理。全量备份建议在短维护窗口停止应用写入：

```bash
umask 077
backup_stamp="$(date +%Y%m%d-%H%M%S)"
backup_dir="/var/backups/vietutor-studio/$backup_stamp"
mkdir -p "$backup_dir"

systemctl stop vietutor-studio
sqlite3 /var/www/VietTutor-Studio/prisma/dev.db ".backup '$backup_dir/dev.db'"
tar -C /var/www/VietTutor-Studio -czf "$backup_dir/uploads.tar.gz" uploads
cp /var/www/VietTutor-Studio/.env "$backup_dir/app.env"
cp /etc/nginx/conf.d/viettutor.conf "$backup_dir/viettutor.conf"
systemctl start vietutor-studio

sha256sum "$backup_dir"/* > "$backup_dir/SHA256SUMS"
curl --fail http://127.0.0.1:3000/api/health
```

备份目录包含密钥和用户数据，必须保持 root-only，并定期复制到异地加密存储。至少保留每日 7 份、每周 4 份，并每季度做一次恢复演练。

恢复必须使用匹配的代码/schema 版本：

```bash
systemctl stop vietutor-studio
cp /path/to/backup/dev.db /var/www/VietTutor-Studio/prisma/dev.db
tar -C /var/www/VietTutor-Studio -xzf /path/to/backup/uploads.tar.gz
chown -R vietutor:vietutor /var/www/VietTutor-Studio/prisma /var/www/VietTutor-Studio/uploads
systemctl start vietutor-studio
sqlite3 /var/www/VietTutor-Studio/prisma/dev.db 'PRAGMA integrity_check;'
curl --fail http://127.0.0.1:3000/api/health
```

## 10. 生产数字证书续签/换发

当前站点由 Nginx 读取：

```text
/etc/nginx/ssl/vietkiet.cn/fullchain.pem
/etc/nginx/ssl/vietkiet.cn/privkey.pem
```

证书“续签”实际上会签发一张新证书，旧证书到期时间不会改变。阿里云个人测试证书不支持直接续期，必须重新申请并重新部署；生产环境推荐购买覆盖两个域名的商业证书。官方参考：

- [阿里云：证书续签与到期处理](https://help.aliyun.com/en/ssl-certificate/ssl-official-certificate-renewal)
- [阿里云：购买个人测试证书](https://help.aliyun.com/en/ssl-certificate/purchase-an-individual-test-certificate)
- [阿里云：下载证书](https://help.aliyun.com/en/ssl-certificate/download-an-ssl-certificate)
- [阿里云：在 Linux Nginx 安装证书](https://help.aliyun.com/en/ssl-certificate/install-ssl-certificates-on-nginx-servers-or-tengine-servers)
- [阿里云：吊销或删除 SSL 证书](https://help.aliyun.com/en/ssl-certificate/revoke-and-delete-a-certificate)

### 10.1 在阿里云申请新证书

推荐方案：购买商业 DV 多域名证书，SAN 明确包含：

- `vietkiet.cn`
- `www.vietkiet.cn`

临时方案：在“数字证书管理服务 -> SSL 证书管理 V2.0 -> 个人测试证书”重新购买/申请。个人测试证书只保证单域名；如果申请 `www.vietkiet.cn`，控制台可能附赠根域名，但不能凭经验假设。签发后必须检查 SAN 同时包含两个域名，否则不要替换现有双域名证书，应改用多域名商业证书或为两个 SNI server block 分别部署证书。

申请步骤：

1. 登录阿里云数字证书管理服务。
2. 选择商业证书，或在个人测试证书页重新购买额度。
3. 创建证书申请，CSR 选择“系统自动生成”可同时下载私钥；如手工 CSR，私钥只保存在生成它的机器上。
4. 填写域名和联系人，提交 CA 审核。
5. 按控制台提示完成 DNS TXT 所有权验证。
6. 等待状态变为“已签发”。不要在“待验证”或“审核中”时开始替换。

### 10.2 下载并在本地检查

在证书详情选择“下载 -> Nginx”，解压后找到 `.pem` 和 `.key`。如果包内没有 `.key`，必须使用申请 CSR 时对应的原私钥；私钥丢失只能重新签发。

```bash
openssl x509 -in downloaded-domain.pem -noout -subject -issuer -dates -ext subjectAltName
openssl pkey -in downloaded-domain.key -check -noout

openssl x509 -in downloaded-domain.pem -pubkey -noout \
  | openssl pkey -pubin -outform DER \
  | openssl sha256
openssl pkey -in downloaded-domain.key -pubout -outform DER \
  | openssl sha256
```

两条 SHA-256 输出必须完全一致；SAN 必须覆盖两个生产域名；`notAfter` 必须晚于旧证书。任何一项不满足都停止操作。

### 10.3 上传到服务器暂存目录

```bash
ssh root@your-server-ip 'install -d -m 700 /root/vietutor-cert-renewal'
scp downloaded-domain.pem root@your-server-ip:/root/vietutor-cert-renewal/new-fullchain.pem
scp downloaded-domain.key root@your-server-ip:/root/vietutor-cert-renewal/new-privkey.pem
```

### 10.4 在服务器备份、校验并替换

```bash
cert_stamp="$(date +%Y%m%d-%H%M%S)"
cert_live_dir="/etc/nginx/ssl/vietkiet.cn"
cert_stage_dir="/root/vietutor-cert-renewal"
cert_backup_dir="/var/backups/vietutor-studio/cert-$cert_stamp"

install -d -m 700 "$cert_backup_dir"
cp -a "$cert_live_dir/fullchain.pem" "$cert_backup_dir/fullchain.pem"
cp -a "$cert_live_dir/privkey.pem" "$cert_backup_dir/privkey.pem"

openssl x509 -in "$cert_stage_dir/new-fullchain.pem" -noout -dates -ext subjectAltName
openssl pkey -in "$cert_stage_dir/new-privkey.pem" -check -noout

new_cert_hash="$(openssl x509 -in "$cert_stage_dir/new-fullchain.pem" -pubkey -noout | openssl pkey -pubin -outform DER | openssl sha256)"
new_key_hash="$(openssl pkey -in "$cert_stage_dir/new-privkey.pem" -pubout -outform DER | openssl sha256)"
test "$new_cert_hash" = "$new_key_hash"

install -m 644 "$cert_stage_dir/new-fullchain.pem" "$cert_live_dir/fullchain.pem.new"
install -m 600 "$cert_stage_dir/new-privkey.pem" "$cert_live_dir/privkey.pem.new"
mv "$cert_live_dir/fullchain.pem.new" "$cert_live_dir/fullchain.pem"
mv "$cert_live_dir/privkey.pem.new" "$cert_live_dir/privkey.pem"

nginx -t
systemctl reload nginx
systemctl is-active nginx
```

`nginx -t` 必须成功后才能 reload。reload 不会重启 Next.js，也不需要重启 `vietutor-studio`。

### 10.5 从服务器外验证两个域名

在本地电脑执行，不要只检查服务器上的文件：

```bash
openssl s_client -connect vietkiet.cn:443 -servername vietkiet.cn </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName -fingerprint -sha256

openssl s_client -connect www.vietkiet.cn:443 -servername www.vietkiet.cn </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName -fingerprint -sha256

curl -I https://vietkiet.cn
curl -I https://www.vietkiet.cn
curl --fail https://vietkiet.cn/api/health
```

确认两个域名展示同一张新证书、新到期时间、完整 SAN，站点和健康接口正常。随后更新 `PRODUCTION_STATUS.md` 的核验时间、指纹、有效期、负责人和证据。

### 10.6 证书回滚

如果 `nginx -t`、reload 或外部验证失败，立即从本次明确的备份目录恢复，不要猜测“最新”目录：

```bash
cert_backup_dir="/var/backups/vietutor-studio/cert-YYYYMMDD-HHMMSS"
cert_live_dir="/etc/nginx/ssl/vietkiet.cn"

cp "$cert_backup_dir/fullchain.pem" "$cert_live_dir/fullchain.pem"
cp "$cert_backup_dir/privkey.pem" "$cert_live_dir/privkey.pem"
chmod 644 "$cert_live_dir/fullchain.pem"
chmod 600 "$cert_live_dir/privkey.pem"
nginx -t
systemctl reload nginx
```

回滚后再次从服务器外检查证书和健康接口。

### 10.7 换证后清理与旧证书吊销

公网验证通过后保留本次明确的旧证书备份 24 至 48 小时，作为短期回滚保障。观察期结束且两个域名、健康接口持续正常后，删除服务器暂存目录中的新证书副本和私钥副本：

```bash
rm -f /root/vietutor-cert-renewal/new-fullchain.pem
rm -f /root/vietutor-cert-renewal/new-privkey.pem
rmdir /root/vietutor-cert-renewal
```

正常换发不会自动要求立即吊销旧证书；旧证书在原到期日前仍然有效。如果旧私钥始终受控，可让旧证书自然到期，并在到期后清理不再需要的旧私钥副本。出现以下任一情况时必须尽快向 CA 申请吊销：

- 旧私钥丢失、被复制、外泄或疑似被未授权人员访问。
- 旧证书错误签发、域名或主体信息不正确。
- 域名控制权变化，或发现未知服务仍在使用旧证书。

吊销不可恢复，也会使旧证书失去回滚价值。提交吊销前必须先确认所有生产入口都已返回新指纹；没有泄露证据时，不要仅为“清理列表”而在换证后立即吊销。

### 10.8 到期监控

每周自动或人工执行：

```bash
openssl s_client -connect vietkiet.cn:443 -servername vietkiet.cn </dev/null 2>/dev/null \
  | openssl x509 -checkend 2592000 -noout
```

退出码非 0 表示将在 30 天内到期。至少设置 30、14、7 天三级提醒；负责人收到新证书“已签发”通知后仍必须完成 Nginx 部署，阿里云签发不会自动替换自建 ECS 上的文件。

## 11. 代码发布回滚

- 代码问题：优先在 Git 中创建 revert commit，再运行普通发布脚本；不要在服务器使用破坏性的 `git reset --hard`。
- schema 问题：停止服务，恢复发布脚本生成的明确 SQLite 备份，并部署与该 schema 匹配的代码。
- 文件问题：从同一时间点的 `uploads` 快照恢复，避免数据库与文件目录错位。
- 回滚完成后必须执行数据库完整性、systemd、本地健康和公网健康检查。

## 12. 排障

应用：

```bash
systemctl status vietutor-studio --no-pager
journalctl -u vietutor-studio -n 100 --no-pager
ss -tlnp | grep 3000
curl -v http://127.0.0.1:3000/api/health
```

Nginx：

```bash
nginx -t
systemctl status nginx --no-pager
tail -n 100 /var/log/nginx/error.log
```

- `429` 登录响应：触发 Nginx 登录限流，等待窗口结束后重试。
- `504`：检查 Next.js 服务、上游超时和大请求；写作 AI 应在后台运行。
- `Kimi finish_reason=length`：拆分输入或在模型允许范围内调整 `KIMI_MAX_TOKENS`。
- Kimi 超时、429、5xx：检查上游状态、`KIMI_REQUEST_TIMEOUT_MS` 和 `KIMI_MAX_RETRIES`。
- `Permission denied`：修复应用数据目录 owner/group，不要将 systemd User 改成 root。
- 上传被拒绝：确认扩展名和浏览器 MIME 均属于该入口的允许配对。

## 13. 本文件维护规则

- 只记录可重复执行的操作，不记录当前证书到期日、当前 commit 或一次性故障过程。
- 每个新增操作必须包含：前置条件、完整命令、成功判据、失败回滚。
- 命令修改后要在非生产环境或维护窗口实际验证，并在 PR/CHANGELOG 中注明验证范围。
- 基础设施拓扑变化（CDN、WAF、SLB、多实例、对象存储）必须同步重写相关代理、证书、备份和可信 IP 规则。
- 线上实际值只写入 `PRODUCTION_STATUS.md`；已完成历史只写入 `CHANGELOG.md`。
- 不得记录任何真实密钥、密码、Cookie、私钥或备份下载地址。
