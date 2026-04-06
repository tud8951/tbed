# 项目简介

![](/doc/tbed.svg)

一个基于 Cloudflare Pages 构建的在线共享图片站（tbed）。支持图片上传、主页展示与分享、点赞统计、热门/最新分类、分页浏览，以及带密码的管理员后台（删除、修改点赞、开关上传与过滤、选择过滤账号）。

| ![](/doc/main.png) | ![](/doc/admin.png) |
|-----------------------|-----------------------|
| ![](/doc/main.png) | ![](/doc/admin.png) |

## 许可协议
- 本项目采用 Apache License 2.0
- 完整文本见 [LICENSE](./LICENSE)

## 特性
- 图片上传（JPG/PNG ≤ 5MB），失败信息友好
- 首页“热门/最新”切换；分页：移动端每页 10 张、桌面端每页 21 张
- 复制分享链接（包含正确文件后缀），支持下载
- 懒加载缩略图与边缘代理 `/api/i/:id`，加速加载
- 点赞计数，前端本地去重
- 管理后台：分页、删除、保存点赞、允许上传开关、开启图片过滤开关
- 图片过滤（Sightengine）：支持多个账号，后台下拉切换；开启过滤时“先审核再写库与推送”，不合规返回 415
- 多图床策略：Telegraph（三域）优先，失败回退 Telegram 直链（过滤通过后执行）
- SEO：已添加 robots.txt 与首页 meta（description/keywords/OG）
- 后台显示上传者 IP，并支持点击复制

## 技术栈
- Cloudflare Pages + Functions
- Cloudflare KV（元信息与设置）/ D1（图片索引与点赞）
- Telegram Bot（回退图床与推送）/ Sightengine（图片审核）

## 快速开始
- 本地开发：`npm i` → `npm run dev`，本地环境变量写入 `.dev.vars`（`PASSWORD`、可选 `TGBOT`、`TGGROUP`）
- 初始化 D1：进入数据库执行 [d1/schema.sql](https://github.com/tud8951/tbed/blob/main/d1/schema.sql)
- 绑定：在 Pages 仪表盘添加 Bindings（KV=kv，D1=db），并配置环境变量
- 验证：访问 `/api/env?test=1`、`/api/count`；进入 `/admin` 进行基础操作

# 部署指南（Cloudflare Pages）

## 必要配置
- Functions 目录：`/functions`（无需构建命令）
- Bindings
  - KV Namespace：Binding 名 `kv`
  - D1 Database：Binding 名 `db`
- Environment Variables
  - `PASSWORD`：管理员后台密码
  - `TGBOT`、`TGGROUP`（可选，用于 Telegram 推送）
  - `SIGHTENGINE_USER`、`SIGHTENGINE_KEY`（可选，支持数组：`["user1","user2"]`、`["secret1","secret2"]`）

## 一次性初始化
- 打开 D1 数据库 → Query → 执行 `d1/schema.sql`

## 路由与接口
- 页面：`/` 首页；`/admin` 管理后台（需 Bearer `PASSWORD`）
- 列表：`GET /api/images?sort=hot|latest&limit=20&cursor=...`
- 上传：`POST /api/upload`（JPG/PNG ≤ 5MB）
- 代理：`GET /api/i/:id?w=...&h=...&q=...`
- 点赞：`POST /api/like`
- 设置：`GET /api/settings`
- 管理：`GET /api/admin/images`、`POST /api/admin/delete`、`GET/POST /api/admin/settings`

## 分页与前端行为
- 移动端每页 10 张；桌面端每页 21 张
- 页码可直接跳转；绑定 D1 可随机访问任意页

## 图片过滤（可选）
- 在后台启用“开启图片过滤”
- 多账号：`SIGHTENGINE_USER=["user1","user2"]`、`SIGHTENGINE_KEY=["secret1","secret2"]`
- 当前账号索引存储：KV `settings:sightengine_index`

## 验证
- `GET /api/env?test=1` 查看绑定状态（脱敏）
- `GET /api/count` 查看总图片数量

## 本地开发
- `npm i`、`npm run dev`
- `.dev.vars` 写入 `PASSWORD`（以及可选 `TGBOT`、`TGGROUP`）
