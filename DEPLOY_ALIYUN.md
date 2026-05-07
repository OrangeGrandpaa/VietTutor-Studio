# VietTutor Studio 阿里云部署说明

本文按 `Ubuntu + Nginx + PM2 + Next.js + SQLite` 方式部署。

如果你的 ECS 是中国内地地域，并且你要绑定自己的域名，请先确认域名已经完成 ICP 备案；否则域名解析到中国内地服务器后，网站无法合规提供服务。

## 1. 服务器准备

建议配置：

- Ubuntu 22.04 LTS
- 2 vCPU / 2 GB RAM 起步
- 已分配公网 IP
- 已放通安全组端口：`22`、`80`、`443`

## 2. 登录服务器

```bash
ssh root@你的服务器公网IP
```

如果你使用普通用户，请把下文里的 `root` 替换成你的用户名。

## 3. 安装基础环境

```bash
apt update
apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
node -v
npm -v
```

建议使用 Node.js 20 LTS。

## 4. 拉取项目

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/OrangeGrandpaa/VietTutor-Studio.git
cd VietTutor-Studio
```

## 5. 配置环境变量

先复制模板：

```bash
cp .env.example .env
```

然后编辑：

```bash
nano .env
```

至少要配置这些值：

```env
DATABASE_URL="file:./dev.db"
SITE_ACCESS_PASSWORD="改成你自己的访问密码"
SESSION_SECRET="改成长随机字符串"
SESSION_MAX_AGE_DAYS="14"
KIMI_API_KEY="如果要用 Kimi 就填写"
KIMI_BASE_URL="https://api.moonshot.ai/v1"
KIMI_MODEL="moonshot-v1-8k"
MAX_UPLOAD_SIZE_MB="20"
```

注意：

- `DATABASE_URL="file:./dev.db"` 会让 SQLite 数据库文件落在 `prisma/dev.db`。
- `SITE_ACCESS_PASSWORD` 是网站登录口令。
- `SESSION_SECRET` 必须是高强度随机字符串。

可用下面命令生成 `SESSION_SECRET`：

```bash
openssl rand -base64 32
```

## 6. 安装依赖并初始化数据目录

```bash
npm ci
npm run db:init
```

这一步会做三件事：

- 生成 Prisma Client
- 根据 `schema.prisma` 初始化 SQLite 表结构
- 创建 `uploads` 目录

## 7. 构建生产版本

```bash
npm run build
```

## 8. 用 PM2 启动服务

仓库根目录已经提供 `ecosystem.config.cjs`，直接启动：

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

确认服务状态：

```bash
pm2 status
pm2 logs vietutor-studio --lines 100
```

默认应用监听 `3000` 端口。

## 9. 配置 Nginx 反向代理

创建站点配置：

```bash
nano /etc/nginx/sites-available/vietutor-studio
```

填入：

```nginx
server {
    listen 80;
    server_name 你的域名 或 服务器公网IP;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
ln -s /etc/nginx/sites-available/vietutor-studio /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## 10. 安全组与防火墙检查

阿里云安全组至少放通：

- `22`：SSH
- `80`：HTTP
- `443`：HTTPS

如果你临时要直接访问 Node 服务，也可以短暂放通 `3000`，但生产环境建议只开放 `80/443`，由 Nginx 对外提供访问。

## 11. 绑定域名

在域名服务商控制台添加解析：

- 记录类型：`A`
- 主机记录：`@` 或 `www`
- 记录值：你的 ECS 公网 IP

解析生效后，用域名访问网站。

## 12. 配置 HTTPS

如果域名已备案并解析成功，可以安装证书。常见方案是 `Let's Encrypt`。

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d 你的域名
```

完成后，`Nginx` 会自动更新为 HTTPS 配置。

## 13. 后续更新

以后每次发版：

```bash
cd /var/www/VietTutor-Studio
git pull
npm ci
npm run build
pm2 restart vietutor-studio
```

如果 `prisma/schema.prisma` 有变更，再补一次：

```bash
npm run db:push
```

## 14. 数据备份

这个项目当前使用 SQLite，本机重要数据主要有两部分：

- `prisma/dev.db`
- `uploads/`

建议定期备份：

```bash
tar -czf /root/vietutor-backup-$(date +%F).tar.gz prisma/dev.db uploads
```

## 15. 常见问题

### 网站打不开

按顺序检查：

```bash
pm2 status
pm2 logs vietutor-studio --lines 100
nginx -t
systemctl status nginx
ss -tlnp | grep 3000
```

### 修改了 `.env` 但没生效

```bash
pm2 restart vietutor-studio --update-env
```

### 上传失败

检查：

- `uploads` 目录是否存在
- `client_max_body_size` 是否足够
- `.env` 中的 `MAX_UPLOAD_SIZE_MB` 是否合理

### Kimi 功能失败

检查：

- `KIMI_API_KEY` 是否正确
- 服务器是否能访问外部 API

