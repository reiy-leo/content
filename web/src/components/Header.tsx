// 顶栏：左边站名，右边主题切换；后台页多一个账号菜单。
import { useEffect, useState } from "react";
import { Button, DropdownMenu, Text } from "@cloudflare/kumo";
import { LogOut, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { getThemePref, setThemePref, type ThemePref } from "../theme.ts";
import { linkClick } from "../router.ts";
import { useMe } from "../lib/me.ts";

const THEMES: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
];

function ThemeMenu() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  const Current = THEMES.find((t) => t.value === pref)!.icon;
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger render={<Button variant="ghost" shape="square" icon={<Current size={16} />} aria-label="主题" title="主题" />} />
      <DropdownMenu.Content align="end">
        {THEMES.map((t) => (
          <DropdownMenu.Item
            key={t.value}
            icon={<t.icon size={16} />}
            onClick={() => {
              setThemePref(t.value);
              setPref(t.value);
            }}
          >
            {t.label}
            {pref === t.value ? " ✓" : ""}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function AccountMenu() {
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
          退出登录
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

export function Header({ admin }: { admin: boolean }) {
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
          <Text variant="heading" as="span">原图获取</Text>
          {admin && <Text variant="secondary" as="span">后台</Text>}
        </a>
        <div className="flex items-center gap-1">
          <ThemeMenu />
          {admin && <AccountMenu />}
        </div>
      </div>
    </header>
  );
}
