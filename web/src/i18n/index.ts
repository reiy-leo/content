// 界面语言。默认按浏览器语言（navigator.languages）挑：中文浏览器用中文，其他对得上的用对应语言，都对不上用英文。
// 用户在顶栏选过语言，就存到 localStorage 和 cookie（ct-lang），以后一直用它；选「跟随浏览器」就清掉。
// 组件里用 useI18n()；组件外（工具函数、抛错）用 getT() / getLocale()。
import { useSyncExternalStore } from "react";
import { LANG_KEY, LOCALES, htmlLang, isLocale, matchLocale, statusLabel, colon, type Locale } from "../../../src/shared/i18n.ts";
import { errorText, type ErrorCode, type ErrorParams } from "../../../src/shared/errors.ts";
import { zh, type Dict } from "./zh.ts";
import { en } from "./en.ts";
import { es } from "./es.ts";
import { pt } from "./pt.ts";
import { ru } from "./ru.ts";
import { ja } from "./ja.ts";
import { de } from "./de.ts";
import { fr } from "./fr.ts";
import { id } from "./id.ts";

export type { Dict, Locale };
export { LOCALES };

const DICTS: Record<Locale, Dict> = { zh, en, es, pt, ru, ja, de, fr, id };

const browserLocale = () => matchLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);

function savedLocale(): Locale | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

interface State { locale: Locale; chosen: boolean; t: Dict }
const initial = savedLocale();
let state: State = { locale: initial ?? browserLocale(), chosen: !!initial, t: DICTS[initial ?? browserLocale()] };
const subs = new Set<() => void>();

function apply() {
  document.documentElement.lang = htmlLang(state.locale);
}
apply();

/** 选一种语言；传 null 表示跟随浏览器 */
export function setLocale(next: Locale | null) {
  try {
    if (next) {
      localStorage.setItem(LANG_KEY, next);
      document.cookie = `${LANG_KEY}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    } else {
      localStorage.removeItem(LANG_KEY);
      document.cookie = `${LANG_KEY}=; path=/; max-age=0; SameSite=Lax`;
    }
  } catch {
    /* 隐私模式下存不了，就只在这次生效 */
  }
  const locale = next ?? browserLocale();
  state = { locale, chosen: !!next, t: DICTS[locale] };
  apply();
  subs.forEach((f) => f());
}

// 跟随浏览器时，浏览器语言变了也跟着变
window.addEventListener("languagechange", () => {
  if (!state.chosen) setLocale(null);
});

export const getLocale = () => state.locale;
export const getT = () => state.t;

export function useI18n() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}

/** 「403 无权限：详情」「403 Forbidden: details」；status 为 0（没连上）时只给详情 */
export function httpLine(status: number, detail: string, locale = state.locale) {
  return status ? `${statusLabel(locale, status)}${colon(locale)}${detail}` : detail;
}

/** 按错误码翻译服务端错误，没有 code 时用服务端给的文字 */
export function translateError(code: ErrorCode | undefined, params: ErrorParams | undefined, fallback: string, locale = state.locale) {
  return code ? errorText(locale, code, params) : fallback;
}

/** Intl 用的语言标签 */
export const intlLocale = () => htmlLang(state.locale);
