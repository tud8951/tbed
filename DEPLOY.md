# Cloudflare Pages 仪表盘部署与绑定（最简）

## 一次性准备
- 创建 Pages 项目：选择 “Direct Upload” 或 “Connect to Git”
- 上传代码或连接仓库后，Pages 会自动识别 functions/ 作为 Functions
- 本项目无需构建命令；如已设置，请清空 Build command

## 仪表盘绑定
1) 进入 Pages → 你的项目 → Settings → Functions → Bindings
- 添加 KV Namespace
  - Binding: kv
  - 选择或创建一个命名空间
- 添加 D1 Database
  - Binding: db
  - 选择或创建一个 D1 数据库

2) 环境变量
- Pages → 项目 → Settings → Environment Variables
- 添加：
  - TGBOT: Telegram 机器人令牌（形如 123456789:AA...）
  - TGGROUP: 目标群/频道 id（-100 开头的 id 或 @username）

3) 初始化 D1 表（一次性）
- 打开 D1 数据库 → Query
- 复制 d1/schema.sql 内容并执行

## 验证
- 访问 /api/env?test=1 查看状态（脱敏输出）
  - kv_bound=true、d1_bound=true、telegram_token_valid=true 表示绑定与令牌正常
- 上传一张 JPG/PNG（≤ 5MB）
  - 成功后会写入 D1/KV，并向群/频道推送图片

## 说明
- 绑定名需与代码一致：kv、db
- wrangler.toml 只保留基础配置；正式环境的绑定全部在仪表盘完成

---

## 路由与功能概览
- 前端页面
  - `/`：首页（默认展示“最热门”），分页浏览与懒加载缩略图
  - `/admin`：管理后台（需要密码）
- API
  - `GET /api/images?sort=hot|latest&limit=20&cursor=...`：图片列表（支持分页；limit 由前端按设备选择）
  - `POST /api/upload`：上传图片（JPG/PNG ≤ 5MB）
  - `GET /api/i/:id?w=640&h=...&q=75`：图片代理与加速（支持 Cloudflare 边缘缩放）
  - `POST /api/like`：点赞计数 +1
  - `GET /api/settings`：公共设置（allow_upload、filter_enabled）
  - 管理后台（需 Authorization: Bearer PASSWORD）
    - `GET /api/admin/images`：图片列表
    - `POST /api/admin/delete`：删除图片
    - `GET /api/admin/settings`：获取后台设置（allow_upload、filter_enabled）
    - `POST /api/admin/settings`：更新后台设置（toggle_upload、toggle_filter、set_likes）

## 必要绑定与环境变量
- Functions → Bindings
  - KV Namespace：Binding 名必须为 `kv`
  - D1 Database：Binding 名必须为 `db`
- Environment Variables（Pages 仪表盘）
  - `TGBOT`：Telegram 机器人令牌（形如 `123456789:AA...`）
  - `TGGROUP`：目标群/频道 id（`-100...` 或 `@username`）
  - `PASSWORD`：管理后台密码
- 可选环境变量（启用图片过滤时）
  - `SIGHTENGINE_USER`：Sightengine api_user
  - `SIGHTENGINE_KEY`：Sightengine api_secret

## 本地调试
- 安装依赖：`npm i`
- 初始化 D1（本地）：`npm run db:prepare`
- 启动本地开发：`npm run dev`
- 本地环境变量文件：`.dev.vars`
  - 示例键位：`TGBOT=...`、`TGGROUP=...`、`PASSWORD=...`
  - 本地不需要绑定名变更，保持 `kv`、`db`

## 验证步骤
1) 访问 `/_routes`（由 Pages Dev 输出）确认 Functions 生效
2) 访问 `/api/env?test=1`
   - `kv_bound=true`、`d1_bound=true` 表示存储绑定正常
   - `telegram_token_valid=true` 表示机器人令牌有效
3) 打开 `/admin`，输入 `PASSWORD` 进入后台
   - 可切换“允许上传新图片”，前端首页随即禁用/启用上传入口
   - 支持直接修改某张图片的点赞数并保存
4) 上传一张图片
   - 首选 Telegraph（telegra.ph / te.legra.ph / graph.org）三端回退
   - 若 Telegraph 都失败且配置了 `TGBOT`/`TGGROUP`，回退 Telegram 直链
   - 成功后会写入 D1/KV，并向 Telegram 推送图片
5) 图片过滤（可选）
   - 在后台启用“开启图片过滤”，支持多个 Sightengine 账号：
     - `SIGHTENGINE_USER=["user1","user2"]`
     - `SIGHTENGINE_KEY=["secret1","secret2"]`
     - 后台下拉切换当前使用账号，保存在 KV `settings:sightengine_index`
   - 单值回退：若为单个字符串 `SIGHTENGINE_USER` / `SIGHTENGINE_KEY` 也可正常使用

6) 分页行为
   - 移动端每页 10 张
   - 桌面端每页固定 21 张
   - 页码数字可直接跳转（显示已加载页的数字），也可使用上一页/下一页
   - 上传时先审核，通过再写入与推送；不合规返回 415

## 常见问题
- 无法在代码里设置绑定：请只在 Pages 仪表盘设置 Bindings 名称（kv、db）
- 首页图片加载慢：已使用 `/api/i/:id` 代理与边缘缓存；首屏为缩略图，滚动懒加载
- 看不到图：确保图片链接统一为 `/api/i/:id`（代码已统一处理）
- 后台密码报错：在仪表盘添加 `PASSWORD` 并重新部署；本地使用 `.dev.vars`

## D1 表结构
- 位于 `d1/schema.sql`，执行一次以创建 `images` 表：
  - `id TEXT PRIMARY KEY`
  - `url TEXT NOT NULL`
  - `ts INTEGER NOT NULL`
  - `likes INTEGER NOT NULL DEFAULT 0`
