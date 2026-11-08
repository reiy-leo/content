// 前后端共用的类型。
import type { ErrorCode, ErrorParams } from "./errors.ts";
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
  /** true = 要获取码才能下载；false = 免码 */
  codeRequired: boolean;
  /** 免码时最多下载多少次，null = 不限 */
  maxDownloads: number | null;
  /** 免码下载已完成的次数 */
  freeDownloads: number;
  /** 至少下过一张图的获取码个数 */
  usedCodes: number;
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

export interface PublicProject {
  slug: string;
  title: string;
  description: string | null;
  images: PublicImage[];
  /** false = 免码，直接下载 */
  codeRequired: boolean;
  /** 免码且设了上限时，还剩几次；否则 null */
  freeLeft: number | null;
}

export interface UnlockResult {
  status: CodeStatus;
  expiresAt: number | null;
  revokedAt: number | null;
  /** 这个码已经下过的图片 ID */
  downloaded: string[];
}

export interface ApiError {
  /** 中文说明 */
  error: string;
  /** 固定的错误键，前端按它翻译，见 shared/errors.ts */
  code?: ErrorCode;
  params?: ErrorParams;
  status: number;
}

/** 状态码说明（各语言）在 shared/i18n.ts；这里转出中文版，兼容旧引用 */
export { STATUS_TEXT } from "./i18n.ts";

/** 免码下载：每个 IP 每分钟次数（wrangler.jsonc 的 FREE_LIMITER 要一致） */
export const FREE_RATE_PER_MIN = 50;

/** 填码后弹出的使用须知里的联系方式 */
export const CONTACT_EMAIL = "hi@rei8t.dev";
export const CONTACT_WECHAT = "antitsunny";

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
