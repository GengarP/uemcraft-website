# UEMCraft 官方网站

> 应急管理大学 Minecraft 同好会官方网站 — [uemcraft.cn](https://uemcraft.cn)

以纯静态为主，HTML5 + CSS3 + Vanilla JS，零框架零依赖。留言墙（`wall/`）例外，带 PHP + SQLite 后端，需部署到支持 PHP 的服务器。

## 项目结构

```
├── index.html              首页
├── about.html              关于
├── events.html             活动
├── join.html               加入我们
├── 404.html                404 页面
├── gallery/
│   └── index.html          画廊
├── news/
│   ├── index.html          新闻列表
│   └── article.html        通用文章详情（?slug= 加载）
├── wall/
│   ├── index.html          留言墙（需 PHP 后端）
│   └── admin.html          留言墙管理端
├── api/
│   └── wall.php            留言墙后端（PHP + SQLite，AI 审核）
├── css/
│   ├── tokens.css          设计令牌（配色/间距/字体）
│   ├── base.css            重置与基础样式
│   ├── layout.css          布局系统
│   ├── components.css      组件样式
│   └── pages.css           页面专属样式
├── js/
│   ├── main.js             全局（导航/主题/滚动）
│   ├── data.js             内容数据源（新闻/活动）
│   ├── content.js          内容渲染（列表/详情/预览）
│   ├── hero-gallery.js     首页背景画廊（左右滑动）
│   ├── server.js           服务器面板
│   ├── events.js           活动页
│   ├── gallery.js          画廊页
│   └── join.js             加入页（FAQ 手风琴）
├── assets/
│   ├── img/                图片（logo / 背景 / 头像 / 活动图）
│   ├── svg/                SVG 占位图
│   ├── docs/               章程 PDF
│   └── fonts/              自托管字体（像素字体 / iconfont）
├── favicon.ico
├── robots.txt
├── sitemap.xml
└── LICENSE                 MIT
```

## 内容管理

新闻与活动集中在 `js/data.js`（`window.UEMCRAFT_DATA`）：

- **新增新闻**：在 `news` 数组加一个对象（含 `markdown`），详情页统一为 `news/article.html?slug=<slug>`，列表 / 首页预览自动渲染。
- **新增活动**：在 `events.upcoming` / `events.past` 加一个对象。
- 新增新闻后需在 `sitemap.xml` 手动补一条 `<url>`。

详见 `CLAUDE.md`。

## 留言墙

站内唯一带后端的功能，其余页面仍为纯静态。

- **前端**：`wall/index.html` + `js/wall.js`；管理端 `wall/admin.html` + `js/wall-admin.js`（需 token）
- **后端**：`api/wall.php`，PDO + SQLite（默认），可用环境变量切换 MySQL
- **AI 审核**：发布前调用硅基流动 Qwen3.5-4B 审核，仅判定合规才公开；不合规或服务不可用均入库为 `hidden` 待人工复核

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `WALL_ADMIN_TOKEN` | 是 | 管理端鉴权 token |
| `MODERATION_API_KEY` | 是 | 硅基流动 API Key，启用 AI 审核 |
| `MODERATION_MODEL` | 否 | 默认 `Qwen/Qwen3.5-4B` |
| `WALL_DB_DRIVER` | 否 | `sqlite`（默认）/ `mysql` |
| `WALL_DB_HOST/PORT/NAME/USER/PASS` | 否 | 切 MySQL 时填写 |

> 未配置 `MODERATION_API_KEY` 时，所有新留言默认进入待审核（`hidden`）状态，需在后台人工复核。

## 设计系统

- **风格**："像素现代" — 低圆角 (4px)、硬阴影、像素网格纹理
- **配色**：全部通过 CSS 自定义属性定义于 `tokens.css`，支持亮色/深色主题切换
- **主题色**：`#213d87`（深蓝）
- **字体**：
  - 中文：Noto Sans SC（Google Fonts CDN）
  - 英文等宽：Fusion Pixel 12px Proportional Latin（自托管 woff2）
- **图标**：iconfont 字体图标（QQ / Bilibili / 抖音 / 主题切换）

## 本地预览

无需构建步骤，直接用任意静态服务器打开即可：

```bash
# Python
python -m http.server 8080

# Node.js（需安装 serve）
npx serve .

# PHP
php -S localhost:8080
```

然后访问 `http://localhost:8080`。

## 部署

除留言墙外均为纯静态，可直接部署到：

- **GitHub Pages** — 推送到 `gh-pages` 分支
- **Vercel / Netlify / Cloudflare Pages** — 连接仓库后自动部署
- **任意虚拟主机** — 上传全部文件即可

无需构建、编译或打包。

> **留言墙例外**：`wall/` 依赖 PHP + PDO（SQLite 或 MySQL），纯静态托管无法运行，须部署到支持 PHP 的服务器（如宝塔、Nginx + PHP-FPM）。SQLite 的 `api/wall.db` 为运行期自动生成，勿提交。

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
