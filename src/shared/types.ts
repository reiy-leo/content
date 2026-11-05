// 前后端共用的类型。
export type LoginError = "unconfigured" | "denied" | "state" | "token" | "id_token" | "unverified" | "forbidden";

export interface SessionInfo { email: string; name?: string; picture?: string }

export interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "draft" | "published";
  imageCount: number;
  codeCount: number;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
}

export interface AdminImage {
  id: string;
  position: number;
  filename: string;
  mime: string;
  sizeBytes: number;
  width: number;
  height: number;
  downloads: number;
  createdAt: number;
}

export type CodeStatus = "active" | "expired" | "revoked";

export interface AdminCode {
  id: string;
  code: string;
  status: CodeStatus;
  expiresAt: number | null;
  revokedAt: number | null;
  note: string | null;
  downloaded: number;
  lastDownloadAt: number | null;
  createdAt: number;
}

export interface CodeDownload { imageId: string; filename: string; status: "pending" | "done"; createdAt: number; completedAt: number | null }

export interface PublicImage { id: string; width: number; height: number }

export interface PublicProject { slug: string; title: string; description: string | null; images: PublicImage[] }

export interface UnlockResult {
  status: CodeStatus;
  expiresAt: number | null;
  revokedAt: number | null;
  /** 这个码已经下过的图片 ID */
  downloaded: string[];
}

export interface ApiError { error: string; status: number }

/** 状态码的中文说明 */
export const STATUS_TEXT: Record<number, string> = {
  400: "请求有误",
  401: "未登录",
  403: "无权限",
  404: "找不到",
  409: "冲突",
  410: "已失效",
  413: "文件太大",
  415: "格式不支持",
  429: "请求太多",
  500: "服务器出错",
  503: "服务暂不可用",
};

/** 获取码：8 位，去掉 0/O、1/I/L 等易混字符（Crockford 风格，32 个字符）。 */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 8;

/** 规范化：去空白和横线、转大写；不合法返回 null。 */
export function normalizeCode(input: string): string | null {
  const s = input.replace(/[\s-]/g, "").toUpperCase();
  if (s.length !== CODE_LENGTH) return null;
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return null;
  return s;
}

export const formatCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
