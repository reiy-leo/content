// JSON 响应与错误。错误体统一 { error, code, params, status }：error 是中文说明，code 是固定的错误键，
// 前端按 code 翻译成当前语言（翻不了就显示 error）。错误文案在 shared/errors.ts。
import { type ErrorCode, type ErrorParams, errorText } from "./shared/errors.ts";

export class HttpError extends Error {
  constructor(public status: number, public code: ErrorCode = "generic", public params?: ErrorParams) {
    super(errorText("zh", code, params));
  }
}

export const json = (data: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
};

export const errorResponse = (e: HttpError) =>
  json({ error: e.message, code: e.code, ...(e.params ? { params: e.params } : {}), status: e.status }, { status: e.status });

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "bad_json");
  }
}

/** 写操作校验 Origin，防跨站请求。没有 Origin 头（同源 GET、curl）时放行。 */
export function checkOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  if (origin && origin !== new URL(req.url).origin) throw new HttpError(403, "bad_origin");
}

export const now = () => Date.now();

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** RFC 5987 文件名，兼容中文 */
export function contentDisposition(type: "attachment" | "inline", filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
