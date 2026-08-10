# UEMCraft 官方网站项目记忆

## 项目概况

应急管理大学 Minecraft 同好会（UEMCraft）纯静态官方网站。纯 HTML5 + CSS3 + Vanilla JS，零框架零依赖，可直接部署到任意静态托管。

### 文件结构

```
uemcraft.cn/
├── index.html / about.html / events.html / gallery.html / join.html / 404.html
├── css/  → tokens.css → base.css → layout.css → components.css → pages.css
├── js/   → main.js（全局）、server.js、events.js、gallery.js、join.js
├── assets/ → img/（logo webp / bg.jpg / minecraft_title.png）、svg/（占位图）、docs/章程.pdf、fonts/（iconfont.ttf / iconfont-theme.*）
├── favicon.ico、robots.txt
```

新增页面遵循 CSS 分层惯例，JS 按页面拆分用 `<script defer>` 加载。

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
- 相关链接：燕理MC玩家创作协会 / MUA皮肤站 / 应急管理大学

### 称谓
- 自称"社群"（非"社团"）
- 关于 MUA 的表述为"成员组织"（非"隶属"）

### Section 交替背景
- `.section-alt` 工具类提供微妙的交替背景色，Token `--c-bg-section-alt`（亮色 `#EBEDF3` / 深色 `#121624`），与主背景 `--c-bg` 仅差约 2%
- 所有页面 section 从 `page-hero` 下方第一个开始交替使用（pattern: alt → default → alt → …）
- 目的：让相邻 section 有肉眼可感知的区分但不刺眼

### 统计条
- 首页统计条保留三项：注册成员（200+）、建筑作品（1+）、已办活动（5+）
- 已删除"服务器在线率"指标

### 新闻卡片
- `.news-card` 使用左边缘彩色竖线（`border-left: 3px solid var(--c-primary)`）作为视觉焦点
- 日期使用常规字体（主色调加粗），非像素字体，与标题字体对齐
- 不使用 emoji 图标

### FAQ 手风琴
- `max-height` 过渡动画（0.25s），替代 `display:none/block` 的瞬时切换
- `+` → `−`（Unicode `\2212`）图标切换

### 服务器面板
- 地址显示 `play.uemcraft.cn`
- 地址旁有复制按钮，使用 `textarea` + `execCommand('copy')` fallback 确保非 HTTPS 环境可用

### 滚动条
- 自定义 WebKit 滚动条：10px 宽，`var(--c-bg)` 轨道，`var(--c-border)` 滑块，hover 变 `--c-primary`
- Firefox: `scrollbar-width: thin`

### 404 页
- Minecraft 主题文案"这个区块不存在"，简洁 footer

### 卡片/列表
- 活动卡片、新闻卡片、画廊卡片均可填充内容
- 首页"最新动态"有一条占位卡片：2026 年 10 月秋季招新
- 活动页"近期活动"和"往期回顾"当前为空容器，待后续填充

---

## 外部链接

| 名称 | URL |
|------|-----|
| MUA | https://www.mualliance.cn/ |
| MUA皮肤站 | https://skin.mualliance.ltd/ |
| 应急管理大学 | https://www.ncist.edu.cn/ |
| 燕理MC玩家创作协会 | http://mc.yitacm.cn/ |
| QQ群 | https://qm.qq.com/q/VYDnv3ZJwC |
| B站 | https://space.bilibili.com/3546888496221012 |
| 抖音 | https://v.douyin.com/Q44xZngm3ls/ |
