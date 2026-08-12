# UEMCraft 官方网站

> 应急管理大学 Minecraft 同好会官方网站 — [uemcraft.cn](https://uemcraft.cn)

纯静态网站，HTML5 + CSS3 + Vanilla JS，零框架零依赖，可直接部署到任意静态托管服务。

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
│   ├── _template.html      新闻模板
│   ├── autumn-recruitment.html
│   ├── club-charter.html
│   └── immersive-fight.html
├── css/
│   ├── tokens.css          设计令牌（配色/间距/字体）
│   ├── base.css            重置与基础样式
│   ├── layout.css          布局系统
│   ├── components.css      组件样式
│   └── pages.css           页面专属样式
├── js/
│   ├── main.js             全局（导航/主题/滚动）
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
└── LICENSE                 MIT
```

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

由于是纯静态站点，可直接部署到：

- **GitHub Pages** — 推送到 `gh-pages` 分支
- **Vercel / Netlify / Cloudflare Pages** — 连接仓库后自动部署
- **任意虚拟主机** — 上传全部文件即可

无需构建、编译或打包。

## 相关链接

| 名称 | 链接 |
|------|------|
| UEMCraft 官网 | https://uemcraft.cn |
| MUA | https://www.mualliance.cn/ |
| 应急管理大学 | https://www.ncist.edu.cn/ |
| QQ 群 | https://qm.qq.com/q/VYDnv3ZJwC |
| B 站 | https://space.bilibili.com/3546888496221012 |

## 许可证

[MIT](LICENSE) &copy; GengarP
