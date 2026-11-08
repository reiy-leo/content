// 后台接口（/api/admin/*），调用前已校验管理员登录。
import { nanoid } from "nanoid";
import type { Env } from "./env.ts";
import { CSV_TEXTS, isLocale } from "./shared/i18n.ts";
import { HttpError, contentDisposition, json, now, readJson } from "./http.ts";
import { codeStatus, generateCode } from "./codes.ts";
import { SLUG_RE, formatCode, type AdminCode, type AdminImage, type CodeDownload, type ProjectSummary } from "./shared/types.ts";

/** Worker 单次请求上限 100MB，留出马赛克图、缩略图和表单开销 */
export const MAX_ORIGINAL_BYTES = 95 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MAX_DOWNLOADS_LIMIT = 1_000_000;

interface ProjectRow {
  id: string; slug: string; title: string; description: string | null; status: "draft" | "published";
  created_at: number; updated_at: number; published_at: number | null; image_count?: number; code_count?: number;
  code_required: number; max_downloads: number | null; free_downloads?: number; used_codes?: number;
}

const toSummary = (r: ProjectRow): ProjectSummary => ({
  id: r.id, slug: r.slug, title: r.title, description: r.description, status: r.status,
  imageCount: r.image_count ?? 0, codeCount: r.code_count ?? 0,
  codeRequired: r.code_required !== 0, maxDownloads: r.max_downloads,
  freeDownloads: r.free_downloads ?? 0, usedCodes: r.used_codes ?? 0,
  createdAt: r.created_at, updatedAt: r.updated_at, publishedAt: r.published_at,
});

const PROJECT_SELECT = `SELECT p.*,
  (SELECT COUNT(*) FROM images i WHERE i.project_id = p.id) AS image_count,
  (SELECT COUNT(*) FROM access_codes c WHERE c.project_id = p.id) AS code_count,
  (SELECT COUNT(*) FROM free_downloads f WHERE f.project_id = p.id AND f.status = 'done') AS free_downloads,
  (SELECT COUNT(DISTINCT d.code_id) FROM downloads d JOIN access_codes c ON c.id = d.code_id
     WHERE c.project_id = p.id AND d.status = 'done') AS used_codes
  FROM projects p`;

async function getProject(env: Env, id: string): Promise<ProjectRow> {
  const row = await env.DB.prepare(`${PROJECT_SELECT} WHERE p.id = ?`).bind(id).first<ProjectRow>();
  if (!row) throw new HttpError(404, "project_not_found");
  return row;
}

function cleanSlug(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(s)) throw new HttpError(400, "slug_invalid");
  return s;
}

function cleanTitle(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s || s.length > 100) throw new HttpError(400, "title_invalid");
  return s;
}

function cleanDescription(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s.length > 1000) throw new HttpError(400, "description_too_long");
  return s || null;
}

const randomSlug = () => nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, "x");

function isUniqueError(e: unknown) {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}

// ---------- 项目 ----------

export async function listProjects(env: Env) {
  const { results } = await env.DB.prepare(`${PROJECT_SELECT} ORDER BY p.updated_at DESC`).all<ProjectRow>();
  return json(results.map(toSummary));
}

export async function createProject(req: Request, env: Env) {
  const body = await readJson<{ title?: string; slug?: string; description?: string }>(req);
  const title = cleanTitle(body.title);
  const slug = body.slug ? cleanSlug(body.slug) : randomSlug();
  const id = nanoid();
  const t = now();
  try {
    await env.DB.prepare(
      "INSERT INTO projects (id, slug, title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)",
    ).bind(id, slug, title, cleanDescription(body.description), t, t).run();
  } catch (e) {
    if (isUniqueError(e)) throw new HttpError(409, "slug_taken");
    throw e;
  }
  return json(toSummary(await getProject(env, id)), { status: 201 });
}

export async function getProjectDetail(env: Env, id: string) {
  const p = await getProject(env, id);
  const { results } = await env.DB.prepare(
    `SELECT i.*, (SELECT COUNT(*) FROM downloads d WHERE d.image_id = i.id AND d.status = 'done') AS dl
     FROM images i WHERE i.project_id = ? ORDER BY i.position, i.created_at`,
  ).bind(id).all<Record<string, unknown>>();
  const images: AdminImage[] = results.map((r) => ({
    id: r.id as string, position: r.position as number, filename: r.filename as string, mime: r.mime as string,
    sizeBytes: r.size_bytes as number, width: r.width as number, height: r.height as number,
    downloads: r.dl as number, createdAt: r.created_at as number,
  }));
  return json({ project: toSummary(p), images });
}

export async function updateProject(req: Request, env: Env, id: string) {
  const p = await getProject(env, id);
  const body = await readJson<{
    title?: string; slug?: string; description?: string | null; status?: string; codeRequired?: boolean; maxDownloads?: number | null;
  }>(req);
  const title = body.title !== undefined ? cleanTitle(body.title) : p.title;
  const slug = body.slug !== undefined ? cleanSlug(body.slug) : p.slug;
  const description = body.description !== undefined ? cleanDescription(body.description) : p.description;
  let codeRequired = p.code_required;
  if (body.codeRequired !== undefined) {
    if (typeof body.codeRequired !== "boolean") throw new HttpError(400, "code_required_bool");
    codeRequired = body.codeRequired ? 1 : 0;
  }
  let maxDownloads = p.max_downloads;
  if (body.maxDownloads !== undefined) {
    if (body.maxDownloads === null) maxDownloads = null;
    else {
      const n = Number(body.maxDownloads);
      if (!Number.isInteger(n) || n < 1 || n > MAX_DOWNLOADS_LIMIT) throw new HttpError(400, "max_downloads_invalid");
      maxDownloads = n;
    }
  }
  let status = p.status;
  let publishedAt = p.published_at;
  if (body.status !== undefined) {
    if (body.status !== "draft" && body.status !== "published") throw new HttpError(400, "status_invalid");
    if (body.status === "published" && status !== "published") {
      if (!p.image_count) throw new HttpError(400, "publish_empty");
      publishedAt = now();
    }
    status = body.status;
  }
  try {
    await env.DB.prepare(
      "UPDATE projects SET title = ?, slug = ?, description = ?, status = ?, published_at = ?, code_required = ?, max_downloads = ?, updated_at = ? WHERE id = ?",
    ).bind(title, slug, description, status, publishedAt, codeRequired, maxDownloads, now(), id).run();
  } catch (e) {
    if (isUniqueError(e)) throw new HttpError(409, "slug_taken");
    throw e;
  }
  return json(toSummary(await getProject(env, id)));
}

async function deleteR2Prefix(env: Env, prefixes: string[]) {
  for (const prefix of prefixes) {
    let cursor: string | undefined;
    do {
      const page = await env.BUCKET.list({ prefix, cursor });
      if (page.objects.length) await env.BUCKET.delete(page.objects.map((o) => o.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
}

export async function deleteProject(env: Env, id: string, ctx: ExecutionContext) {
  await getProject(env, id);
  // 外键级联在 D1 默认开启：images / codes / downloads 一起删
  await env.DB.batch([
    env.DB.prepare("DELETE FROM downloads WHERE image_id IN (SELECT id FROM images WHERE project_id = ?)").bind(id),
    env.DB.prepare("DELETE FROM free_downloads WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM access_codes WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM code_batches WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM images WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id),
  ]);
  ctx.waitUntil(deleteR2Prefix(env, [`originals/${id}/`, `previews/${id}/`]));
  return json({ ok: true });
}

// ---------- 图片 ----------

export async function uploadImage(req: Request, env: Env, projectId: string) {
  await getProject(env, projectId);
  const len = Number(req.headers.get("Content-Length") ?? 0);
  if (len > MAX_ORIGINAL_BYTES + 2 * MAX_PREVIEW_BYTES) throw new HttpError(413, "file_too_large");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "bad_upload");
  }
  const original = form.get("original");
  const mosaic = form.get("mosaic");
  const thumb = form.get("thumb");
  if (!(original instanceof File) || !(mosaic instanceof File) || !(thumb instanceof File)) {
    throw new HttpError(400, "missing_files");
  }
  if (original.size > MAX_ORIGINAL_BYTES) throw new HttpError(413, "file_too_large");
  if (mosaic.size > MAX_PREVIEW_BYTES || thumb.size > MAX_PREVIEW_BYTES) throw new HttpError(413, "preview_too_large");
  const mime = original.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) throw new HttpError(415, "unsupported_type");
  const width = Math.round(Number(form.get("width")));
  const height = Math.round(Number(form.get("height")));
  if (!(width > 0 && height > 0)) throw new HttpError(400, "missing_size");
  const filename = (String(form.get("filename") ?? original.name ?? "image") || "image").slice(0, 200);

  const id = nanoid();
  const keys = {
    original: `originals/${projectId}/${id}`,
    mosaic: `previews/${projectId}/${id}/mosaic.webp`,
    thumb: `previews/${projectId}/${id}/thumb.webp`,
  };
  await Promise.all([
    env.BUCKET.put(keys.original, original.stream(), { httpMetadata: { contentType: mime } }),
    env.BUCKET.put(keys.mosaic, mosaic.stream(), { httpMetadata: { contentType: mosaic.type || "image/webp" } }),
    env.BUCKET.put(keys.thumb, thumb.stream(), { httpMetadata: { contentType: thumb.type || "image/webp" } }),
  ]);
  const t = now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO images (id, project_id, position, filename, mime, size_bytes, width, height, original_key, mosaic_key, thumb_key, created_at)
       VALUES (?, ?, COALESCE((SELECT MAX(position) + 1 FROM images WHERE project_id = ?), 0), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, projectId, projectId, filename, mime, original.size, width, height, keys.original, keys.mosaic, keys.thumb, t),
    env.DB.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").bind(t, projectId),
  ]);
  return json({ id }, { status: 201 });
}

interface ImageRow { id: string; project_id: string; filename: string; mime: string; original_key: string; mosaic_key: string; thumb_key: string }

async function getImage(env: Env, id: string): Promise<ImageRow> {
  const row = await env.DB.prepare("SELECT * FROM images WHERE id = ?").bind(id).first<ImageRow>();
  if (!row) throw new HttpError(404, "image_not_found");
  return row;
}

export async function reorderImages(req: Request, env: Env, projectId: string) {
  await getProject(env, projectId);
  const body = await readJson<{ order?: string[] }>(req);
  if (!Array.isArray(body.order)) throw new HttpError(400, "order_missing");
  const stmts = body.order.map((imageId, i) =>
    env.DB.prepare("UPDATE images SET position = ? WHERE id = ? AND project_id = ?").bind(i, String(imageId), projectId),
  );
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true });
}

export async function deleteImage(env: Env, id: string) {
  const img = await getImage(env, id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM downloads WHERE image_id = ?").bind(id),
    env.DB.prepare("DELETE FROM free_downloads WHERE image_id = ?").bind(id),
    env.DB.prepare("DELETE FROM images WHERE id = ?").bind(id),
    env.DB.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").bind(now(), img.project_id),
  ]);
  await env.BUCKET.delete([img.original_key, img.mosaic_key, img.thumb_key]);
  return json({ ok: true });
}

export async function adminImageFile(env: Env, id: string, kind: "original" | "thumb" | "mosaic") {
  const img = await getImage(env, id);
  const key = kind === "original" ? img.original_key : kind === "thumb" ? img.thumb_key : img.mosaic_key;
  const obj = await env.BUCKET.get(key);
  if (!obj) throw new HttpError(404, "file_not_found");
  return new Response(obj.body, {
    headers: {
      "Content-Type": kind === "original" ? img.mime : obj.httpMetadata?.contentType ?? "image/webp",
      "Cache-Control": "private, max-age=3600",
      ...(kind === "original" ? { "Content-Disposition": contentDisposition("inline", img.filename) } : {}),
    },
  });
}

// ---------- 获取码 ----------

interface CodeRow {
  id: string; code: string; expires_at: number | null; revoked_at: number | null; note: string | null; created_at: number;
  downloaded: number; last_dl: number | null;
}

const toAdminCode = (r: CodeRow, at: number): AdminCode => ({
  id: r.id, code: formatCode(r.code), status: codeStatus(r, at), expiresAt: r.expires_at, revokedAt: r.revoked_at,
  note: r.note, downloaded: r.downloaded, lastDownloadAt: r.last_dl, createdAt: r.created_at,
});

async function codeRows(env: Env, projectId: string) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.code, c.expires_at, c.revoked_at, c.note, c.created_at,
       (SELECT COUNT(*) FROM downloads d WHERE d.code_id = c.id AND d.status = 'done') AS downloaded,
       (SELECT MAX(completed_at) FROM downloads d WHERE d.code_id = c.id AND d.status = 'done') AS last_dl
     FROM access_codes c WHERE c.project_id = ? ORDER BY c.created_at DESC, c.code`,
  ).bind(projectId).all<CodeRow>();
  return results;
}

export async function listCodes(env: Env, projectId: string) {
  await getProject(env, projectId);
  const at = now();
  return json((await codeRows(env, projectId)).map((r) => toAdminCode(r, at)));
}

export async function createCodes(req: Request, env: Env, projectId: string) {
  await getProject(env, projectId);
  const body = await readJson<{ count?: number; expiresAt?: number | null; expiresInDays?: number; expiresInHours?: number; note?: string }>(req);
  const count = Math.floor(Number(body.count ?? 10));
  if (!(count >= 1 && count <= 500)) throw new HttpError(400, "code_count_invalid");
  const t = now();
  let expiresAt: number | null;
  if (body.expiresAt === null) expiresAt = null;
  else if (typeof body.expiresAt === "number") expiresAt = body.expiresAt;
  else if (body.expiresInHours !== undefined) {
    const h = Number(body.expiresInHours);
    if (!(h > 0 && h <= 24 * 365)) throw new HttpError(400, "expiry_hours_invalid");
    expiresAt = t + h * HOUR;
  } else expiresAt = t + (Number(body.expiresInDays ?? 7) || 7) * DAY;
  if (expiresAt !== null && expiresAt <= t) throw new HttpError(400, "expiry_in_past");
  const note = body.note ? String(body.note).trim().slice(0, 200) || null : null;

  const batchId = nanoid();
  await env.DB.prepare("INSERT INTO code_batches (id, project_id, count, expires_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(batchId, projectId, count, expiresAt, note, t).run();
  let made = 0;
  for (let round = 0; made < count && round < 5; round++) {
    const stmts = Array.from({ length: count - made }, () =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO access_codes (id, project_id, batch_id, code, expires_at, note, source, created_at) VALUES (?, ?, ?, ?, ?, ?, 'admin', ?)",
      ).bind(nanoid(), projectId, batchId, generateCode(), expiresAt, note, t),
    );
    const res = await env.DB.batch(stmts);
    made += res.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
  }
  const { results } = await env.DB.prepare("SELECT code FROM access_codes WHERE batch_id = ? ORDER BY code").bind(batchId).all<{ code: string }>();
  return json({ batchId, codes: results.map((r) => formatCode(r.code)), expiresAt }, { status: 201 });
}

export async function revokeCodes(req: Request, env: Env, projectId: string) {
  await getProject(env, projectId);
  const body = await readJson<{ ids?: string[]; restore?: boolean }>(req);
  if (!Array.isArray(body.ids) || !body.ids.length) throw new HttpError(400, "no_codes_selected");
  const t = body.restore ? null : now();
  await env.DB.batch(
    body.ids.slice(0, 500).map((id) =>
      env.DB.prepare("UPDATE access_codes SET revoked_at = ? WHERE id = ? AND project_id = ?").bind(t, String(id), projectId),
    ),
  );
  return json({ ok: true });
}

export async function codeDownloads(env: Env, codeId: string) {
  const { results } = await env.DB.prepare(
    `SELECT d.image_id, i.filename, d.status, d.created_at, d.completed_at
     FROM downloads d JOIN images i ON i.id = d.image_id WHERE d.code_id = ? ORDER BY d.created_at DESC`,
  ).bind(codeId).all<{ image_id: string; filename: string; status: "pending" | "done"; created_at: number; completed_at: number | null }>();
  const out: CodeDownload[] = results.map((r) => ({
    imageId: r.image_id, filename: r.filename, status: r.status, createdAt: r.created_at, completedAt: r.completed_at,
  }));
  return json(out);
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** 导出 CSV。?lang= 决定表头和状态用哪种语言，默认中文 */
export async function codesCsv(env: Env, projectId: string, lang: string | null) {
  const text = CSV_TEXTS[isLocale(lang) ? lang : "zh"];
  const p = await getProject(env, projectId);
  const at = now();
  const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : "");
  const lines = [text.headers.join(",")];
  for (const r of await codeRows(env, projectId)) {
    lines.push([formatCode(r.code), text.status[codeStatus(r, at)], `${r.downloaded}/${p.image_count ?? 0}`, iso(r.expires_at), r.note, iso(r.created_at)].map(csvCell).join(","));
  }
  return new Response("\ufeff" + lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition("attachment", `${p.slug}-codes.csv`),
      "Cache-Control": "no-store",
    },
  });
}
