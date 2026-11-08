# AGENTS.md

content：Rei 上传图片集，访客在公开页只看到马赛克图，凭获取码下载原图，每个码每张图只能下一次。线上地址 `https://content.rei8t.dev`。

产品细节和数据模型都在 [docs/PRODUCT.md](docs/PRODUCT.md)，动手前先读。

## 当前阶段

MVP 已上线（2026-11-05）。付费版没做，只留了字段。

## 边界

- 原图不能有任何公开地址。R2 桶不开公共访问；原图只从 `/dl/<ticket>` 经 Worker 鉴权后流式返回。
- 缩略图也不公开，只给下过这张图的获取码看。
- Worker 里不做图片处理。马赛克图和缩略图都在后台浏览器里用 canvas 生成。
- 「每码每图一次」靠 D1 的 `UNIQUE(code_id, image_id)`：先插入占位，再出文件。别改成先查再写。
- 付费版只在数据模型里留字段（`access_mode`、`price_cents`、`currency`、`source`、`order_ref`），不写支付逻辑。

## 技术栈

- 前端：TypeScript + React + Vite，Kumo 组件（`npx skills add cloudflare/kumo@kumo-design`，用 kumo-design 统筹设计，尽量用 Kumo components），Lucide 图标，9 种语言（中文是源语言），明暗主题。
- 后端：Cloudflare Worker（名字 `content`），D1 `content-db`，R2 `content`。
- 包管理只用 pnpm。提交 `pnpm-lock.yaml`，不要 `package-lock.json`。
- 登录：Google OAuth，管理员看 `ADMIN_EMAILS`（逗号分隔），默认 `reiy.leoz@gmail.com`。

## 目录

```
src/          Worker：index.ts 路由和定时任务，auth.ts 登录，admin.ts 后台接口，public.ts 公开接口和下载，cleanup.ts 每天北京时间 3:00 的清理
src/shared/   前后端共用类型、获取码规则；i18n.ts 语言列表和状态码说明，errors.ts 错误文案（9 种语言）
web/          前端（Vite + React + Kumo），lib/preview.ts 在浏览器里生成马赛克图和缩略图，i18n/ 界面文案
migrations/   D1 迁移
scripts/      build-inline-assets.mjs（前端内联进 Worker）、kumo-lint.mjs
test/e2e.mjs  本地端到端检查（占位、并发下载、作废、免码与上限、清理等）。本地限流也生效，连跑两次要隔一分钟
docs/         产品说明
.agents/      给 agent 用的 skills（kumo-design）、rules、prompts、memory
```

## 命令

```bash
pnpm install
pnpm db:migrate:local            # 本地 D1
pnpm dev                         # 构建 + wrangler dev，端口 8787（.dev.vars 里 AUTH_DISABLED=true 可跳过登录）
BASE=http://127.0.0.1:8787 pnpm test:e2e   # 另开终端跑端到端检查
pnpm test                        # kumo 规则 + 类型检查
pnpm db:migrate                  # 线上 D1 迁移
pnpm deploy                      # 构建并部署到 content.rei8t.dev
```

`src/assets.generated.ts` 由 `pnpm build` 生成，不入库。

## 约定

- HTTP 状态码出现在界面或文档里时，带一句说明：文档里用中文，如「403 无权限」「409 已经下载过」；界面上用当前语言，如「403 Forbidden」。

## 多语言

界面默认跟浏览器语言，顶栏可以手动换。细节见 docs/PRODUCT.md「多语言」。

- 界面文案：`web/src/i18n/zh.ts` 是源，其他语言（en、es、pt、ru、ja、de、fr、id）各一个文件，类型 `Dict` 保证键一个不少。带数字的文案写成函数；英、西、葡、德、法、俄的单复数用 `plural.ts`。
- 组件里用 `const { t } = useI18n()`；组件外（抛错、复制出去的文字）用 `getT()`。不要在组件里直接写中文字符串。
- 日期用 `lib/format.ts` 的 `fmtTime` / `fmtDay`，它们跟着当前语言走。
- 服务端错误：`throw new HttpError(状态码, "错误键", params?)`，错误键和 9 种语言的文案都在 `src/shared/errors.ts`。接口返回 `{ error: 中文, code, params, status }`，前端 `errMsg()` 按 code 翻译并拼上状态码说明。状态码说明在 `src/shared/i18n.ts` 的 `STATUS_TEXTS`。
- 新加文案：在 `zh.ts` 加键，再给其他 8 个文件补上，`pnpm test` 会报漏掉的。译文要像当地人写的，别逐字翻。
- 加一种语言：`src/shared/i18n.ts` 的 `LOCALES`、`LOCALE_NAMES`、`STATUS_TEXTS`、`CSV_TEXTS` 各加一项；`src/shared/errors.ts` 每个错误加一条；`web/src/i18n/` 复制 `en.ts` 改成新语言，并在 `i18n/index.ts` 的 `DICTS` 里登记。
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

- Cloudflare 账号 `9151f72e404dd53f20b8e6667893237d`。D1 `content-db`（86c3d103-2bad-4499-9196-239ddbc12460），R2 `content`。
- Secrets：`GOOGLE_CLIENT_SECRET`、`SESSION_SECRET`、`IP_HASH_SALT`；`GOOGLE_CLIENT_ID` 和 `ADMIN_EMAILS` 写在 wrangler.jsonc 的 vars 里。
- `wrangler.jsonc`：`workers_dev: false`，`routes: [{ "pattern": "content.rei8t.dev", "custom_domain": true }]`，`observability.enabled: true`。
- Google Cloud 里要加回调：`https://content.rei8t.dev/auth/callback` 和 `http://localhost:8787/auth/callback`。
