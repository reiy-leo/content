export function fmtBytes(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

const dtf = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const df = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" });

export const fmtTime = (ms: number | null | undefined) => (ms ? dtf.format(ms) : "—");
export const fmtDay = (ms: number) => df.format(ms);

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
