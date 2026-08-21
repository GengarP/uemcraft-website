# UEMCraft 官方网站项目记忆

## 项目概况

应急管理大学 Minecraft 同好会（UEMCraft）官方网站。前端纯 HTML5 + CSS3 + Vanilla JS，零框架零依赖。后端 PHP + PDO（SQLite 或 MySQL），提供新闻、活动、留言墙的管理 API 和管理后台。

### 文件结构

```
uemcraft.cn/
├── index.html / about.html / events.html / join.html / 404.html
├── admin/ → 管理后台
│   ├── login.html（登录页）、index.html（仪表盘）
│   ├── news.html / news-edit.html（新闻管理）
│   ├── events.html / events-edit.html（活动管理）
│   └── css/admin.css（后台样式）
├── news/ → index.html（资讯列表）、article.html（文章详情，?slug= 加载）
├── gallery/ → index.html
├── wall/ → index.html（留言墙）、admin.html（留言墙管理端）
├── api/ → 后端 API
│   ├── common.php（公共函数库：PDO 连接、token 校验、JSON 响应）
│   ├── news.php（新闻 API：公开 list/detail + 管理 CRUD）
│   ├── events.php（活动 API：公开 list/upcoming/past/detail + 管理 CRUD）
│   └── wall.php（留言墙 API：公开 list/post + 管理审核/编辑/删除 + AI 审核）
├── scripts/ → migrate-to-db.php（一次性数据迁移脚本）
├── css/ → tokens.css → base.css → layout.css → components.css → pages.css
├── js/
│   ├── main.js（全局：导航/主题/滚动/动画）
│   ├── content.js（内容渲染：从 API 加载新闻和活动）
│   ├── admin-auth.js（统一管理认证模块）
│   ├── admin.js（后台仪表盘/列表逻辑）
│   ├── admin-edit.js（后台编辑表单逻辑）
│   ├── wall.js（留言墙前端）、wall-admin.js（留言墙管理端）
│   ├── marked.umd.js（Markdown 解析）
│   └── hero-gallery.js / server.js / events.js / gallery.js / join.js
├── assets/ → img/、svg/、docs/章程.pdf、fonts/（iconfont / Fusion Pixel）
├── package.json、favicon.ico、robots.txt、sitemap.xml
```

新增页面遵循 CSS 分层惯例，JS 按页面拆分用 `<script defer>` 加载。

### 内容管理（新闻）

新闻通过管理后台 `/admin/news.html` 管理，数据存储在数据库 `site.db` 的 `news` 表中。

- **新增新闻**：登录管理后台 → 新闻管理 → 新建新闻 → 填写表单（标题、slug、日期、作者、摘要、Markdown 正文、标签、封面图）→ 保存
- **文章 URL**：`/news/article.html?slug=<slug>`
- **前端加载**：`content.js` 通过 `fetch` 从 `/api/news.php?action=list` 和 `?action=detail&slug=xxx` 异步加载
- **Markdown 渲染**：数据库 `content` 字段存储 Markdown 原文，前端用 `marked.umd.js` 渲染
- **脚本顺序**（`defer`）：`content.js` → `main.js`（不再依赖 data.js）

### 内容管理（活动）

活动通过管理后台 `/admin/events.html` 管理，数据存储在数据库 `site.db` 的 `events` 表中。

- **新增活动**：登录管理后台 → 活动管理 → 新建活动 → 填写表单（标题、slug、状态、日期标签、封面图、摘要、链接）→ 保存
- **状态**：upcoming（即将开始）/ ongoing（进行中）/ past（已结束）
- **前端加载**：`content.js` 通过 `fetch` 从 `/api/events.php?action=upcoming` 和 `?action=past` 异步加载

### 管理后台

统一管理后台入口：`/admin/`

- **登录**：`/admin/login.html`，使用 `ADMIN_TOKEN` 环境变量对应的令牌
- **仪表盘**：`/admin/index.html`，显示新闻/活动统计，链接到各管理页面
- **认证模块**：`js/admin-auth.js`，提供 token 存储（localStorage key `uemcraft-admin-token`）、验证、API 请求封装
- **样式**：`admin/css/admin.css`，复用 `tokens.css` 变量
- **导航**：后台顶部有统一导航栏（仪表盘 / 新闻管理 / 活动管理 / 留言墙管理）
- **留言墙管理**：`/wall/admin.html` 也集成了后台导航栏，复用 `admin-auth.js`

### 留言墙（留言板）

- **前端**：`wall/index.html` + `js/wall.js`。表单（昵称 + 内容，实时字数统计）、留言列表（`.wall-card`）、分页（`.wall-pagination`）。
- **管理端**：`wall/admin.html` + `js/wall-admin.js`。输入 token 后列出全部留言，可按状态筛选、审核（通过/屏蔽）、行内编辑、删除。`<meta name="robots" content="noindex,nofollow">` 不收录。
- **后端**：`api/wall.php` 引入 `common.php`。默认 SQLite（库文件 `api/wall.db` 自动建表）；设 `WALL_DB_DRIVER=mysql` 及对应环境变量可切 MySQL。
- **审核模式**：先审后发——新留言调用硅基流动 Qwen3.5-4B 审核，仅判定合规才 `status='approved'` 公开；不合规或服务不可用均入库为 `hidden` 待人工复核。
- **接口**：公开 `GET ?action=list` + `POST ?action=post`；管理 `GET ?action=admin_list` + `POST ?action=audit/edit/delete`。管理接口需 `X-Admin-Token` 请求头。
- **校验与限流**：昵称 2–20 字符、内容 ≤500 字符；同 IP 60 秒限发一条。

### 后端 API 架构

#### common.php（公共函数库）

从 `wall.php` 抽离的公共逻辑，供所有 API 复用：

- `connectDb($driver, $dbPath, $createFn, $migrateFn, $envPrefix)` — 通用 PDO 连接（SQLite/MySQL 切换）
- `getSiteDb()` / `getWallDb()` — 获取 site.db / wall.db 连接
- `requireAdmin($envName)` — token 校验，优先读指定环境变量，回退到 `ADMIN_TOKEN`
- `json_response($data, $code)` — JSON 响应 + exit
- `readInput()` / `charCount()` / `getClientIp()` / `requireId()` — 工具函数
- CORS 头统一在此设置

#### 数据库

- **site.db**（新闻 + 活动）：环境变量 `SITE_DB_DRIVER`（默认 sqlite）、`SITE_DB_HOST/PORT/NAME/USER/PASS`
- **wall.db**（留言墙）：环境变量 `WALL_DB_DRIVER`（默认 sqlite）、`WALL_DB_HOST/PORT/NAME/USER/PASS`
- 建表自动执行（SQLite 仅新库时、MySQL 用 `CREATE TABLE IF NOT EXISTS`）
- 表结构见 `common.php` 的 `createSiteTables()` / `createWallTables()`

#### 管理令牌

- 统一使用 `ADMIN_TOKEN` 环境变量
- `wall.php` 向后兼容：优先读 `WALL_ADMIN_TOKEN`，回退到 `ADMIN_TOKEN`
- 请求头 `X-Admin-Token`，用 `hash_equals` 时序安全比较

---

## 设计系统

- **配色变量**: 全部定义在 `css/tokens.css`，通过 `[data-theme="dark"]` 切换
- **主题色**: `#213d87`（深蓝），变体 `#217087` / `#214d87` / `#212b87` / `#392187`
- **亮色**: `--c-bg: #F0F2F7`, `--c-bg-section-alt: #EBEDF3`, `--c-surface: #FFFFFF`, `--c-text: #1A1D28`
- **深色**: `--c-bg: #0F1320`, `--c-bg-section-alt: #121624`, `--c-surface: #1C2338`, `--c-text: #E2E5ED`
- **主题记忆**: `main.js` 中 localStorage + 系统 `prefers-color-scheme`，页头按钮切换
- **风格**: "像素现代" — 低圆角 4px、硬阴影、像素网格纹理

### 字体

- **中文**: Noto Sans SC（Google Fonts CDN，思源黑体），字重 400/500/700/900
- **英文等宽**: Fusion Pixel 12px Proportional Latin（自托管 woff2，`assets/fonts/`），用于 badge / 统计数字 / 标签 / 导航。Latin 子集仅覆盖英文/数字，中文回退到 Noto Sans SC
- 所有 UI 组件引用 `var(--c-*)` 变量，不硬编码颜色

### 图标

- **社交图标**: QQ / Bilibili / 抖音，使用 iconfont 字体图标（`assets/fonts/iconfont.ttf`），`font-family: "iconfont"`，类名 `.icon-QQ` / `.icon-douyin` / `.icon-bilibili-fill`
- **主题切换图标**: 太阳/月亮，使用 iconfont 字体图标（`assets/fonts/iconfont-theme.*`），`font-family: "iconfont-theme"`，类名 `.icon-sun` / `.icon-moon`。太阳金色 `var(--c-gold)`，月亮蓝色 `var(--c-primary)`
- **页面装饰图标**: 使用 CSS 彩色方块 + 汉字替代 emoji（`.icon-block` / `.icon-dot` / `.hero-icon` 等）

---

## 关键决策

### Hero 区
- `object-fit: cover` 全幅覆盖 bg.jpg，CSS 渐变背景作为空 `src` 兜底
- Hero 内容区使用全宽暗色面板（`width:100%; max-width:none;`，暗色 `rgba(15,19,32,.55)`），仅上下边框、无圆角
- `.hero-index-content` 覆写 `.container` 的 `max-width` 以撑满屏幕，内部文字元素自行约束宽度居中
- hover 仅改变背景色和边框色，不做位移
- Hero 标题使用 `assets/img/minecraft_title.png` 图片替代文字
- 浮动装饰为 CSS 纯色方块（金/蓝/紫），移动端隐藏

### 导航栏
- 默认实色背景，滚动后变为半透明 + `backdrop-filter: blur(12px)`（`.is-scrolled`）
- 移动端全屏菜单：`visibility` + `opacity` + `translateY` 动画（0.2s），链接依次交错入场
- `matchMedia('(min-width: 992px)')` 监听：窗口跨断点自动关闭菜单

### 章程 PDF
- iframe 预览 + 下载按钮，`max-width: 800px; height: 700px`，不用 `aspect-ratio`
- 副本 `assets/docs/章程.pdf`

### 表单
- join.html 已删除报名表单（原为纯静态，拼接文本复制到剪贴板）
- 保留报名流程步骤、联系方式卡片（含 iconfont 图标链接）、FAQ 折叠（`max-height` 动画手风琴）
- `js/join.js` 仅保留 FAQ accordion 动画逻辑

### 页脚
- 四列网格：品牌信息 / 快速链接 / 联系方式 / 相关链接
- 联系方式：iconfont 图标 + 平台名，点击直接跳转
- Badge（UEMCraft / MUA）：hover 背景变 `--c-primary`、文字变白、上浮 1px
- 相关链接：燕理MC玩家创作协会 / MUA 皮肤站 / 应急管理大学

### 称谓
- 自称"社群"（非"社团"）
- 关于 MUA 的表述为"成员组织"（非"隶属"）

### Section 交替背景
- `.section-alt` 工具类提供微妙的交替背景色，Token `--c-bg-section-alt`（亮色 `#EBEDF3` / 深色 `#121624`），与主背景 `--c-bg` 仅差约 2%
- 所有页面 section 从 `page-hero` 下方第一个开始交替使用（pattern: alt → default → alt → …）
- 目的：让相邻 section 有肉眼可感知的区分但不刺眼

### 统计条
- 首页统计条保留三项：注册成员（150+）、建筑作品（1+）、已办活动（5+）
- 已删除"服务器在线率"指标

### 关于我们（首页 vs about.html）
- 首页「关于同好会」为精简居中介绍：`.club-intro-body` + `.club-intro-logo`（128px 像素 logo）/ `.club-intro-lead`（导语）/ `.club-intro-stats`（三项统计，mono 数字 + 菱形分隔）+ 「了解更多 →」按钮，只做 teaser
- about.html 为详细「扁平杂志式」布局：`.about-body`（260px logo + lead/desc/meta）+ `.about-pillars`（三大特色，色条锚点、无卡片），其下继续接时间线 / 组织架构 / 部门职责 / 成员 / 章程
- `.about-visual` 不设 `position: sticky`，避免滚动时 logo 被 sticky 导航栏挤开

### 新闻卡片
- `.news-card` 使用左边缘彩色竖线（`border-left: 3px solid var(--c-primary)`）作为视觉焦点
- 日期使用常规字体（主色调加粗），非像素字体，与标题字体对齐
- 不使用 emoji 图标

### 活动卡片
- 时间徽章（`.event-date-badge`）与状态标签（`.event-status`）统一圆角 `var(--radius)`（4px，非胶囊）
- 二者由 `.event-img-meta` 容器包裹，绝对定位于活动图片左下角（在活动信息上方）
- 由 `js/content.js` 的 `renderEventCard` 渲染，首页预览与活动页共用

### FAQ 手风琴
- `max-height` 过渡动画（0.25s），替代 `display:none/block` 的瞬时切换
- `+` → `−`（Unicode `\2212`）图标切换

### 服务器面板
- 地址显示 `play.uemcraft.cn`
- 地址旁有复制按钮，使用 `textarea` + `execCommand('copy')` fallback 确保非 HTTPS 环境可用
- 移动端：状态指示点居中、标题与刷新按钮同一行、地址/复制与统计行分开（统计行虚线分隔）

### 滚动条
- 自定义 WebKit 滚动条：10px 宽，`var(--c-bg)` 轨道，`var(--c-border)` 滑块，hover 变 `--c-primary`
- Firefox: `scrollbar-width: thin`

### 404 页
- Minecraft 主题文案"这个区块不存在"，简洁 footer

### 卡片/列表
- 新闻卡片由 `js/content.js` 通过 fetch 从 `/api/news.php?action=list` 异步加载渲染
- 活动卡片由 `js/content.js` 通过 fetch 从 `/api/events.php?action=upcoming` 异步加载渲染
- 首页"最新动态"取前 3 条新闻，不足自动补"敬请期待"空卡

---

## 外部链接

| 名称 | URL |
|------|-----|
| MUA | https://www.mualliance.cn/ |
| MUA 皮肤站 | https://skin.mualliance.ltd/ |
| YIT & UEM 联合皮肤站 | https://skin.uemcraft.cn/ |
| 应急管理大学 | https://www.ncist.edu.cn/ |
| 燕理MC玩家创作协会 | https://www.yitmc.cn |
| QQ群 | https://qm.qq.com/q/VYDnv3ZJwC |
| B站 | https://space.bilibili.com/3546888496221012 |
| 抖音 | https://v.douyin.com/Q44xZngm3ls/ |
