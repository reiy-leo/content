// 调接口。错误统一转成 ApiFail；errMsg() 按当前语言拼成「403 无权限：……」「403 Forbidden: …」。
// 服务端错误带 code，前端按 code 翻译；没有 code 时显示服务端给的文字。
import type { ApiError } from "../../src/shared/types.ts";
import { isErrorCode, type ErrorCode, type ErrorParams } from "../../src/shared/errors.ts";
import { getT, httpLine, translateError } from "./i18n/index.ts";

export const UNAUTHORIZED_EVENT = "ct:unauthorized";

export class ApiFail extends Error {
  constructor(public status: number, public code: ErrorCode | undefined, public detail: string, public params?: ErrorParams) {
    super(detail);
  }
  /** 当前语言下给人看的一句话 */
  get text() {
    return httpLine(this.status, translateError(this.code, this.params, this.detail));
  }
}

function failFrom(status: number, body: unknown): ApiFail {
  const b = (body ?? {}) as Partial<ApiError>;
  const code = isErrorCode(b.code) ? b.code : undefined;
  return new ApiFail(status, code ?? (b.error ? undefined : "generic"), b.error ?? "", b.params);
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(path, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body, credentials: "same-origin" });
  } catch {
    throw new ApiFail(0, "network", "");
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* 不是 JSON */
    }
    if (res.status === 401 && path.startsWith("/api/admin/")) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw failFrom(res.status, body);
  }
  return (await res.json()) as T;
}

export const errMsg = (e: unknown) => (e instanceof ApiFail ? e.text : e instanceof Error ? e.message : String(e));

/** 带进度的上传（fetch 拿不到上传进度） */
export function uploadForm<T>(path: string, form: FormData, onProgress: (ratio: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new ApiFail(0, "network", ""));
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else {
        if (xhr.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
        const f = failFrom(xhr.status, body);
        reject(f.code || f.detail ? f : new ApiFail(xhr.status, undefined, getT().uploadFailed));
      }
    };
    xhr.send(form);
  });
}
