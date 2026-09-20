# UEMCraft 官方网站

> 应急管理大学 Minecraft 同好会官方网站 — [uemcraft.cn](https://uemcraft.cn)

HTML5 + CSS3 + Vanilla JS 前端，PHP + SQLite/MySQL 后端，零框架零依赖。所有内容通过 `/admin/` 管理后台管理。

## 项目结构

```
├── index / about / events / join / 404.html   页面
├── admin/            管理后台（仪表盘、新闻、活动、作品、服务器、留言墙）
├── api/              PHP API（common.php / news / events / works / servers / wall）
├── gallery/          作品展示 + 详情页
├── news/             新闻路由（index.php）
├── wall/             留言墙 + 管理端
├── css/              样式（tokens → base → layout → components → pages）
├── js/               脚本（components / main / content / gallery / server / admin …）
├── assets/           静态资源（图片、字体、文档）
└── scripts/          数据迁移脚本
```

## 环境要求

| 项目 | 要求 |
|------|------|
| PHP | 7.4+ |
| PHP 扩展 | PDO, SQLite3（默认）或 PDO, MySQL |
| Web 服务器 | Nginx / Apache / 宝塔 |
| 数据库 | SQLite（零配置，运行期自动生成）或 MySQL 5.7+ / MariaDB 10.3+ |

> 纯静态托管（GitHub Pages、Vercel 等）无法运行 PHP 后端。

## 本地开发

```bash
# PHP 内置服务器（推荐，API 正常工作）
php -S localhost:8080

# 或 Node.js（仅静态页面，API 不可用）
npx serve .
```

访问 `http://localhost:8080`。首次请求 API 时自动在 `api/` 目录生成 SQLite 数据库文件。

## 部署

### 1. 准备环境变量

创建 `.env` 或在服务器面板中设置：

| 变量 | 必填 | 说明 |
|------|------|------|
| `ADMIN_TOKEN` | 是 | 管理后台登录令牌（请使用强随机字符串） |
| `SITE_DB_DRIVER` | 否 | `sqlite`（默认）或 `mysql` |
| `SITE_DB_HOST/PORT/NAME/USER/PASS` | 否 | MySQL 连接参数（driver=mysql 时必填） |
| `WALL_DB_DRIVER` | 否 | `sqlite`（默认）或 `mysql` |
| `WALL_DB_HOST/PORT/NAME/USER/PASS` | 否 | 留言墙 MySQL 连接参数 |
| `WALL_ADMIN_TOKEN` | 否 | 留言墙专用令牌（兼容，优先读 `ADMIN_TOKEN`） |
| `MODERATION_API_KEY` | 否 | 硅基流动 API Key，启用留言 AI 审核 |
| `MODERATION_MODEL` | 否 | 审核模型，默认 `Qwen/Qwen3.5-4B` |

生成随机令牌：

```bash
openssl rand -hex 32
```

### 2. 上传文件

将整个项目目录上传到服务器 Web 根目录（或子目录）。

确保 `api/` 目录可写（SQLite 需要创建 `.db` 文件）：

```bash
chmod -R 755 api/
chown -R www-data:www-data api/   # Debian/Ubuntu
# chown -R nginx:nginx api/       # CentOS + Nginx
```

### 3. 配置 Web 服务器

#### Nginx

```nginx
server {
    listen 80;
    server_name uemcraft.cn;
    root /var/www/uemcraft;
    index index.html index.php;

    # 新闻路径式 URL 重写
    location /news/ {
        try_files $uri $uri/ /news/index.php?slug=$uri&$args;
    }

    # PHP 处理
    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;  # 按实际 PHP 版本调整
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # 禁止访问数据库文件和内部文件
    location ~ /\.(db|env|htaccess) {
        deny all;
    }

    # 禁止直接访问 api/ 目录列表
    location /api/ {
        if (!-f $request_filename) { return 404; }
    }
}
```

#### Apache（.htaccess）

在网站根目录创建或编辑 `.htaccess`：

```apache
RewriteEngine On

# 新闻路径式 URL 重写
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^news/([a-zA-Z0-9_-]+)/?$ news/index.php?slug=$1 [L,QSA]

# 禁止访问数据库文件
<FilesMatch "\.(db|env)$">
    Require all denied
</FilesMatch>

# 禁止目录浏览
Options -Indexes
```

确保 `mod_rewrite` 已启用：

```bash
sudo a2enmod rewrite
sudo systemctl restart apache2
```

#### 宝塔面板

1. **添加站点**：宝塔面板 → 网站 → 添加站点 → 填写域名、根目录
2. **PHP 版本**：网站设置 → PHP 版本 → 选择 PHP 7.4+
3. **伪静态**：网站设置 → 伪静态 → 选择「自定义」，添加：

```nginx
location /news/ {
    if (!-e $request_filename) {
        rewrite ^/news/([a-zA-Z0-9_-]+)/?$ /news/index.php?slug=$1 last;
    }
}
```

4. **环境变量**：网站设置 → PHP 管理 → 配置文件 → 在 `php.ini` 末尾添加：

```ini
env[ADMIN_TOKEN] = 你的令牌
```

或使用宝塔的「PHP 配置」→「环境变量」功能。

5. **目录权限**：确保 `api/` 目录归属为 `www:www`

### 4. 配置 HTTPS（推荐）

```bash
# 宝塔面板：网站设置 → SSL → Let's Encrypt 一键申请

# 或 certbot（Nginx）
sudo certbot --nginx -d uemcraft.cn

# 或 certbot（Apache）
sudo certbot --apache -d uemcraft.cn
```

### 5. 登录管理后台

访问 `/admin/login.html`，输入 `ADMIN_TOKEN` 对应的令牌即可开始管理内容。

首次访问 API 端点时，SQLite 数据库（`api/site.db`、`api/wall.db`）会自动创建并建表，无需手动初始化。

### Nginx + PHP-FPM 一键部署脚本（Debian/Ubuntu）

```bash
#!/bin/bash
# 安装 Nginx + PHP + SQLite
apt update && apt install -y nginx php-fpm php-sqlite3 php-mbstring certbot python3-certbot-nginx

# 设置项目目录
SITE_DIR=/var/www/uemcraft
mkdir -p $SITE_DIR
# cp -r /path/to/project/* $SITE_DIR/
chown -R www-data:www-data $SITE_DIR/api/

# 写入 Nginx 配置
cat > /etc/nginx/sites-available/uemcraft <<'EOF'
server {
    listen 80;
    server_name uemcraft.cn;
    root /var/www/uemcraft;
    index index.html index.php;
    location /news/ {
        try_files $uri $uri/ /news/index.php?slug=$uri&$args;
    }
    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php*-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    location ~ /\.(db|env) { deny all; }
}
EOF

ln -sf /etc/nginx/sites-available/uemcraft /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 申请 HTTPS
certbot --nginx -d uemcraft.cn --non-interactive --agree-tos -m admin@uemcraft.cn

echo "部署完成！设置环境变量 ADMIN_TOKEN 后访问 /admin/login.html"
```

## 数据迁移

从旧版 Markdown + data.js 迁移到数据库：

```bash
# 导出 data.js 中的活动数据
node -e "
const fs = require('fs');
const content = fs.readFileSync('js/data.js', 'utf8');
const match = content.match(/events:\s*(\{[\s\S]*?\})\s*\n\};/);
if (match) {
  const fn = new Function('return ' + match[1]);
  fs.writeFileSync('scripts/events-data.json', JSON.stringify(fn(), null, 2));
}
"

# 运行迁移
php scripts/migrate-to-db.php

# MySQL
SITE_DB_DRIVER=mysql SITE_DB_NAME=uemcraft SITE_DB_USER=root SITE_DB_PASS=密码 php scripts/migrate-to-db.php
```

## 相关链接

| 名称 | 链接 |
|------|------|
| UEMCraft 官网 | https://uemcraft.cn |
| MUA 高校联盟 | https://www.mualliance.cn/ |
| 皮肤站 | https://skin.uemcraft.cn/ |
| 应急管理大学 | https://www.ncist.edu.cn/ |
| 燕理MC玩家创作协会 | https://www.yitmc.cn |
| QQ 群 | https://qm.qq.com/q/VYDnv3ZJwC |
| B 站 | https://space.bilibili.com/3546888496221012 |
| 抖音 | https://v.douyin.com/Q44xZngm3ls/ |

## 许可证

[MIT](LICENSE) &copy; GengarP
