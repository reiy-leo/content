// JSON 响应与错误。错误体统一 { error, status }，error 是给人看的中文说明。
import { STATUS_TEXT } from "./shared/types.ts";

export class HttpError extends Error {
  constructor(public status: number, message?: string) {
    super(message ?? STATUS_TEXT[status] ?? "出错了");
  }
}

export const json = (data: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
};

export const errorResponse = (status: number, message?: string) =>
  json({ error: message ?? STATUS_TEXT[status] ?? "出错了", status }, { status });

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "请求内容不是有效的 JSON");
  }
}

/** 写操作校验 Origin，防跨站请求。没有 Origin 头（同源 GET、curl）时放行。 */
export function checkOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  if (origin && origin !== new URL(req.url).origin) throw new HttpError(403, "来源不对，拒绝跨站请求");
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
