# 管理员体系 OAuth 化 + RBAC 权限节点 + 跑酷主页跳转 实施方案

## Context

当前管理后台用静态 `ADMIN_TOKEN`（`X-Admin-Token` 请求头）鉴权，无用户概念。本次改造：删除令牌体系，管理端改为复用已建成的皮肤站 OAuth 会话；第一个登录用户自动成为超级管理员，后续用户为普通用户；超管可设置他人为管理员并分配**模块级权限节点**，可将超管身份转交（自己降为普通用户，已确认）。同时跑酷排行榜点击玩家时，若对方有**公开主页**则跳转 `/profile/?id=N`。

## 1. 数据模型与权限定义（api/common.php）

- `users` 表新增两列（`createUserTables()` 双驱动 DDL + `migrateSiteTables()` 幂等 ALTER，沿用现有 "SELECT 列 LIMIT 0 失败则 ALTER" 模式）：
  - `role` VARCHAR(16)/TEXT NOT NULL DEFAULT 'user' —— `user` / `admin` / `super_admin`
  - `perms_json` TEXT NOT NULL DEFAULT '[]' —— 管理员拥有的节点 key 数组
- 权限节点常量 `ADMIN_PERMISSION_NODES`（单一来源，PHP 常量 + 通过接口下发给前端）：
  `news 新闻管理 / events 活动管理 / works 作品管理 / docs 文档管理 / donations 捐赠管理 / servers 服务器管理 / pcl PCL 主页 / images 图片管理 / parkour 跑酷排行 / wall 留言墙管理`
- `userView()` 增加 `role`、`perms` 字段（仅 me/profile 等本人接口返回；公开主页接口不暴露角色）。

## 2. 后端鉴权核心（api/common.php）

- **删除** `requireAdmin()`、`WALL_ADMIN_TOKEN` 概念，CORS 白名单去掉 `X-Admin-Token`。
- 新增：
  - `requireAdminNode($db, $node)`：未登录 → **401**；role=user → **403「需要管理员权限」**；super_admin → 放行；admin → 节点在 `perms_json` 内放行，否则 **403「没有该模块的操作权限」**。
  - `requireSuperAdmin($db)`：未登录 401；非 super_admin → 403。
- CSRF：依赖会话 cookie 的 `SameSite=Lax`（跨站 POST 不带 cookie）；`api/admin.php` 的写操作额外强制 `application/json`（复用 `update_profile` 的做法）。

## 3. 现有管理接口改造（10 个文件 / 53 个调用点）

把每个 action 分支首行的 `requireAdmin()` 换成 `requireAdminNode($db, '<模块>')`，模块与文件一一对应：`news.php`→news、`events.php`→events、`works.php`→works、`docs.php`→docs、`donations.php`→donations、`servers.php`→servers、`pcl.php`→pcl、`images.php`→images、`parkour.php` 的 5 个管理 action→parkour、`wall.php` 的 5 个管理 action→wall（wall.php 数据用 wall.db，鉴权用 `getSiteDb()` 查用户）。公开 action 不变。

## 4. 新增 api/admin.php —— 用户与权限管理（除注明外均 super-only）

| action | 说明 |
|---|---|
| `nodes` (GET) | 返回节点列表 `[{key,label}]`（给权限面板用） |
| `users_list` (GET) | 用户列表：id、昵称、邮箱、role、perms、展示角色、加入/最近登录时间（分页/搜索可后置） |
| `set_role` (POST) | `{user_id, role: 'admin'|'user'}`；不可修改 super_admin；降为 user 时清空 perms |
| `set_perms` (POST) | `{user_id, nodes: []}`；逐项校验节点白名单；目标须为 admin |
| `transfer_super` (POST) | `{user_id}`；目标不可是自己；目标升 super_admin，**原超管降为 user 并清空 perms** |

## 5. 首登超管引导（api/auth.php）

`authUpsertUser()` 完成 upsert 后：若 `SELECT COUNT(*) FROM users WHERE role='super_admin'` 为 0，则把当前用户提升为 super_admin。覆盖两种情况：全新库的第一个登录者；已有历史用户但尚无超管的存量库（部署后第一个登录者完成初始化）。写入 CLAUDE.md 说明。

## 6. 管理端前端改造

- **`js/admin-auth.js` 重写**：去掉 token/localStorage；`session()` 走 `../api/auth.php?action=me` 缓存于内存；`api()` 同源 fetch（cookie 自动携带），401 → 跳登录页，403 → 抛 `forbidden` 由页面处理；`requireAuth(node)` 校验登录 + 角色 + 节点，无权限时展示「无权限」提示/跳转；`logout()` → POST `auth.php?action=logout` → 登录页；保留 escapeHtml/setText/showMessage/pad。
- **`admin/login.html` + `js/admin-login.js` 重写**：去掉 token 表单，改为「使用皮肤站账号登录」按钮（→ `/api/auth.php?action=login&return=/admin/`）；页面加载时若已登录且为管理员 → 直接进仪表盘；已登录但普通用户 → 提示无管理权限并给退出按钮。
- **`js/components-admin.js`**：`ADMIN_NAV` 每项增加 `node` 字段（仪表盘 null），新增「用户与权限」(users.html，superOnly)；渲染后按会话隐藏无权限项（已确认「隐藏并拦截」）；登出改走 `Auth.logout()`。
- **各业务模块 JS**：`admin-list.js`/`admin-edit.js` 的 `requireAuth()` 传入对应模块节点；`admin-dashboard.js` 仅拉取有权限模块的统计并隐藏对应卡片；`admin-parkour.js`、`wall-admin.js`、`admin-pcl.js` 去掉手工 token 头，统一走 `Auth.api`；`admin-list.js` 图片上传与 `admin-parkour.js` 的 FormData 上传改为同源 fetch（cookie 鉴权）。
- **新增 `admin/users.html` + `js/admin-users.js`**：用户表格（昵称/邮箱/角色/权限/最近登录）、设为管理员/普通用户、模块权限勾选保存、超管转交（二次确认）；仅超管可访问，页面级拦截 + 接口 403 双保险。
- 样式补充进 `admin/css/admin.css`（权限勾选网格、角色标签）。

## 7. 跑酷排行榜 → 个人主页

- `api/parkour.php` 新增 `parkourUserMap($db)`：取 `users WHERE is_public=1`，用 `player_uuid` + `players_json` 全部角色建「归一化 UUID（小写去横线）→ user_id」映射（沿用 `normUuid()` 思路）。
- `?action=ranking` 每行追加 `user_id`（无匹配为 null）；`?action=player` 响应追加 `user_id`。
- `js/parkour.js:88`：有 `user_id` → `href="/profile/?id="+user_id`，否则保持 `player.html?uuid=...`；`js/parkour-player.js` 在玩家名旁增加「个人主页」链接（仅注册且公开的用户）。
- 仅 `is_public=1` 才生成链接（已确认），避免跳进「未公开档案」404。

## 8. 收尾

- 全站 `?v=` 版本号重算替换（改动了 css/js，项目铁律）。
- README 删除 `ADMIN_TOKEN` / `X-Admin-Token` 说明，改述“后台使用皮肤站账号登录，首登即超管”；CLAUDE.md 增加角色/节点/转交/引导规则与模块文档更新（含 `/admin/` 登录方式变更）。
- `scripts/migrate-to-db.php` 无需改（列迁移由 `migrateSiteTables` 幂等完成）。

## 9. 验证（本地 php -S + curl，沿用之前带 pdo_sqlite 的启动方式）

1. 匿名访问任意管理接口 → 401；普通用户会话 → 403；admin 且无节点 → 403；admin 且有节点 → 200；super_admin → 全部 200（抽样 news/parkour/wall/images 验证节点隔离）。
2. 首登引导：清空 users 后种子一名用户，调用提升逻辑（CLI 脚本验证 SQL）→ role 变 super_admin；已有超管时不再提升。
3. `api/admin.php`：users_list / set_role / set_perms / transfer_super 全流程（含非法节点、改超管被拒、转交后原超管变 user、目标变 super）。
4. 跑酷：种子用户（公开 + 非公开各一）与跑酷记录，`ranking` 仅公开用户返回 user_id、未注册玩家为 null；`player` 同。
5. 浏览器快速验证：未登录打开 `/admin/news.html` 应跳登录页；普通用户登录后台应提示无权限；超管可见「用户与权限」并完成一次授权操作。
