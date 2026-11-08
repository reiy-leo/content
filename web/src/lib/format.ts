// 数字、日期按当前语言格式化（Intl），时区跟浏览器。
import { intlLocale } from "../i18n/index.ts";

export function fmtBytes(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

const cache = new Map<string, Intl.DateTimeFormat>();
function dtf(kind: "time" | "day") {
  const key = `${intlLocale()}:${kind}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(
      intlLocale(),
      kind === "time" ? { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" } : { month: "long", day: "numeric" },
    );
    cache.set(key, f);
  }
  return f;
}

export const fmtTime = (ms: number | null | undefined) => (ms ? dtf("time").format(ms) : "—");
export const fmtDay = (ms: number) => dtf("day").format(ms);

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
