// 调接口。错误统一转成 ApiFail，message 形如「403 无权限：……」。
import { STATUS_TEXT, type ApiError } from "../../src/shared/types.ts";

export const UNAUTHORIZED_EVENT = "ct:unauthorized";

export class ApiFail extends Error {
  constructor(public status: number, public detail: string) {
    super(`${status} ${STATUS_TEXT[status] ?? ""}：${detail}`);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(path, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body, credentials: "same-origin" });
  } catch {
    throw new ApiFail(0, "网络连接失败");
  }
  if (!res.ok) {
    let detail = STATUS_TEXT[res.status] ?? "出错了";
    try {
      detail = ((await res.json()) as ApiError).error || detail;
    } catch {
      /* 不是 JSON */
    }
    if (res.status === 401 && path.startsWith("/api/admin/")) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiFail(res.status, detail);
  }
  return (await res.json()) as T;
}

export const errMsg = (e: unknown) => (e instanceof ApiFail ? e.message : e instanceof Error ? e.message : String(e));

/** 带进度的上传（fetch 拿不到上传进度） */
export function uploadForm<T>(path: string, form: FormData, onProgress: (ratio: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new ApiFail(0, "网络连接失败"));
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
        reject(new ApiFail(xhr.status, (body as ApiError | null)?.error ?? STATUS_TEXT[xhr.status] ?? "上传失败"));
      }
    };
    xhr.send(form);
  });
}
