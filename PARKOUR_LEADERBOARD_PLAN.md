# 跑酷排行榜功能规划（待审批）

> 本文件仅描述拟议方案，**尚未修改代码**。审批通过后再开始执行。

## 1. 导航栏结构变更

按要求调整 `js/components-header.js` 中的 `NAV_ITEMS`：

- 首页
- 关于我们（下拉）
  - 加入我们
  - 皮肤站
- 活动中心
- 风采（下拉，`noLink: true`，不跳转）
  - 作品展示
  - 跑酷排行
- 资料（下拉，`noLink: true`，不跳转）
  - 资讯动态
  - 指南与文档
- 留言墙
- 捐赠者

说明：

- `风采` 与 `资料` 一样，本身不可点击，只作为下拉触发器。
- 移动端渲染为不可点击的分组标签 + 缩进子链接。
- 页脚 `js/components-footer.js` 的快速链接中新增「跑酷排行」。

## 2. 新增页面与文件

### 前台

- `/parkour/index.html`：跑酷排行榜主页
- `/parkour/player.html`：单个玩家数据二级页面
- `/js/parkour.js`：排行榜主页逻辑
- `/js/parkour-player.js`：玩家详情页逻辑

### 后台

- `/admin/parkour.html`：排行榜导入与管理页
- `/js/admin-parkour.js`：导入、编辑、删除等后台逻辑

### 后端

- `/api/parkour.php`：排行榜公开 API 与管理 API
- `common.php` 中新增建表与迁移逻辑

## 3. 数据库设计

新增表统一放入 `site.db`（SQLite / MySQL）。

### 3.1 `parkour_maps`

用于记录管理员导入并启用的排行榜。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER / INT UNSIGNED | 主键，自增 |
| source_file | TEXT / VARCHAR(255) | 导入来源 db 文件名 |
| source_course_id | INTEGER / INT | 来源 course.courseId |
| source_name | TEXT / VARCHAR(15) | 来源 course.name |
| display_name | TEXT / VARCHAR(100) | 对外展示名称，管理员可编辑 |
| close_at | INTEGER / INT NULL | 封榜时间戳，NULL 表示未封榜 |
| status | TEXT / VARCHAR(16) | `published` / `draft`，默认 `published` |
| created_at | INTEGER / INT | 创建时间 |
| updated_at | INTEGER / INT | 更新时间 |

建议唯一约束：`(source_file, source_course_id)`，避免同一来源重复导入。

### 3.2 `parkour_records`

用于保存导入的 `time` 记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER / INT UNSIGNED | 主键，自增 |
| map_id | INTEGER / INT UNSIGNED | 外键关联 `parkour_maps.id`，级联删除 |
| player_uuid | CHAR(36) / VARCHAR(36) | 玩家 UUID |
| time_ms | BIGINT / INTEGER | 成绩时间，按毫秒存储 |
| deaths | INTEGER / INT | 死亡次数 |
| achieved_at | INTEGER / INT | 达成时间戳 |
| source_time_id | INTEGER / INT NULL | 来源 `time.timeId` |
| created_at | INTEGER / INT | 导入时间 |

建议唯一约束：`(map_id, source_time_id)`；若来源无稳定 ID，则使用 `(map_id, player_uuid, time_ms, deaths, achieved_at)` 去重。

### 3.3 `parkour_player_cache`

用于缓存皮肤站 API 返回的玩家名和头像，减少重复请求。

| 字段 | 类型 | 说明 |
|------|------|------|
| uuid | CHAR(36) / VARCHAR(36) | 主键 |
| player_name | TEXT / VARCHAR(100) | 玩家名 |
| avatar_url | TEXT / VARCHAR(500) | 头像 URL |
| fetched_at | INTEGER / INT | 缓存时间 |
| expires_at | INTEGER / INT | 过期时间 |

缓存有效期建议 24 小时。API 失败时使用兜底名称，不向前端暴露 UUID。

## 4. 导入流程

1. 管理员在 `/admin/parkour.html` 上传 SQLite `.db` 文件。
2. 后端校验文件为合法 SQLite 数据库，并检查是否存在 `course`、`time` 表。
3. 后端返回 `course` 列表，包含：
   - `courseId`
   - `name`
   - `created`
   - 记录数量
   - 最早 / 最晚 `achieved` 时间
4. 管理员选择需要导入的 `courseId`。
5. 管理员填写：
   - 对外展示名称 `display_name`
   - 封榜日期 `close_date`
6. 后端在事务中导入：
   - 创建或更新 `parkour_maps`
   - 批量导入 `time` 记录
   - 去重，避免重复导入
7. 导入完成后返回导入数量与地图 ID。

### 4.1 封榜规则

- `close_at` 为 `NULL` 时，排行榜显示全部记录。
- `close_at` 不为 `NULL` 时，只显示 `achieved_at <= close_at` 的记录。
- 管理员可随时修改 `close_at`，前端重新查询即可生效。

### 4.2 安全限制

- 仅管理员可上传和导入。
- 限制上传文件大小，例如 50 MB。
- 仅允许 SQLite 文件，禁止直接执行上传文件。
- 临时文件导入完成后立即删除。
- 上传目录不直接对外可访问，或使用系统临时目录。

## 5. 皮肤站 API 集成

BaseURL：`https://skin.uemcraft.cn/`

### 5.1 获取玩家名

```text
GET /api/yggdrasil/sessionserver/session/minecraft/profile/{uuid}
```

返回示例：

```json
{"id":"{uuid}","name":"{name}","properties":[...]}
```

后端从 `name` 字段提取玩家名。

### 5.2 获取头像

```text
GET /avatar/player/{name}?size=128&png=true
```

前端或后端可直接拼接头像 URL。为避免大量前端请求，建议后端缓存玩家名，并返回头像 URL。

### 5.3 缓存策略

- 首次查询玩家名时写入 `parkour_player_cache`。
- 24 小时内直接使用缓存。
- API 失败时使用兜底名称，例如 `玩家 1234abcd`，但前端不展示 UUID。
- 头像 URL 使用玩家名构造，不缓存图片本体。

## 6. 公开 API 设计

### 6.1 获取地图列表

```text
GET /api/parkour.php?action=maps
```

返回：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "display_name": "跑酷地图 A",
      "close_at": 1730000000,
      "record_count": 120,
      "best_time_ms": 45230
    }
  ]
}
```

### 6.2 获取排行榜

```text
GET /api/parkour.php?action=ranking&map_id=1&page=1&limit=50
```

返回每个玩家的最好成绩，按以下顺序排序：

1. `time_ms` 升序
2. `deaths` 升序
3. `achieved_at` 升序

返回字段建议：

```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "player_name": "Steve",
      "avatar_url": "https://skin.uemcraft.cn/avatar/player/Steve?size=128&png=true",
      "time_ms": 45230,
      "deaths": 0,
      "achieved_at": 1729000000
    }
  ],
  "page": 1,
  "limit": 50,
  "total": 120,
  "pages": 3
}
```

说明：

- 前端不显示 UUID。
- UUID 仅用于跳转到玩家详情页，可作为查询参数传递，但页面中不展示。

### 6.3 获取玩家详情

```text
GET /api/parkour.php?action=player&uuid=...
```

返回：

- 玩家名
- 头像 URL
- 参与过的地图数量
- 每张地图的最好成绩与排名
- 全局最好排名
- Top 1 / Top 3 / Top 10 次数
- 表现最好的地图
- 排名趋势数据（按时间排序）

## 7. 前台页面设计

### 7.1 排行榜主页

页面路径：`/parkour/`

功能：

- 地图选择器，支持切换多张地图
- 排行榜表格
- 显示排名、头像、玩家名、成绩时间、死亡次数、达成时间
- 点击玩家进入二级页面
- 封榜地图显示「已封榜」标记
- 时间格式化为 `mm:ss.SSS` 或 `ss.SSS`

### 7.2 玩家二级页面

页面路径：`/parkour/player.html?uuid=...`

展示：

- 玩家头像与名称
- 表现最好的地图
- 全局最好名次
- Top 1 / Top 3 / Top 10 次数
- 各地图最好成绩与排名
- 排名趋势图（按时间）
- 最近成绩记录

说明：

- 排名趋势可使用原生 SVG 折线图，避免引入第三方图表库。
- 若某次成绩未进入前 N，仍可在趋势中显示其排名变化。

## 8. 后台管理设计

页面路径：`/admin/parkour.html`

功能：

- 上传 SQLite `.db` 文件
- 解析并显示 `course` 列表
- 选择 `courseId`
- 编辑展示名称
- 设置封榜日期
- 导入排行榜
- 查看已导入地图列表
- 编辑展示名称与封榜日期
- 删除已导入地图

后台导航 `js/components-admin.js` 中新增：

```js
{ label: '跑酷排行', path: 'parkour.html', match: ['parkour'], icon: '跑' }
```

## 9. 迁移与兼容

- 在 `createSiteTables()` 中新增三张表。
- 在 `migrateSiteTables()` 中增加 `CREATE TABLE IF NOT EXISTS` 与列兼容逻辑。
- 不影响现有新闻、活动、作品、捐赠、服务器等功能。
- 新页面复用现有 CSS 与 admin 样式。

## 10. 缓存版本号

修改 CSS / JS 后，需要更新所有 HTML / PHP 中的 `?v=` 版本号。计算方式按项目现有约定：

```bash
find css js admin/css -type f \( -name '*.css' -o -name '*.js' \) ! -path 'js/pdfjs/*' | sort | xargs cat | sha256sum | cut -c1-7
```

## 11. 待确认事项

1. 导入的 `.db` 是否仅支持 SQLite？若需要支持 MySQL 导出的 SQL 文件，需要额外设计解析器。
2. `time.time` 的单位是否为毫秒？本方案按毫秒处理。
3. `created` / `achieved` 时间戳单位是否为秒？本方案按 Unix 秒处理。
4. 封榜日期时区是否使用服务器默认时区？建议统一使用 `Asia/Shanghai`。
5. 玩家详情页是否需要展示 UUID？本方案不展示，仅内部跳转使用。
6. 是否需要支持手动录入或编辑单条成绩？本方案暂不支持，只支持从 db 导入。
7. 是否需要在前台展示地图来源名称？本方案默认不展示，仅管理员可见。

## 12. 审批请求

请审批以上方案。审批通过后，我将按本文件执行代码修改。

## 13. 补充说明：统一数据源

跑酷服务器采用“同一核心反复更换地图”的运营策略，因此 `parkour.db` 中的 `courseId` 会持续追加。本方案已支持重复上传同一个 `parkour.db`，并按 `(source_file, source_course_id)` 判断是否为同一地图：

- 若是新 `courseId`，创建新排行榜；
- 若是已导入的 `courseId`，更新展示名称、封榜日期与记录。

因此管理员可以持续从同一个数据库文件导入新增地图。