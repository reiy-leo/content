// 前后端共用的语言设置：支持哪些语言、怎么从浏览器语言里挑一个、状态码说明、CSV 表头。
// 界面文案在 web/src/i18n/，服务端错误文案在 ./errors.ts。

export const LOCALES = ["zh", "en", "es", "pt", "ru", "ja", "de", "fr", "id"] as const;
export type Locale = (typeof LOCALES)[number];

/** 中文是源语言；浏览器语言一个都对不上时用英文 */
export const SOURCE_LOCALE: Locale = "zh";
export const FALLBACK_LOCALE: Locale = "en";

/** 语言菜单里显示的名字（用各自的语言写） */
export const LOCALE_NAMES: Record<Locale, string> = {
  zh: "简体中文",
  en: "English",
  es: "Español",
  pt: "Português",
  ru: "Русский",
  ja: "日本語",
  de: "Deutsch",
  fr: "Français",
  id: "Bahasa Indonesia",
};

/** 存在 localStorage 和 cookie 里的键（cookie 给 /dl 的出错页用） */
export const LANG_KEY = "ct-lang";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** 一个语言标签对应哪种语言：zh-TW、zh-HK 也归到 zh，pt-BR 归到 pt，旧代码 in 归到 id */
export function localeOf(tag: string): Locale | null {
  const base = tag.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  if (base === "in") return "id";
  return isLocale(base) ? base : null;
}

/** 按浏览器语言的先后顺序，挑第一个支持的；都不支持就用英文 */
export function matchLocale(tags: readonly string[]): Locale {
  for (const t of tags) {
    const l = localeOf(t);
    if (l) return l;
  }
  return FALLBACK_LOCALE;
}

/** 解析 Accept-Language，按 q 值排序 */
export function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, i) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim(), q: q ? Number(q.slice(2)) || 0 : 1, i };
    })
    .filter((x) => x.tag && x.tag !== "*" && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map((x) => x.tag);
}

/** <html lang> 和 Intl 用的标签 */
export const htmlLang = (l: Locale) => (l === "zh" ? "zh-CN" : l);

/** 状态码的简短说明。界面上出现状态码时都带上它，比如「403 无权限」「403 Forbidden」 */
export const STATUS_TEXTS: Record<Locale, Record<number, string>> = {
  zh: { 400: "请求有误", 401: "未登录", 403: "无权限", 404: "找不到", 409: "冲突", 410: "已失效", 413: "文件太大", 415: "格式不支持", 429: "请求太多", 500: "服务器出错", 503: "服务暂不可用" },
  en: { 400: "Bad Request", 401: "Not Signed In", 403: "Forbidden", 404: "Not Found", 409: "Conflict", 410: "No Longer Valid", 413: "File Too Large", 415: "Unsupported Format", 429: "Too Many Requests", 500: "Server Error", 503: "Service Unavailable" },
  es: { 400: "Solicitud incorrecta", 401: "Sin sesión", 403: "Sin permiso", 404: "No encontrado", 409: "Conflicto", 410: "Ya no es válido", 413: "Archivo demasiado grande", 415: "Formato no admitido", 429: "Demasiadas solicitudes", 500: "Error del servidor", 503: "Servicio no disponible" },
  pt: { 400: "Requisição inválida", 401: "Sessão não iniciada", 403: "Sem permissão", 404: "Não encontrado", 409: "Conflito", 410: "Não é mais válido", 413: "Arquivo grande demais", 415: "Formato não suportado", 429: "Muitas solicitações", 500: "Erro no servidor", 503: "Serviço indisponível" },
  ru: { 400: "Неверный запрос", 401: "Нужен вход", 403: "Нет доступа", 404: "Не найдено", 409: "Конфликт", 410: "Больше не действует", 413: "Файл слишком большой", 415: "Формат не поддерживается", 429: "Слишком много запросов", 500: "Ошибка сервера", 503: "Сервис недоступен" },
  ja: { 400: "不正なリクエスト", 401: "未ログイン", 403: "権限なし", 404: "見つかりません", 409: "競合", 410: "無効", 413: "ファイルが大きすぎます", 415: "非対応の形式", 429: "リクエスト過多", 500: "サーバーエラー", 503: "サービス停止中" },
  de: { 400: "Ungültige Anfrage", 401: "Nicht angemeldet", 403: "Kein Zugriff", 404: "Nicht gefunden", 409: "Konflikt", 410: "Nicht mehr gültig", 413: "Datei zu groß", 415: "Format nicht unterstützt", 429: "Zu viele Anfragen", 500: "Serverfehler", 503: "Dienst nicht verfügbar" },
  fr: { 400: "Requête invalide", 401: "Non connecté", 403: "Accès refusé", 404: "Introuvable", 409: "Conflit", 410: "Plus valable", 413: "Fichier trop volumineux", 415: "Format non pris en charge", 429: "Trop de requêtes", 500: "Erreur serveur", 503: "Service indisponible" },
  id: { 400: "Permintaan tidak valid", 401: "Belum masuk", 403: "Tidak diizinkan", 404: "Tidak ditemukan", 409: "Konflik", 410: "Sudah tidak berlaku", 413: "File terlalu besar", 415: "Format tidak didukung", 429: "Terlalu banyak permintaan", 500: "Kesalahan server", 503: "Layanan tidak tersedia" },
};

/** 中文说明（服务端错误体的 error 字段、旧代码都用它） */
export const STATUS_TEXT = STATUS_TEXTS.zh;

export const statusText = (l: Locale, status: number) => STATUS_TEXTS[l][status] ?? STATUS_TEXTS.en[status] ?? "";

/** 「403 无权限」「403 Forbidden」 */
export const statusLabel = (l: Locale, status: number) => `${status} ${statusText(l, status)}`.trim();

/** 中文、日文用全角冒号，其他语言用半角冒号加空格 */
export const colon = (l: Locale) => (l === "zh" || l === "ja" ? "：" : ": ");

/** 导出 CSV 的表头和状态 */
export const CSV_TEXTS: Record<Locale, { headers: [string, string, string, string, string, string]; status: Record<"active" | "expired" | "revoked", string> }> = {
  zh: { headers: ["获取码", "状态", "已下载", "过期时间(UTC)", "备注", "创建时间(UTC)"], status: { active: "可用", expired: "已过期", revoked: "已作废" } },
  en: { headers: ["Code", "Status", "Downloaded", "Expires (UTC)", "Note", "Created (UTC)"], status: { active: "Active", expired: "Expired", revoked: "Revoked" } },
  es: { headers: ["Código", "Estado", "Descargadas", "Caduca (UTC)", "Nota", "Creado (UTC)"], status: { active: "Activo", expired: "Caducado", revoked: "Anulado" } },
  pt: { headers: ["Código", "Status", "Baixadas", "Expira em (UTC)", "Observação", "Criado em (UTC)"], status: { active: "Ativo", expired: "Expirado", revoked: "Revogado" } },
  ru: { headers: ["Код", "Статус", "Скачано", "Истекает (UTC)", "Заметка", "Создан (UTC)"], status: { active: "Действует", expired: "Истёк", revoked: "Отозван" } },
  ja: { headers: ["コード", "状態", "ダウンロード済み", "有効期限 (UTC)", "メモ", "作成日時 (UTC)"], status: { active: "有効", expired: "期限切れ", revoked: "無効化済み" } },
  de: { headers: ["Code", "Status", "Heruntergeladen", "Läuft ab (UTC)", "Notiz", "Erstellt (UTC)"], status: { active: "Aktiv", expired: "Abgelaufen", revoked: "Widerrufen" } },
  fr: { headers: ["Code", "Statut", "Téléchargées", "Expire le (UTC)", "Note", "Créé le (UTC)"], status: { active: "Actif", expired: "Expiré", revoked: "Révoqué" } },
  id: { headers: ["Kode", "Status", "Sudah diunduh", "Kedaluwarsa (UTC)", "Catatan", "Dibuat (UTC)"], status: { active: "Aktif", expired: "Kedaluwarsa", revoked: "Dicabut" } },
};
