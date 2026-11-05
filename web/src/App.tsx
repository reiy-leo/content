import { usePath } from "./router.ts";
import { NotFound } from "./components/NotFound.tsx";
import { Header } from "./components/Header.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { AdminPage } from "./pages/AdminPage.tsx";
import { PublicPage } from "./pages/PublicPage.tsx";

export function App() {
  const path = usePath();
  let page: React.ReactNode;
  let m: RegExpMatchArray | null;
  if (path === "/") page = <HomePage />;
  else if (path === "/admin" || path.startsWith("/admin/")) page = <AdminPage path={path} />;
  else if ((m = path.match(/^\/p\/([a-z0-9-]+)\/?$/))) page = <PublicPage slug={m[1]!} />;
  else page = <NotFound />;
  return (
    <div className="flex min-h-screen flex-col">
      <Header admin={path.startsWith("/admin")} />
      <div className="flex-1">{page}</div>
    </div>
  );
}
