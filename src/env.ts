export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  /** 填码 / 占位接口的按 IP 限流（Workers Rate Limiting）。本地没有时跳过。 */
  UNLOCK_LIMITER?: RateLimit;
  /** 免码下载的按 IP 限流，每分钟 50 次。本地没有时跳过。 */
  FREE_LIMITER?: RateLimit;

  // secrets
  SESSION_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  IP_HASH_SALT?: string;

  // vars
  /** 管理员 Google 邮箱，逗号分隔。 */
  ADMIN_EMAILS?: string;
  OAUTH_REDIRECT_URI?: string;
  /** "true" = 跳过登录（假管理员），只对本机请求生效，仅供本地开发。 */
  AUTH_DISABLED?: string;
}

export const isAuthDisabled = (env: Env, req: Request) => {
  if ((env.AUTH_DISABLED ?? "").trim().toLowerCase() !== "true") return false;
  const host = new URL(req.url).hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
  const ip = req.headers.get("CF-Connecting-IP") ?? "";
  return ip === "127.0.0.1" || ip === "::1";
};

export const googleConfigured = (env: Env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET);

export const list = (v: string | undefined) => (v ?? "").split(",").map((e) => e.trim()).filter(Boolean);

export const isAdminEmail = (env: Env, email: string) => list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()).includes(email.toLowerCase());
