// 顶栏：左边站名，右边语言和主题切换；后台页多一个账号菜单。
import { useEffect, useState } from "react";
import { Button, DropdownMenu, Text } from "@cloudflare/kumo";
import { Globe, Languages, LogOut, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { getThemePref, setThemePref, type ThemePref } from "../theme.ts";
import { linkClick } from "../router.ts";
import { useMe } from "../lib/me.ts";
import { LOCALES, setLocale, useI18n, type Dict } from "../i18n/index.ts";
import { LOCALE_NAMES, htmlLang } from "../../../src/shared/i18n.ts";

const THEMES: { value: ThemePref; label: (t: Dict) => string; icon: LucideIcon }[] = [
  { value: "light", label: (t) => t.themeLight, icon: Sun },
  { value: "dark", label: (t) => t.themeDark, icon: Moon },
  { value: "system", label: (t) => t.themeSystem, icon: Monitor },
];

function LanguageMenu() {
  const { t, locale, chosen } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger render={<Button variant="ghost" shape="square" icon={<Languages size={16} />} aria-label={t.language} title={t.language} />} />
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item icon={<Globe size={16} />} onClick={() => setLocale(null)}>
          {t.languageAuto}
          {!chosen ? " ✓" : ""}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        {LOCALES.map((l) => (
          <DropdownMenu.Item key={l} onClick={() => setLocale(l)}>
            <span lang={htmlLang(l)}>{LOCALE_NAMES[l]}</span>
            {chosen && locale === l ? " ✓" : ""}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function ThemeMenu() {
  const { t } = useI18n();
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  const Current = THEMES.find((th) => th.value === pref)!.icon;
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger render={<Button variant="ghost" shape="square" icon={<Current size={16} />} aria-label={t.theme} title={t.theme} />} />
      <DropdownMenu.Content align="end">
        {THEMES.map((th) => (
          <DropdownMenu.Item
            key={th.value}
            icon={<th.icon size={16} />}
            onClick={() => {
              setThemePref(th.value);
              setPref(th.value);
            }}
          >
            {th.label(t)}
            {pref === th.value ? " ✓" : ""}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function AccountMenu() {
  const { t } = useI18n();
  const { user } = useMe();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button variant="ghost" icon={user.picture ? <img src={user.picture} alt="" className="size-5 rounded-full" referrerPolicy="no-referrer" /> : undefined}>
            <span className="hidden max-w-40 truncate sm:inline">{user.name ?? user.email}</span>
          </Button>
        }
      />
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item disabled>{user.email}</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          icon={<LogOut size={16} />}
          onClick={() => {
            const f = document.createElement("form");
            f.method = "POST";
            f.action = "/auth/logout";
            document.body.append(f);
            f.submit();
          }}
        >
          {t.logout}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

export function Header({ admin }: { admin: boolean }) {
  const { t } = useI18n();
  const [, force] = useState(0);
  useEffect(() => {
    // 跟随系统时，系统主题变了也要刷新图标状态
    const m = matchMedia("(prefers-color-scheme: dark)");
    const on = () => force((n) => n + 1);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return (
    <header className="sticky top-0 z-10 border-b border-kumo-line bg-kumo-base">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-5">
        <a href={admin ? "/admin" : "/"} onClick={linkClick(admin ? "/admin" : "/")} className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="size-7 rounded-md" />
          <Text variant="heading" as="span">{t.appName}</Text>
          {admin && <Text variant="secondary" as="span">{t.adminBadge}</Text>}
        </a>
        <div className="flex items-center gap-1">
          <LanguageMenu />
          <ThemeMenu />
          {admin && <AccountMenu />}
        </div>
      </div>
    </header>
  );
}
