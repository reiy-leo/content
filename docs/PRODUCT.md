# content 产品说明

> 状态：Rei 2026-11-05 确认，按默认值实现，已上线。

## 一句话

Rei 上传图片集，访客在公开页面只能看到马赛克图；拿到获取码的人可以下载原图，每个码每张图只能下一次。

地址：`https://content.rei8t.dev`

## 谁在用

| 角色 | 是谁 | 能做什么 |
| --- | --- | --- |
| 管理员 | `ADMIN_EMAILS` 里的 Google 账号，默认 `reiy.leoz@gmail.com` | 建项目、传图、发布、生成和作废获取码、看使用情况 |
| 访客 | 拿到项目链接的任何人，不用登录 | 看马赛克预览；填获取码后下载原图 |

## MVP 功能

### 后台（`/admin`，要登录）

1. 用 Google 登录。不在白名单里的账号进不来，提示「403 无权限」。
2. 新建项目：填名字，系统给一个短地址 `slug`（可改，发布后也能改，但旧链接会失效）。
3. 往项目里上传多张图片，可拖拽排序、删除单张。
   - 浏览器里用 canvas 先生成两张小图，和原图一起上传：
     - 马赛克图：先缩到长边 24 格，再放大到长边 960px，关掉平滑，存 WebP。看得出构图和颜色，看不清细节。
     - 缩略图：长边 480px，WebP，清晰。只给已经下过这张图的获取码看。
   - 原图原样上传，不压缩、不改格式。
   - 支持 JPEG、PNG、WebP、AVIF、GIF（GIF 预览只取第一帧）。HEIC 浏览器解不了，提示先转成 JPEG。
   - 单张原图上限 95MB（Worker 单次请求最多 100MB）。
4. 发布 / 取消发布。草稿和取消发布的项目，公开地址返回「404 找不到」。
5. 获取码：
   - 一次生成 N 个（1 到 500），过期时间默认 7 天，可选 1 小时、1/3/7/30/90 天、任意日期或不过期。可写一条备注（比如「给某某」）。
   - 码的样子：8 位，`ABCD-EFGH`，用去掉了 0/O、1/I/L 这类易混字符的字母和数字。输入不分大小写，横线可有可无。
   - 列表里每个码显示：状态（可用 / 已过期 / 已作废）、已下 x / 共 y 张、最后一次下载时间、过期时间、备注。
   - 可以单个或批量作废；可以一键复制或导出 CSV。
   - 点开一个码，能看到它下过哪几张、什么时候下的。
6. 获取码开关（项目页标题下面），切换前弹窗确认：
   - 开（默认）：要获取码才能下载。一开就立即停止免码下载，已经发出去、还没打开的免码下载链接也失效。
     - 右边有「获取码」按钮：生成 1 个 1 小时有效的码，把码、公开地址和说明（1 小时内有效，每张图只能下一次）一起复制到剪贴板。
   - 关：免码，任何人打开公开页都能直接下载原图，同一张图可以重复下。每个 IP 每分钟最多 50 次；可以设整个项目最多下载多少次（比如 500），留空不限。
7. 项目列表的卡片：开着获取码显示「用了 x 个码」（至少下过一张图的码）；关着显示「免码，已下载 x / 上限 次」。
8. 每天北京时间 3:00 自动清理：过期了还一张没下过的获取码直接删掉；票据过期没打开的占位记录也删掉。下过图的码留着，用来统计。

### 公开页（`/p/<slug>`）

1. 所有图只显示马赛克图。原图和缩略图都没有公开地址。
2. 页面上有获取码输入框。填了以后：
   - 码不存在：「404 获取码不对」。
   - 码过期或作废：提示「这个码已作废 / 已在某天过期，不能再下载」。下过的图照样显示缩略图。
   - 码可用：每张图下面出现「下载原图」按钮，顶部显示「还能下 x 张，码 11 月 12 日过期」。
3. 下过的图：这张图换成清晰缩略图，按钮变成灰色「已下载」，不能再下。其他图照常能下。
4. 「下载剩下的全部」按钮：逐张下载还没下过的图。
5. 填码成功后弹出「使用须知」：只限自己使用，不能转卖或再次销售；不是独占授权；不包含商业授权。要商业授权，或定制动作、定制配对头像，联系邮件 hi@rei8t.dev 或微信 antitsunny（两个都能点按钮复制）。
6. 项目关了获取码时，不显示输入框，每张图直接有「下载原图」，设了上限就显示「整个项目还能下载 x 次」，用完了按钮变灰。
7. 码只存在这个浏览器标签页里（sessionStorage），关掉要重新填。不放 cookie，也不放进 URL。
8. 明暗主题跟随系统，也可以手动切。
9. 界面语言默认跟浏览器走，顶栏可以手动换，见下面「多语言」。

### 首页（`/`）

只放一句说明和后台入口，不列出任何项目。项目只能靠链接进入。

## 下载怎么保证「每码每图一次」

关键是先占位、再出文件，靠数据库唯一约束挡住并发。

1. 访客点「下载原图」，前端 `POST /api/p/<slug>/downloads`，带上获取码和图片 ID。
2. Worker 在一个事务里跑两条 SQL，都带「码可用、图属于这个项目、项目已发布」的条件。`downloads` 表上有 `UNIQUE(code_id, image_id)`。
   - 还没有记录：插入一条 `pending`，返回一次性下载票据（随机 43 位），10 分钟内有效。
   - 已有 `pending`（点过下载、文件还没开始传）：换一张新票据，旧票据作废。
   - 已经 `done`：返回「409 这张图已经用这个码下载过」。
3. 前端拿票据跳到 `GET /dl/<ticket>`。Worker 把票据标成已用，再从 R2 流式读原图返回，带 `Content-Disposition: attachment` 和原文件名。
4. 票据只能用一次：`pending → done` 只有一个请求能改成功，并发打开同一张或多张票据，只有一个拿到文件。
5. 票据一旦被打开、开始传输，就算下过了，传到一半断了也算。票据过期没用，可以回页面重新点下载，换一张新票据。

R2 桶不开公共访问，也不绑域名。原图只能从 `/dl/<ticket>` 拿。

## 防滥用

- 填码和点下载按 IP 限流：各自每分钟 10 次，超了返回「429 请求太多」。免码下载每个 IP 每分钟 50 次。码空间是 31⁸，约 8500 亿，配合限流猜不出来。
- 票据有效期 10 分钟、只能用一次。
- 后台所有接口都校验登录和白名单，并校验 Origin，防跨站请求。

## 以后再做（这次不做）

- 付费版：访客付钱自动拿到获取码。数据模型里先留字段（见下），不写支付逻辑。
- 原图加水印、按码打隐形标记。
- 超过 95MB 的大文件（要用 R2 分片上传）。
- 访问统计。

## 不做

- 访客注册登录。
- 公开的项目列表或搜索。
- 在 Worker 里处理图片（缩放、转码）。预览图都在后台浏览器里生成。

## 数据模型

D1 数据库 `content-db`，R2 桶 `content`。时间都存 Unix 毫秒（UTC），界面按浏览器时区显示。ID 用 nanoid（21 位）。

### projects 项目

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | |
| slug | TEXT UNIQUE | 公开地址 `/p/<slug>`，小写字母、数字、横线 |
| title | TEXT | 项目名 |
| description | TEXT | 可空，公开页标题下的一段话 |
| status | TEXT | `draft` / `published` |
| access_mode | TEXT | 默认 `code`。预留 `paid`（付费版） |
| price_cents | INTEGER | 预留，可空 |
| currency | TEXT | 预留，可空，如 `CNY` |
| created_at / updated_at / published_at | INTEGER | published_at 可空 |

### images 图片

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | |
| project_id | TEXT FK → projects，删项目时一起删 | |
| position | INTEGER | 排序 |
| filename | TEXT | 原文件名，下载时用 |
| mime | TEXT | |
| size_bytes | INTEGER | |
| width / height | INTEGER | |
| original_key | TEXT | R2：`originals/<project_id>/<image_id>` |
| mosaic_key | TEXT | R2：`previews/<project_id>/<image_id>/mosaic.webp` |
| thumb_key | TEXT | R2：`previews/<project_id>/<image_id>/thumb.webp` |
| created_at | INTEGER | |

索引：`(project_id, position)`。

### code_batches 获取码批次

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | |
| project_id | TEXT FK | |
| count | INTEGER | 这批生成几个 |
| expires_at | INTEGER | 可空，空表示不过期 |
| note | TEXT | 可空 |
| created_at | INTEGER | |

### access_codes 获取码

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | |
| project_id | TEXT FK | |
| batch_id | TEXT FK → code_batches，可空 | |
| code | TEXT UNIQUE | 规范化后的 8 位码（大写、无横线）。存明文，方便后台随时复制导出 |
| expires_at | INTEGER | 可空 |
| revoked_at | INTEGER | 可空，有值就是已作废 |
| note | TEXT | 可空 |
| source | TEXT | 默认 `admin`。预留 `purchase`（付费版） |
| order_ref | TEXT | 预留，可空，付费版订单号 |
| created_at | INTEGER | |

索引：`(project_id, created_at)`。

### downloads 下载记录

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | |
| code_id | TEXT FK → access_codes，删码时一起删 | |
| image_id | TEXT FK → images，删图时一起删 | |
| ticket_hash | TEXT UNIQUE | 票据的 SHA-256，不存明文 |
| ticket_expires_at | INTEGER | 占位时间 + 10 分钟 |
| status | TEXT | `pending`（已占位、票据未用）/ `done`（已开始传输） |
| created_at | INTEGER | 占位时间 |
| completed_at | INTEGER | 可空，票据被打开的时间 |
| ip_hash | TEXT | 可空，IP 加盐哈希，只用来排查 |

约束：`UNIQUE(code_id, image_id)`。这条就是「每码每图一次」的保证。

### free_downloads 免码下载记录

列和 `downloads` 一样，只是把 `code_id` 换成 `project_id`，也没有每图一次的唯一约束。占位时用一条 `INSERT … SELECT … WHERE` 同时检查「项目已发布、免码、图属于项目、已用次数 < 上限」，已用次数 = 已完成的 + 票据还没过期的占位，所以并发也不会超。打开票据时再检查一次项目还是免码。

projects 表另加两列：`code_required`（1 要码，默认；0 免码）、`max_downloads`（免码下载上限，空 = 不限）。迁移在 `migrations/0002_access_toggle.sql`。

### 占位的两条 SQL（示意，实际代码在 `src/public.ts`）

```sql
-- 已有 pending：换新票据
UPDATE downloads SET ticket_hash = ?hash, ticket_expires_at = ?now + 600000
WHERE code_id = ?1 AND image_id = ?2 AND status = 'pending' AND <码可用且图属于项目>;

-- 没有记录：插入 pending；已有记录（pending 或 done）就什么都不做
INSERT INTO downloads (...) SELECT ... WHERE <码可用且图属于项目>
ON CONFLICT (code_id, image_id) DO NOTHING;
```

两条放进一个 `batch()`，D1 按事务执行。两条都没改到行：已有 `done` 就返回 409，否则 404。

### 用票据换文件

```sql
UPDATE downloads SET status = 'done', completed_at = ?now
WHERE ticket_hash = ?hash AND status = 'pending' AND ticket_expires_at > ?now
RETURNING image_id;
```

更新到 1 行才去 R2 取文件；0 行返回「410 下载链接已失效」。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/auth/login`、`/auth/callback`、`/auth/logout` | Google 登录 |
| GET | `/api/me` | 当前登录信息 |
| GET/POST | `/api/admin/projects` | 列表、新建 |
| GET/PATCH/DELETE | `/api/admin/projects/:id` | 详情、改名改 slug、发布、开关获取码（`codeRequired`）、免码上限（`maxDownloads`）、删除 |
| POST | `/api/admin/projects/:id/images` | 上传一张（multipart：原图 + 马赛克 + 缩略图） |
| DELETE | `/api/admin/images/:id` | 删除 |
| GET | `/api/admin/images/:id/original`、`/thumb`、`/mosaic` | 管理员看原图和预览图 |
| GET/POST | `/api/admin/projects/:id/codes` | 码列表、批量生成（`count`，有效期用 `expiresInHours`、`expiresInDays` 或 `expiresAt`） |
| POST | `/api/admin/projects/:id/codes/revoke` | 作废或恢复（`{ ids, restore }`），单个、批量都走这里 |
| PUT | `/api/admin/projects/:id/images/order` | 保存排序 |
| GET | `/api/admin/codes/:id/downloads` | 这个码的下载明细 |
| GET | `/api/admin/projects/:id/codes.csv` | 导出 CSV |
| GET | `/api/p/:slug` | 公开项目信息和图片列表（只有马赛克地址） |
| GET | `/api/p/:slug/mosaic/:imageId` | 马赛克图，可长缓存 |
| POST | `/api/p/:slug/unlock` | 校验码，返回状态和每张图下没下过 |
| GET | `/api/p/:slug/thumb/:imageId` | 缩略图，只有下过这张图的码能看。码放在 `X-Access-Code` 头里，不进 URL；前端 fetch 后用 blob 显示 |
| POST | `/api/p/:slug/downloads` | 占位，返回票据。带 `code` 走获取码；不带就是免码下载，项目要码时返回「403 无权限」，次数用完返回「410 已失效」 |
| GET | `/dl/:ticket` | 用票据下载原图 |

出错时统一返回 `{ "error": "中文说明", "code": "code_wrong", "params": {}, "status": 404 }`。`code` 是固定的错误键，前端按它翻成当前语言；界面上显示成「404 找不到：获取码不对」「404 Not Found: That code isn't right.」这种格式。`params` 只在文案带参数时才有。

## 多语言

> Rei 2026-11-08：「支持 i18n，默认匹配浏览器语言」。

- 9 种语言：简体中文（源语言）、英语、西班牙语、葡萄牙语、俄语、日语、德语、法语、印尼语。
- 默认语言：按浏览器的语言列表（`navigator.languages`）从前往后找第一个支持的。只看主语言，所以 `zh-TW`、`zh-HK` 都用简体中文，`pt-BR` 用葡萄牙语。一个都对不上就用英语；只有浏览器是中文才显示中文。
- 顶栏有语言菜单（Lucide 的 Languages 图标，主题按钮左边）：选了某种语言就记在 `localStorage` 和 cookie `ct-lang` 里，以后一直用它；选「跟随浏览器」就清掉记录。切换后 `<html lang>` 和页面标题跟着变。
- 日期按当前语言格式化，时区仍跟浏览器。
- 状态码出现在界面上时，带一句当前语言的说明，如「403 无权限」「403 Forbidden」。
- `/dl/<ticket>` 出错时是服务端直接出的页面：先看 cookie `ct-lang`，没有就看 `Accept-Language`。
- 导出 CSV 时带上当前语言（`?lang=en`），表头和状态用这种语言；不带就是中文。
- 站名：中文「内容快递」，其他语言都叫「Content Drop」（Rei 2026-11-08 改名）。
- 联系方式（hi@rei8t.dev、微信 antitsunny）各语言都一样，不翻译。

## 技术栈

- 前端：TypeScript + React + Vite，Kumo 组件，Lucide 图标，明暗主题。
- 后端：Cloudflare Worker（TypeScript），D1，R2，Workers Rate Limiting。
- 包管理 pnpm。前端打包后内联进 Worker 部署（Hark 的 token 走 Static Assets 上传会 401）。

## 已定（Rei 2026-11-05，按默认值）

1. 下载传到一半断了也算用掉。
2. 网站显示名：中文「内容快递」，英文「Content Drop」（2026-11-08 改，原来是「原图获取」）。
3. 码默认一次 10 个、7 天过期。
4. Google OAuth 复用 Rei 各 Worker 共用的 Web client。

## 已定（Rei 2026-11-05 晚）

1. 获取码可开关，关了就免码下载（每 IP 每分钟 50 次，可设上限）；开关前弹窗确认。
2. 「获取码」按钮一键生成 1 小时的码并复制说明；批量生成保留，有效期多一个 1 小时选项。
3. 每码每图一次不变。
4. 填码后弹出使用须知，微信号 antitsunny、邮箱 hi@rei8t.dev 可点击复制。
5. 每天北京时间 3:00 清理过期没用过的码。
