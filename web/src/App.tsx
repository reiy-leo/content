import { useEffect } from "react";
import { usePath } from "./router.ts";
import { NotFound } from "./components/NotFound.tsx";
import { Header } from "./components/Header.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { AdminPage } from "./pages/AdminPage.tsx";
import { PublicPage } from "./pages/PublicPage.tsx";
import { useI18n } from "./i18n/index.ts";

export function App() {
  const path = usePath();
  const { t } = useI18n();
  let page: React.ReactNode;
  let m: RegExpMatchArray | null;
  if (path === "/") page = <HomePage />;
  else if (path === "/admin" || path.startsWith("/admin/")) page = <AdminPage path={path} />;
  else if ((m = path.match(/^\/p\/([a-z0-9-]+)\/?$/))) page = <PublicPage slug={m[1]!} />;
  else page = <NotFound />;
  // 公开页自己设标题（带项目名），其他页用站名
  const isPublic = path.startsWith("/p/");
  useEffect(() => {
    if (!isPublic) document.title = t.appName;
  }, [isPublic, t]);
  return (
    <div className="flex min-h-screen flex-col">
      <Header admin={path.startsWith("/admin")} />
      <div className="flex-1">{page}</div>
    </div>
  );
}
