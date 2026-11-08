// 每天北京时间 3:00 跑一次（wrangler.jsonc 的 triggers.crons）。
// 删掉过期了还一张没下过的获取码，以及票据已过期、一直没打开的占位记录。
// 下过图的码留着，后台要看用了多少个码。
import type { Env } from "./env.ts";

export async function cleanup(env: Env, at = Date.now()) {
  const unused = `SELECT c.id FROM access_codes c
    WHERE c.expires_at IS NOT NULL AND c.expires_at <= ?1
      AND NOT EXISTS (SELECT 1 FROM downloads d WHERE d.code_id = c.id AND d.status = 'done')`;
  const res = await env.DB.batch([
    env.DB.prepare(`DELETE FROM downloads WHERE code_id IN (${unused})`).bind(at),
    env.DB.prepare(`DELETE FROM access_codes WHERE id IN (${unused})`).bind(at),
    env.DB.prepare("DELETE FROM free_downloads WHERE status = 'pending' AND ticket_expires_at <= ?1").bind(at),
    env.DB.prepare("DELETE FROM downloads WHERE status = 'pending' AND ticket_expires_at <= ?1").bind(at),
  ]);
  const n = res.map((r) => r.meta.changes ?? 0);
  console.log(`cleanup: codes ${n[1]}, free pending ${n[2]}, code pending ${n[0]! + n[3]!}`);
  return { codes: n[1] ?? 0, freePending: n[2] ?? 0, codePending: (n[0] ?? 0) + (n[3] ?? 0) };
}
