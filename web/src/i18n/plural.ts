// 复数形式。英、西、葡、德、法只分单数和复数；俄语分 one / few / many（1 张、2 张、5 张写法不同）。
const ruRules = new Intl.PluralRules("ru");

/** 1 → one，其余 → other。法语 0 和 1 都算单数 */
export const pick = (n: number, one: string, other: string, zeroIsOne = false) => (n === 1 || (zeroIsOne && n === 0) ? one : other);

/** 俄语：ru(n, "изображение", "изображения", "изображений") */
export function ru(n: number, one: string, few: string, many: string) {
  const r = ruRules.select(n);
  return r === "one" ? one : r === "few" ? few : many;
}

/** 千位分隔，按语言 */
export const num = (n: number, locale: string) => n.toLocaleString(locale);
