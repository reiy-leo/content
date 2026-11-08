// 公开接口（/api/p/*、/dl/*）。访客不用登录；原图只能用一次性票据从 /dl/<ticket> 拿。
import { nanoid } from "nanoid";
import type { Env } from "./env.ts";
import { HttpError, contentDisposition, json, now, readJson, sha256Hex } from "./http.ts";
import { codeStatus } from "./codes.ts";
import { normalizeCode, type PublicProject, type UnlockResult } from "./shared/types.ts";

const TICKET_TTL = 10 * 60 * 1000;

interface PubProjectRow { id: string; slug: string; title: string; description: string | null; code_required: number; max_downloads: number | null }
interface CodeRow { id: string; project_id: string; expires_at: number | null; revoked_at: number | null }

async function publishedProject(env: Env, slug: string): Promise<PubProjectRow> {
  const p = await env.DB.prepare("SELECT id, slug, title, description, code_required, max_downloads FROM projects WHERE slug = ? AND status = 'published'")
    .bind(slug).first<PubProjectRow>();
  if (!p) throw new HttpError(404, "project_unpublished");
  return p;
}

async function limit(env: Env, req: Request, scope: string, limiter = env.UNLOCK_LIMITER) {
  if (!limiter) return;
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
  const { success } = await limiter.limit({ key: `${scope}:${ip}` });
  if (!success) throw new HttpError(429, "rate_limited");
}

/** 免码下载已用掉的次数：已完成的，加上票据还没过期的占位 */
const FREE_USED = `(SELECT COUNT(*) FROM free_downloads f WHERE f.project_id = p.id AND (f.status = 'done' OR f.ticket_expires_at > ?3))`;

async function findCode(env: Env, projectId: string, raw: unknown): Promise<CodeRow> {
  const code = normalizeCode(String(raw ?? ""));
  if (!code) throw new HttpError(404, "code_wrong");
  const row = await env.DB.prepare("SELECT id, project_id, expires_at, revoked_at FROM access_codes WHERE code = ?")
    .bind(code).first<CodeRow>();
  // 别的项目的码也当成「不对」，不透露它存在
  if (!row || row.project_id !== projectId) throw new HttpError(404, "code_wrong");
  return row;
}

async function ipHash(env: Env, req: Request) {
  const ip = req.headers.get("CF-Connecting-IP");
  if (!ip) return null;
  return (await sha256Hex(`${env.IP_HASH_SALT ?? "content"}:${ip}`)).slice(0, 16);
}

/** GET /api/p/:slug */
export async function getPublicProject(env: Env, slug: string) {
  const p = await publishedProject(env, slug);
  const { results } = await env.DB.prepare("SELECT id, width, height FROM images WHERE project_id = ? ORDER BY position, created_at")
    .bind(p.id).all<{ id: string; width: number; height: number }>();
  let freeLeft: number | null = null;
  if (!p.code_required && p.max_downloads !== null) {
    const used = await env.DB.prepare(`SELECT ${FREE_USED.replace("?3", "?2")} AS n FROM projects p WHERE p.id = ?1`)
      .bind(p.id, now()).first<{ n: number }>();
    freeLeft = Math.max(0, p.max_downloads - (used?.n ?? 0));
  }
  const out: PublicProject = {
    slug: p.slug, title: p.title, description: p.description, images: results, codeRequired: p.code_required !== 0, freeLeft,
  };
  return json(out);
}

/** GET /api/p/:slug/mosaic/:imageId —— 马赛克图是公开的 */
export async function mosaic(env: Env, slug: string, imageId: string) {
  const p = await publishedProject(env, slug);
  const img = await env.DB.prepare("SELECT mosaic_key FROM images WHERE id = ? AND project_id = ?").bind(imageId, p.id).first<{ mosaic_key: string }>();
  if (!img) throw new HttpError(404, "image_not_found");
  const obj = await env.BUCKET.get(img.mosaic_key);
  if (!obj) throw new HttpError(404, "image_not_found");
  return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType ?? "image/webp", "Cache-Control": "public, max-age=3600" } });
}

/** POST /api/p/:slug/unlock { code } */
export async function unlock(req: Request, env: Env, slug: string) {
  await limit(env, req, "unlock");
  const p = await publishedProject(env, slug);
  const body = await readJson<{ code?: string }>(req);
  const c = await findCode(env, p.id, body.code);
  const { results } = await env.DB.prepare("SELECT image_id FROM downloads WHERE code_id = ? AND status = 'done'")
    .bind(c.id).all<{ image_id: string }>();
  const out: UnlockResult = {
    status: codeStatus(c),
    expiresAt: c.expires_at,
    revokedAt: c.revoked_at,
    downloaded: results.map((r) => r.image_id),
  };
  return json(out);
}

/** GET /api/p/:slug/thumb/:imageId，码放在 X-Access-Code 头里。只有用这个码下过这张图才能看。 */
export async function thumb(req: Request, env: Env, slug: string, imageId: string) {
  const p = await publishedProject(env, slug);
  const c = await findCode(env, p.id, req.headers.get("X-Access-Code"));
  const img = await env.DB.prepare(
    `SELECT i.thumb_key FROM images i JOIN downloads d ON d.image_id = i.id
     WHERE i.id = ? AND i.project_id = ? AND d.code_id = ? AND d.status = 'done'`,
  ).bind(imageId, p.id, c.id).first<{ thumb_key: string }>();
  if (!img) throw new HttpError(403, "thumb_forbidden");
  const obj = await env.BUCKET.get(img.thumb_key);
  if (!obj) throw new HttpError(404, "image_not_found");
  return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType ?? "image/webp", "Cache-Control": "private, no-store" } });
}

/**
 * POST /api/p/:slug/downloads { code, imageId } → { ticket, url }
 *
 * 先占位再出文件：downloads 表有 UNIQUE(code_id, image_id)。
 *  1. 已有 pending（票据还没被打开过）→ 换一张新票据，旧票据作废。
 *  2. 没有记录 → 插入 pending。两条请求同时到，只有一条插得进去。
 *  3. 已经 done → 409。
 * 两条语句都带「码可用、项目已发布、图属于项目」的条件，放在一个 batch 里按事务执行。
 */
export async function reserve(req: Request, env: Env, slug: string) {
  const p = await publishedProject(env, slug);
  const body = await readJson<{ code?: string; imageId?: string }>(req);
  if (!body.code) return reserveFree(req, env, p, String(body.imageId ?? ""));
  await limit(env, req, "download");
  const c = await findCode(env, p.id, body.code);
  const st = codeStatus(c);
  if (st !== "active") throw new HttpError(410, st === "revoked" ? "code_revoked" : "code_expired");
  const imageId = String(body.imageId ?? "");

  const ticket = nanoid(43);
  const hash = await sha256Hex(ticket);
  const t = now();
  const exp = t + TICKET_TTL;
  const valid = `EXISTS (SELECT 1 FROM access_codes c JOIN projects p ON p.id = c.project_id JOIN images i ON i.project_id = c.project_id
      WHERE c.id = ?1 AND i.id = ?2 AND p.status = 'published' AND c.revoked_at IS NULL AND (c.expires_at IS NULL OR c.expires_at > ?3))`;
  const [upd, ins] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE downloads SET ticket_hash = ?4, ticket_expires_at = ?5, created_at = ?3
       WHERE code_id = ?1 AND image_id = ?2 AND status = 'pending' AND ${valid}`,
    ).bind(c.id, imageId, t, hash, exp),
    env.DB.prepare(
      `INSERT INTO downloads (id, code_id, image_id, ticket_hash, ticket_expires_at, status, created_at, ip_hash)
       SELECT ?6, ?1, ?2, ?4, ?5, 'pending', ?3, ?7 WHERE ${valid}
       ON CONFLICT (code_id, image_id) DO NOTHING`,
    ).bind(c.id, imageId, t, hash, exp, nanoid(), await ipHash(env, req)),
  ]);
  if ((upd?.meta.changes ?? 0) + (ins?.meta.changes ?? 0) > 0) {
    return json({ ticket, url: `/dl/${ticket}`, expiresAt: exp });
  }
  const done = await env.DB.prepare("SELECT 1 AS x FROM downloads WHERE code_id = ? AND image_id = ? AND status = 'done'").bind(c.id, imageId).first();
  if (done) throw new HttpError(409, "already_downloaded");
  throw new HttpError(404, "image_not_found");
}

/**
 * 免码占位：项目关了获取码时，不带码也能下。
 * 一条 INSERT 里同时检查「项目已发布、免码、图属于项目、没到下载上限」，并发时也不会超。
 */
async function reserveFree(req: Request, env: Env, p: PubProjectRow, imageId: string) {
  if (p.code_required) throw new HttpError(403, "code_needed");
  await limit(env, req, "free", env.FREE_LIMITER);
  const ticket = nanoid(43);
  const hash = await sha256Hex(ticket);
  const t = now();
  const exp = t + TICKET_TTL;
  const res = await env.DB.prepare(
    `INSERT INTO free_downloads (id, project_id, image_id, ticket_hash, ticket_expires_at, status, created_at, ip_hash)
     SELECT ?4, p.id, i.id, ?5, ?6, 'pending', ?3, ?7 FROM projects p JOIN images i ON i.project_id = p.id
     WHERE p.id = ?1 AND i.id = ?2 AND p.status = 'published' AND p.code_required = 0
       AND (p.max_downloads IS NULL OR ${FREE_USED} < p.max_downloads)`,
  ).bind(p.id, imageId, t, nanoid(), hash, exp, await ipHash(env, req)).run();
  if ((res.meta.changes ?? 0) > 0) return json({ ticket, url: `/dl/${ticket}`, expiresAt: exp });
  const img = await env.DB.prepare("SELECT 1 AS x FROM images WHERE id = ? AND project_id = ?").bind(imageId, p.id).first();
  if (!img) throw new HttpError(404, "image_not_found");
  const cur = await env.DB.prepare("SELECT code_required FROM projects WHERE id = ?").bind(p.id).first<{ code_required: number }>();
  if (cur?.code_required) throw new HttpError(403, "code_needed");
  throw new HttpError(410, "free_exhausted");
}

/** GET /dl/:ticket —— 票据只能用一次：先标成 done，再流式返回原图。 */
export async function download(env: Env, ticket: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(ticket)) throw new HttpError(410, "ticket_invalid");
  const hash = await sha256Hex(ticket);
  const t = now();
  let table: "downloads" | "free_downloads" = "downloads";
  let row = await env.DB.prepare(
    `UPDATE downloads SET status = 'done', completed_at = ?2
     WHERE ticket_hash = ?1 AND status = 'pending' AND ticket_expires_at > ?2
     RETURNING id, image_id`,
  ).bind(hash, t).first<{ id: string; image_id: string }>();
  if (!row) {
    // 免码票据：项目重新开了获取码，或取消发布，票据立即失效
    table = "free_downloads";
    row = await env.DB.prepare(
      `UPDATE free_downloads SET status = 'done', completed_at = ?2
       WHERE ticket_hash = ?1 AND status = 'pending' AND ticket_expires_at > ?2
         AND EXISTS (SELECT 1 FROM projects p WHERE p.id = free_downloads.project_id AND p.status = 'published' AND p.code_required = 0)
       RETURNING id, image_id`,
    ).bind(hash, t).first<{ id: string; image_id: string }>();
  }
  if (!row) throw new HttpError(410, "ticket_expired");
  const img = await env.DB.prepare("SELECT original_key, filename, mime, size_bytes FROM images WHERE id = ?")
    .bind(row.image_id).first<{ original_key: string; filename: string; mime: string; size_bytes: number }>();
  const obj = img ? await env.BUCKET.get(img.original_key) : null;
  if (!img || !obj) {
    // 文件不在：退回 pending，不算用掉
    await env.DB.prepare(`UPDATE ${table} SET status = 'pending', completed_at = NULL WHERE id = ?`).bind(row.id).run();
    throw new HttpError(404, "original_missing");
  }
  return new Response(obj.body, {
    headers: {
      "Content-Type": img.mime,
      "Content-Length": String(obj.size),
      "Content-Disposition": contentDisposition("attachment", img.filename),
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
