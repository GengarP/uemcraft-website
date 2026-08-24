# UEMCraft 官方网站

> 应急管理大学 Minecraft 同好会官方网站 — [uemcraft.cn](https://uemcraft.cn)

以纯静态为主，HTML5 + CSS3 + Vanilla JS，零框架零依赖。新闻、活动、作品、服务器、留言墙均通过 PHP + SQLite/MySQL 后端管理，需部署到支持 PHP 的服务器。

## 项目结构

```
├── index.html              首页
├── about.html              关于
├── events.html             活动
├── join.html               加入我们
├── 404.html                404 页面
├── admin/                  管理后台（需 PHP 后端）
│   ├── login.html          登录页
│   ├── index.html          仪表盘
│   ├── news.html           新闻管理
│   ├── news-edit.html      新闻编辑/新建
│   ├── events.html         活动管理
│   ├── events-edit.html    活动编辑/新建
│   ├── gallery.html        作品管理
│   ├── gallery-edit.html   作品编辑/新建
│   └── css/admin.css       后台样式
├── gallery/
│   ├── index.html          作品展示（API 驱动 + 分类筛选）
│   └── detail.html         作品详情（?id=，Modrinth 风格双栏布局）
├── news/
│   ├── index.html          新闻列表（从 API 加载）
│   └── article.html        文章详情（从 API 加载，?slug=）
├── wall/
│   ├── index.html          留言墙（需 PHP 后端）
│   └── admin.html          留言墙管理端
├── api/
│   ├── common.php          公共函数库（PDO、认证、响应）
│   ├── news.php            新闻 API（CRUD + 管理）
│   ├── events.php          活动 API（CRUD + 管理）
│   ├── works.php           作品 API（CRUD + 管理）
│   ├── servers.php         服务器 API（列表 + 管理 CRUD）
│   └── wall.php            留言墙 API（含 AI 审核）
├── scripts/
│   └── migrate-to-db.php   数据迁移脚本
├── css/
│   ├── tokens.css          设计令牌
│   ├── base.css / layout.css / components.css / pages.css
├── js/
│   ├── main.js             全局（导航/主题/滚动）
│   ├── content.js          内容渲染（从 API 加载新闻和活动）
│   ├── server.js           服务器状态卡片（API 查询 + MOTD 渲染）
│   ├── gallery.js          作品展示（API 加载 + 分类筛选 + 卡片跳转）
│   ├── gallery-detail.js   作品详情（Markdown + 相册 + 下载链接）
│   ├── hero-gallery.js     Hero 背景画廊
│   ├── admin-auth.js       统一管理认证模块
│   ├── admin.js            后台仪表盘/列表逻辑
│   ├── admin-edit.js       后台编辑表单逻辑
│   ├── wall.js             留言墙前端
│   ├── wall-admin.js       留言墙管理端
│   ├── marked.umd.js       Markdown 解析库
│   └── ...
├── assets/                 静态资源
├── package.json
├── favicon.ico / robots.txt / sitemap.xml
```

## 内容管理

所有内容通过管理后台（`/admin/`）增删改查，数据存储在数据库中。

### 新闻

通过 `/admin/news.html` 管理，支持：
- 创建/编辑/删除新闻文章
- Markdown 格式正文，前端用 marked.js 渲染
- 标签、封面图、摘要、作者等元数据
- 草稿/已发布状态切换

文章 URL：`/news/article.html?slug=<slug>`

### 活动

通过 `/admin/events.html` 管理，支持：
- 创建/编辑/删除活动
- 状态：即将开始 / 进行中 / 已结束
- 排序权重、置顶功能
- 封面图、外部链接

### 作品

通过 `/admin/gallery.html` 管理，支持：
- 创建/编辑/删除作品
- 封面图 + 大图，分类筛选
- 作者、简短描述、详细描述（Markdown）
- 相册多图管理、动态下载链接（名称 + URL）
- 状态：已发布 / 草稿
- 前端 `/gallery/` 以卡片网格展示，点击跳转详情页
- 详情页 `/gallery/detail.html?id=` — Modrinth 风格双栏布局：相册 + Markdown 描述 + 作者 + 下载按钮

### 服务器

通过 `/admin/` 服务器管理页面管理，支持：
- 创建/编辑/删除服务器条目
- 地址、端口、备注、排序、置顶
- 前端首页自动查询服务器状态（在线人数、版本、延迟、MOTD）
- 外部 API：`https://api.uemcraft.cn/mc-query/api/java/{address}`

### 留言墙

通过 `/wall/admin.html` 管理（或统一后台入口），支持：
- 审核（通过/屏蔽）、行内编辑、删除
- AI 自动审核（硅基流动 Qwen3.5-4B）

## 后端架构

### API 端点

| 文件 | 端点 | 说明 |
|------|------|------|
| `api/news.php` | `?action=list` / `?action=detail&slug=xxx` | 公开：新闻列表/详情 |
| `api/news.php` | `?action=admin_list` / `?action=admin_detail&id=xxx` | 管理：新闻列表/详情 |
| `api/news.php` | `?action=create` / `?action=update` / `?action=delete` | 管理：CRUD |
| `api/events.php` | `?action=list` / `?action=upcoming` / `?action=past` | 公开：活动列表 |
| `api/events.php` | `?action=admin_list` / `?action=admin_detail&id=xxx` | 管理：活动列表/详情 |
| `api/events.php` | `?action=create` / `?action=update` / `?action=delete` | 管理：CRUD |
| `api/works.php` | `?action=list` / `?action=detail&id=xxx` / `?action=detail&slug=xxx` | 公开：作品列表/详情 |
| `api/works.php` | `?action=admin_list` / `?action=admin_detail&id=xxx` | 管理：作品列表/详情 |
| `api/works.php` | `?action=create` / `?action=update` / `?action=delete` | 管理：CRUD |
| `api/servers.php` | `?action=list` / `?action=featured` | 公开：服务器列表/置顶 |
| `api/servers.php` | `?action=admin_list` / `?action=admin_detail&id=xxx` | 管理：服务器列表/详情 |
| `api/servers.php` | `?action=create` / `?action=update` / `?action=delete` | 管理：CRUD |
| `api/wall.php` | `?action=list` / `?action=post` | 公开：留言列表/发表 |
| `api/wall.php` | `?action=admin_list` / `?action=audit` / `?action=edit` / `?action=delete` | 管理：审核/编辑/删除 |

管理接口需请求头 `X-Admin-Token`。

### 数据库

默认 SQLite（零配置），可切换 MySQL。

- `api/site.db` — 新闻 + 活动 + 作品 + 服务器（运行期自动生成）
- `api/wall.db` — 留言墙（运行期自动生成）

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `ADMIN_TOKEN` | 是 | 统一管理后台令牌 |
| `SITE_DB_DRIVER` | 否 | `sqlite`（默认）/ `mysql` |
| `SITE_DB_HOST/PORT/NAME/USER/PASS` | 否 | site.db MySQL 连接参数 |
| `WALL_DB_DRIVER` | 否 | `sqlite`（默认）/ `mysql` |
| `WALL_DB_HOST/PORT/NAME/USER/PASS` | 否 | wall.db MySQL 连接参数 |
| `WALL_ADMIN_TOKEN` | 否 | 留言墙管理令牌（兼容，优先读 `ADMIN_TOKEN`） |
| `MODERATION_API_KEY` | 否 | 硅基流动 API Key，启用留言 AI 审核 |
| `MODERATION_MODEL` | 否 | 审核模型，默认 `Qwen/Qwen3.5-4B` |

## 数据迁移

从旧版 Markdown 文件 + data.js 迁移到数据库：

```bash
# 1. 导出 data.js 中的活动数据（如需要）
node -e "
const fs = require('fs');
const content = fs.readFileSync('js/data.js', 'utf8');
const match = content.match(/events:\s*(\{[\s\S]*?\})\s*\n\};/);
if (match) {
  const fn = new Function('return ' + match[1]);
  fs.writeFileSync('scripts/events-data.json', JSON.stringify(fn(), null, 2));
}
"

# 2. 运行迁移（SQLite）
php scripts/migrate-to-db.php

# 或 MySQL
SITE_DB_DRIVER=mysql SITE_DB_NAME=uemcraft SITE_DB_USER=root SITE_DB_PASS=密码 php scripts/migrate-to-db.php
```

## 设计系统

- **风格**："像素现代" — 低圆角 (4px)、硬阴影、像素网格纹理
- **配色**：CSS 自定义属性定义于 `tokens.css`，支持亮色/深色主题
- **主题色**：`#213d87`（深蓝）
- **字体**：Noto Sans SC（中文）+ Fusion Pixel（英文等宽）+ Minecraft AE（MOTD 展示）
- **图标**：iconfont 字体图标

### 服务器状态卡片

首页服务器区域（`#serverSection`）由 `js/server.js` 动态渲染，数据来自 `/api/servers.php`，状态查询外部 MC 查询 API。

卡片结构：头部（favicon + 服务器名 + 在线/离线徽章 + 地址复制）→ MOTD 区域（Minecraft 像素字体，支持 § 颜色代码）→ 统计底栏（在线人数 / 延迟 / 版本）。左侧彩色竖线标识状态（绿=在线，红=离线）。

## 本地预览

```bash
# PHP 内置服务器（推荐，支持 API）
php -S localhost:8080

# 或 Node.js
npx serve .
```

然后访问 `http://localhost:8080`。

## 部署

1. 将全部文件部署到支持 PHP 的服务器
2. 设置环境变量 `ADMIN_TOKEN`（管理后台令牌）
3. 可选：设置 MySQL 相关环境变量
4. 访问 `/admin/login.html` 登录管理后台

**PHP 要求**：PHP 7.4+，PDO + SQLite3 或 PDO + MySQL

可选平台：
- **宝塔面板** — 上传文件，配置 PHP + Nginx
- **VPS** — Nginx + PHP-FPM
- **虚拟主机** — 上传文件，确保 PHP 可执行

> **注意**：纯静态托管（GitHub Pages 等）无法运行 PHP 后端。数据库文件（`api/*.db`）为运行期自动生成，勿提交。

## 相关链接

| 名称 | 链接 |
|------|------|
| UEMCraft 官网 | https://uemcraft.cn |
| MUA | https://www.mualliance.cn/ |
| MUA 皮肤站 | https://skin.mualliance.ltd/ |
| YIT & UEM 联合皮肤站 | https://skin.uemcraft.cn/ |
| 应急管理大学 | https://www.ncist.edu.cn/ |
| 燕理MC玩家创作协会 | https://www.yitmc.cn |
| QQ 群 | https://qm.qq.com/q/VYDnv3ZJwC |
| B 站 | https://space.bilibili.com/3546888496221012 |
| 抖音 | https://v.douyin.com/Q44xZngm3ls/ |

## 许可证

[MIT](LICENSE) &copy; GengarP
