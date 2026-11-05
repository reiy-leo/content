# AGENTS.md

content：Rei 上传图片集，访客在公开页只看到马赛克图，凭获取码下载原图，每个码每张图只能下一次。线上地址 `https://content.rei8t.dev`。

产品细节和数据模型都在 [docs/PRODUCT.md](docs/PRODUCT.md)，动手前先读。

## 当前阶段

产品说明和数据模型在等 Rei 确认。确认前不写业务代码、不部署。

## 边界

- 原图不能有任何公开地址。R2 桶不开公共访问；原图只从 `/dl/<ticket>` 经 Worker 鉴权后流式返回。
- 缩略图也不公开，只给下过这张图的获取码看。
- Worker 里不做图片处理。马赛克图和缩略图都在后台浏览器里用 canvas 生成。
- 「每码每图一次」靠 D1 的 `UNIQUE(code_id, image_id)`：先插入占位，再出文件。别改成先查再写。
- 付费版只在数据模型里留字段（`access_mode`、`price_cents`、`currency`、`source`、`order_ref`），不写支付逻辑。

## 技术栈

- 前端：TypeScript + React + Vite，Kumo 组件（`npx skills add cloudflare/kumo@kumo-design`，用 kumo-design 统筹设计，尽量用 Kumo components），Lucide 图标，中文界面，明暗主题。
- 后端：Cloudflare Worker（名字 `content`），D1 `content-db`，R2 `content`。
- 包管理只用 pnpm。提交 `pnpm-lock.yaml`，不要 `package-lock.json`。
- 登录：Google OAuth，管理员看 `ADMIN_EMAILS`（逗号分隔），默认 `reiy.leoz@gmail.com`。

## 目录（计划）

```
web/        前端（Vite + React + Kumo）
worker/     Worker 代码
migrations/ D1 迁移
docs/       产品说明
.agents/    给 agent 用的 skills、rules、prompts、memory
```

## 命令（计划）

```bash
pnpm install
pnpm dev          # 本地 wrangler dev，端口 8787
pnpm build        # 打包前端并内联进 Worker
pnpm deploy       # 部署到 content.rei8t.dev
pnpm db:migrate   # 跑 D1 迁移
```

## 约定

- HTTP 状态码出现在界面或文档里时，带一句中文说明，如「403 无权限」「409 已经下载过」。
- 中文文档写成人说的话：少用被动、删掉「进行」「通过」这类空词。写完用 AutoCorrect 检查空格和标点。
- 登录错误提示：首页一进来就用 `history.replaceState` 抹掉 `?login_error`；Banner 带关闭按钮；登录成功后不显示。
- `.gitignore` 写 `/public/`，不要写 `public/`。
- 每轮工作做完就 commit 并 push 到 `main`。
- 发版、打 tag 前先问 Rei。

## 禁止

- 不在 Rei 的 Mac 上跑测试。用 Hark 沙箱或 LightVela。
- 不把密钥写进仓库。本地用 `.dev.vars`（已忽略），清单见 `.dev.vars.example`。
- 不给 R2 桶绑公共域名，不开 `r2.dev`。

## 部署

- Cloudflare 账号 `9151f72e404dd53f20b8e6667893237d`。
- `wrangler.jsonc`：`workers_dev: false`，`routes: [{ "pattern": "content.rei8t.dev", "custom_domain": true }]`，`observability.enabled: true`。
- Google Cloud 里要加回调：`https://content.rei8t.dev/auth/callback` 和 `http://localhost:8787/auth/callback`。
