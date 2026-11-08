// Worker 入口：路由。前端（public/）内联在 assets.generated.ts 里，见 scripts/build-inline-assets.mjs。
import type { Env } from "./env.ts";
import { callback, getUser, login, logout } from "./auth.ts";
import { HttpError, checkOrigin, errorResponse, json } from "./http.ts";
import * as admin from "./admin.ts";
import * as pub from "./public.ts";
import { INLINE_ASSETS } from "./assets.generated.ts";
import { htmlLang, isLocale, LANG_KEY, matchLocale, parseAcceptLanguage, statusLabel, type Locale } from "./shared/i18n.ts";
import { errorText } from "./shared/errors.ts";
import { cleanup } from "./cleanup.ts";
import { isAuthDisabled } from "./env.ts";

function decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
};

function serveAsset(path: string): Response | null {
  const a = INLINE_ASSETS[path];
  if (!a) return null;
  return new Response(a.b ? decode(a.d) : a.d, {
    headers: {
      "Content-Type": a.t,
      "Cache-Control": path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate",
    },
  });
}

function spa(): Response {
  const r = serveAsset("/index.html");
  if (!r) return new Response("前端还没构建：先跑 pnpm build", { status: 500 });
  const headers = new Headers(r.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(r.body, { headers });
}

/** 出错页用哪种语言：先看用户在页面上选过的（cookie ct-lang），再看 Accept-Language */
function requestLocale(req: Request): Locale {
  const m = (req.headers.get("Cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${LANG_KEY}=([a-z]{2})`));
  if (m && isLocale(m[1])) return m[1];
  return matchLocale(parseAcceptLanguage(req.headers.get("Accept-Language")));
}

function dlErrorPage(e: HttpError, locale: Locale) {
  const title = statusLabel(locale, e.status);
  const message = errorText(locale, e.code, e.params);
  const html = `<!doctype html><html lang="${htmlLang(locale)}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.25rem;line-height:1.6">
<h1 style="font-size:1.125rem;font-weight:600">${title}</h1><p>${message}</p></body></html>`;
  return new Response(html, { status: e.status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const m = req.method;
  let r: RegExpMatchArray | null;

  // 登录
  if (path === "/auth/login" && m === "GET") return login(req, env);
  if (path === "/auth/callback" && m === "GET") return callback(req, env);
  if (path === "/auth/logout" && m === "POST") return logout(req);

  // 原图下载
  if ((r = path.match(/^\/dl\/([^/]+)$/)) && m === "GET") {
    try {
      return await pub.download(env, r[1]!);
    } catch (e) {
      if (e instanceof HttpError) return dlErrorPage(e, requestLocale(req));
      throw e;
    }
  }

  if (path.startsWith("/api/")) {
    if (m !== "GET" && m !== "HEAD") checkOrigin(req);

    if (path === "/api/me" && m === "GET") {
      const user = await getUser(req, env);
      return json({ user });
    }

    // 公开接口
    if ((r = path.match(/^\/api\/p\/([a-z0-9-]+)$/)) && m === "GET") return pub.getPublicProject(env, r[1]!);
    if ((r = path.match(/^\/api\/p\/([a-z0-9-]+)\/mosaic\/([\w-]+)$/)) && m === "GET") return pub.mosaic(env, r[1]!, r[2]!);
    if ((r = path.match(/^\/api\/p\/([a-z0-9-]+)\/thumb\/([\w-]+)$/)) && m === "GET") return pub.thumb(req, env, r[1]!, r[2]!);
    if ((r = path.match(/^\/api\/p\/([a-z0-9-]+)\/unlock$/)) && m === "POST") return pub.unlock(req, env, r[1]!);
    if ((r = path.match(/^\/api\/p\/([a-z0-9-]+)\/downloads$/)) && m === "POST") return pub.reserve(req, env, r[1]!);

    // 本地开发手动触发清理（只在 AUTH_DISABLED 的本机生效）
    if (path === "/api/dev/cleanup" && m === "POST" && isAuthDisabled(env, req)) {
      const at = Number(url.searchParams.get("at")) || Date.now();
      return json(await cleanup(env, at));
    }

    // 后台接口
    if (path.startsWith("/api/admin/")) {
      const user = await getUser(req, env);
      if (!user) throw new HttpError(401, "login_required");
      const sub = path.slice("/api/admin".length);
      if (sub === "/projects" && m === "GET") return admin.listProjects(env);
      if (sub === "/projects" && m === "POST") return admin.createProject(req, env);
      if ((r = sub.match(/^\/projects\/([\w-]+)$/))) {
        if (m === "GET") return admin.getProjectDetail(env, r[1]!);
        if (m === "PATCH") return admin.updateProject(req, env, r[1]!);
        if (m === "DELETE") return admin.deleteProject(env, r[1]!, ctx);
      }
      if ((r = sub.match(/^\/projects\/([\w-]+)\/images$/)) && m === "POST") return admin.uploadImage(req, env, r[1]!);
      if ((r = sub.match(/^\/projects\/([\w-]+)\/images\/order$/)) && m === "PUT") return admin.reorderImages(req, env, r[1]!);
      if ((r = sub.match(/^\/projects\/([\w-]+)\/codes$/))) {
        if (m === "GET") return admin.listCodes(env, r[1]!);
        if (m === "POST") return admin.createCodes(req, env, r[1]!);
      }
      if ((r = sub.match(/^\/projects\/([\w-]+)\/codes\/revoke$/)) && m === "POST") return admin.revokeCodes(req, env, r[1]!);
      if ((r = sub.match(/^\/projects\/([\w-]+)\/codes\.csv$/)) && m === "GET") return admin.codesCsv(env, r[1]!, url.searchParams.get("lang"));
      if ((r = sub.match(/^\/codes\/([\w-]+)\/downloads$/)) && m === "GET") return admin.codeDownloads(env, r[1]!);
      if ((r = sub.match(/^\/images\/([\w-]+)$/)) && m === "DELETE") return admin.deleteImage(env, r[1]!);
      if ((r = sub.match(/^\/images\/([\w-]+)\/(original|thumb|mosaic)$/)) && m === "GET") {
        return admin.adminImageFile(env, r[1]!, r[2] as "original" | "thumb" | "mosaic");
      }
    }
    throw new HttpError(404, "api_not_found");
  }

  // 前端
  if (m === "GET" || m === "HEAD") {
    const asset = path !== "/" && path !== "/index.html" ? serveAsset(path) : null;
    if (asset) return asset;
    if (path === "/" || path === "/admin" || path.startsWith("/admin/") || /^\/p\/[a-z0-9-]+\/?$/.test(path)) return spa();
    return spa(); // 前端自己显示 404 页
  }
  throw new HttpError(404, "not_found");
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let res: Response;
    try {
      res = await route(req, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) res = errorResponse(e);
      else {
        console.error("unhandled", e);
        res = errorResponse(new HttpError(500, "server_error"));
      }
    }
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!headers.has(k)) headers.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(cleanup(env));
  },
} satisfies ExportedHandler<Env>;
