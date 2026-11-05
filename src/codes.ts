// 获取码生成。拒绝采样保证每个字符均匀分布。
import { CODE_ALPHABET, CODE_LENGTH, type CodeStatus } from "./shared/types.ts";

export function generateCode(): string {
  const n = CODE_ALPHABET.length;
  const limit = 256 - (256 % n);
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < limit) out += CODE_ALPHABET[b % n];
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out;
}

export function codeStatus(c: { expires_at: number | null; revoked_at: number | null }, at = Date.now()): CodeStatus {
  if (c.revoked_at) return "revoked";
  if (c.expires_at !== null && c.expires_at <= at) return "expired";
  return "active";
}
