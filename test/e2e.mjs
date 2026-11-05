// 本地端到端检查：先 pnpm build && wrangler d1 migrations apply content-db --local，再 wrangler dev（AUTH_DISABLED=true），然后 node test/e2e.mjs
import { deflateSync } from "node:zlib";
const B = process.env.BASE ?? "http://localhost:8787";
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fails++; };

function png(w, h, rgb) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(rgb, y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const j = async (path, init = {}) => {
  const r = await fetch(B + path, { ...init, headers: { "Content-Type": "application/json", Origin: B, ...(init.headers ?? {}) }, body: init.json ? JSON.stringify(init.json) : init.body });
  let body = null; try { body = await r.clone().json(); } catch {}
  return { status: r.status, body, r };
};

const slug = "e2e-" + Date.now().toString(36);
const p = await j("/api/admin/projects", { method: "POST", json: { title: "端到端测试", slug } });
ok(p.status === 201, `新建项目 201（${p.status}）`);
const pid = p.body.id;
ok((await j(`/api/p/${slug}`)).status === 404, "草稿项目公开页 404 找不到");
ok((await j(`/api/admin/projects/${pid}`, { method: "PATCH", json: { status: "published" } })).status === 400, "没图不能发布 400");

const imgs = [];
for (const color of [[255, 0, 0], [0, 128, 255]]) {
  const fd = new FormData();
  fd.append("original", new Blob([png(64, 48, color)], { type: "image/png" }), "原图 测试.png");
  fd.append("mosaic", new Blob([png(8, 6, color)], { type: "image/png" }), "m.png");
  fd.append("thumb", new Blob([png(32, 24, color)], { type: "image/png" }), "t.png");
  fd.append("filename", "原图 测试.png"); fd.append("width", "64"); fd.append("height", "48");
  const r = await fetch(`${B}/api/admin/projects/${pid}/images`, { method: "POST", body: fd, headers: { Origin: B } });
  ok(r.status === 201, `上传图片 201（${r.status}）`);
  imgs.push((await r.json()).id);
}
ok((await j(`/api/admin/projects/${pid}`, { method: "PATCH", json: { status: "published" } })).status === 200, "发布 200");
const pub = await j(`/api/p/${slug}`);
ok(pub.status === 200 && pub.body.images.length === 2, "公开页有 2 张图");
ok(!JSON.stringify(pub.body).includes("original"), "公开接口不含原图字段");
ok((await fetch(`${B}/api/p/${slug}/mosaic/${imgs[0]}`)).status === 200, "马赛克图可以公开拿");

const gen = await j(`/api/admin/projects/${pid}/codes`, { method: "POST", json: { count: 3, expiresInDays: 7 } });
ok(gen.status === 201 && gen.body.codes.length === 3, "生成 3 个码");
const [c1, c2, c3] = gen.body.codes;
ok((await j(`/api/p/${slug}/unlock`, { method: "POST", json: { code: "ZZZZ-ZZZZ" } })).status === 404, "错码 404");
const un = await j(`/api/p/${slug}/unlock`, { method: "POST", json: { code: c1.toLowerCase() } });
ok(un.status === 200 && un.body.status === "active" && un.body.downloaded.length === 0, "小写码也能用，状态可用");

// 缩略图：没下过不能看
ok((await fetch(`${B}/api/p/${slug}/thumb/${imgs[0]}`, { headers: { "X-Access-Code": c1 } })).status === 403, "没下过不能看缩略图 403");

// 并发占位：都拿到票据，但只有最后一张票据有效；再并发打开 → 只有一个 200
const tickets = await Promise.all(Array.from({ length: 5 }, () => j(`/api/p/${slug}/downloads`, { method: "POST", json: { code: c1, imageId: imgs[0] } })));
ok(tickets.every((t) => t.status === 200), "并发占位都返回票据（pending 会换新票据）");
const urls = tickets.map((t) => t.body.url);
const dl = await Promise.all([...urls, ...urls].map((u) => fetch(B + u)));
const okCount = dl.filter((r) => r.status === 200).length;
ok(okCount === 1, `10 次并发打开票据，只有 1 次拿到原图（${okCount}）`);
const good = dl.find((r) => r.status === 200);
ok(good && /attachment/.test(good.headers.get("content-disposition") ?? ""), "原图带 attachment 下载头");
const buf = good ? Buffer.from(await good.arrayBuffer()) : Buffer.alloc(0);
ok(buf.length > 50 && buf[1] === 0x50, "拿到的是 PNG 原图");

const again = await j(`/api/p/${slug}/downloads`, { method: "POST", json: { code: c1, imageId: imgs[0] } });
ok(again.status === 409, `同码同图再下 409 已下载过（${again.status}）`);
ok((await j(`/api/p/${slug}/downloads`, { method: "POST", json: { code: c2, imageId: imgs[0] } })).status === 200, "别的码还能下这张");
ok((await j(`/api/p/${slug}/downloads`, { method: "POST", json: { code: c1, imageId: imgs[1] } })).status === 200, "同一个码还能下别的图");
ok((await fetch(`${B}/api/p/${slug}/thumb/${imgs[0]}`, { headers: { "X-Access-Code": c1 } })).status === 200, "下过的图能看缩略图");
const un2 = await j(`/api/p/${slug}/unlock`, { method: "POST", json: { code: c1 } });
ok(un2.body.downloaded.length === 1 && un2.body.downloaded[0] === imgs[0], "unlock 返回已下载列表");

// 作废
const list = await j(`/api/admin/projects/${pid}/codes`);
const c3id = list.body.find((c) => c.code === c3).id;
ok((await j(`/api/admin/projects/${pid}/codes/revoke`, { method: "POST", json: { ids: [c3id] } })).status === 200, "作废 200");
ok((await j(`/api/p/${slug}/downloads`, { method: "POST", json: { code: c3, imageId: imgs[0] } })).status === 410, "作废的码 410 已失效");
const u3 = await j(`/api/p/${slug}/unlock`, { method: "POST", json: { code: c3 } });
ok(u3.body.status === "revoked", "unlock 显示已作废");
const l2 = await j(`/api/admin/projects/${pid}/codes`);
ok(l2.body.find((c) => c.code === c1).downloaded === 1, "后台看到码 1 已下 1 张");

// 跨站请求
ok((await j(`/api/admin/projects`, { method: "POST", json: { title: "x" }, headers: { Origin: "https://evil.example" } })).status === 403, "跨站写请求 403");
const csv = await fetch(`${B}/api/admin/projects/${pid}/codes.csv`);
ok(csv.status === 200 && (await csv.text()).includes("已作废"), "CSV 导出");
// 删除项目
ok((await j(`/api/admin/projects/${pid}`, { method: "DELETE" })).status === 200, "删除项目");
ok((await j(`/api/p/${slug}`)).status === 404, "删掉后公开页 404");
console.log(fails ? `\n${fails} 项没过` : "\n全部通过");
process.exit(fails ? 1 : 0);
