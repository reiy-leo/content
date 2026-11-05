// 后台：没登录显示登录卡片；登录后 /admin 是项目列表，/admin/projects/:id 是项目详情。
import { useCallback, useEffect, useState } from "react";
import { Badge, Banner, Button, Dialog, Empty, Input, InputArea, Loader, Text, useKumoToastManager } from "@cloudflare/kumo";
import { AlertCircle, FolderPlus, Images, KeyRound, Lock, Plus, X } from "lucide-react";
import type { LoginError, ProjectSummary } from "../../../src/shared/types.ts";
import { api, errMsg } from "../api.ts";
import { useMe } from "../lib/me.ts";
import { fmtTime } from "../lib/format.ts";
import { linkClick, navigate } from "../router.ts";
import { AdminProjectPage } from "./AdminProjectPage.tsx";
import { NotFound } from "../components/NotFound.tsx";

const LOGIN_ERROR_TEXT: Record<LoginError, string> = {
  unconfigured: "Google 登录还没配置（缺 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET 或 SESSION_SECRET）。",
  denied: "你取消了 Google 授权。",
  state: "登录状态校验失败，请重新登录。",
  token: "向 Google 换凭据失败，请稍后再试。",
  id_token: "Google 返回的身份信息无效。",
  unverified: "这个 Google 邮箱还没验证。",
  forbidden: "403 无权限：这个账号不是管理员。",
};

function LoginCard({ expired }: { expired: boolean }) {
  const [error, setError] = useState<LoginError | null>(() => {
    const v = new URL(location.href).searchParams.get("login_error");
    return v && v in LOGIN_ERROR_TEXT ? (v as LoginError) : null;
  });
  // 登录错误只显示一次：进页面就把 ?login_error 从地址栏抹掉
  useEffect(() => {
    const url = new URL(location.href);
    if (!url.searchParams.has("login_error")) return;
    url.searchParams.delete("login_error");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }, []);
  const login = () => (location.href = `/auth/login?returnTo=${encodeURIComponent(location.pathname)}`);
  return (
    <main className="mx-auto grid max-w-md gap-4 px-5 py-20">
      {error && (
        <Banner
          variant="error"
          icon={<AlertCircle size={16} />}
          title="登录失败"
          description={LOGIN_ERROR_TEXT[error]}
          action={<Button variant="ghost" shape="square" size="sm" icon={<X size={16} />} aria-label="关闭" onClick={() => setError(null)} />}
        />
      )}
      <div className="grid gap-4 rounded-xl bg-kumo-base p-6 ring ring-kumo-line">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-kumo-recessed text-kumo-subtle">
            <Lock size={18} />
          </span>
          <div className="grid gap-1">
            <Text variant="heading" as="h1">{expired ? "登录已过期" : "后台"}</Text>
            <Text variant="secondary">只有管理员能登录。访客看图、下载原图不用登录。</Text>
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={login}>用 Google 登录</Button>
        </div>
      </div>
    </main>
  );
}

function CreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const toast = useKumoToastManager();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await api<ProjectSummary>("/api/admin/projects", { method: "POST", json: { title, slug: slug.trim() || undefined, description } });
      toast.add({ title: `已新建「${p.title}」` });
      onOpenChange(false);
      setTitle("");
      setSlug("");
      setDescription("");
      navigate(`/admin/projects/${p.id}`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="base" className="px-6 py-5">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Dialog.Title className="text-base font-semibold">新建项目</Dialog.Title>
          <Input label="项目名" placeholder="比如：2026 秋季样片" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <Input
            label="短地址"
            description="公开地址是 content.rei8t.dev/p/短地址。不填就随机生成，之后也能改。"
            placeholder="autumn-2026"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
          <InputArea aria-label="简介" placeholder="简介（可不填），显示在公开页标题下面" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          {error && <Text variant="error">{error}</Text>}
          <div className="flex justify-end gap-2">
            <Dialog.Close render={(p) => <Button {...p} variant="secondary">取消</Button>} />
            <Button variant="primary" type="submit" loading={busy} disabled={!title.trim()}>新建</Button>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  );
}

function ProjectList() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => {
    api<ProjectSummary[]>("/api/admin/projects").then(setProjects, (e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);
  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-5 py-8">
      <div className="flex items-center justify-between gap-3">
        <Text variant="heading" as="h1" size="lg">项目</Text>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>新建项目</Button>
      </div>
      {error && <Banner variant="error" icon={<AlertCircle size={16} />} title="加载失败" description={error} />}
      {!projects && !error && <Loader />}
      {projects && projects.length === 0 && (
        <Empty
          icon={<FolderPlus size={32} />}
          title="还没有项目"
          description="新建一个项目，传几张图，发布后把链接和获取码发出去。"
          contents={<Button variant="primary" onClick={() => setCreating(true)}>新建项目</Button>}
        />
      )}
      {projects && projects.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <a
              key={p.id}
              href={`/admin/projects/${p.id}`}
              onClick={linkClick(`/admin/projects/${p.id}`)}
              className="grid content-start gap-2 rounded-xl bg-kumo-base p-5 ring ring-kumo-line hover:bg-kumo-tint"
            >
              <div className="flex items-start justify-between gap-2">
                <Text variant="heading" as="h2" truncate>{p.title}</Text>
                {p.status === "published" ? <Badge variant="success">已发布</Badge> : <Badge variant="neutral">草稿</Badge>}
              </div>
              <Text variant="mono-secondary">/p/{p.slug}</Text>
              <div className="flex items-center gap-4 text-kumo-subtle">
                <span className="flex items-center gap-1 text-sm"><Images size={14} /> {p.imageCount} 张</span>
                <span className="flex items-center gap-1 text-sm"><KeyRound size={14} /> {p.codeCount} 个码</span>
              </div>
              <Text variant="secondary" size="sm">更新于 {fmtTime(p.updatedAt)}</Text>
            </a>
          ))}
        </div>
      )}
      <CreateDialog open={creating} onOpenChange={setCreating} />
    </main>
  );
}

export function AdminPage({ path }: { path: string }) {
  const { loaded, user, expired } = useMe();
  if (!loaded) return <main className="px-5 py-20"><Loader /></main>;
  if (!user) return <LoginCard expired={expired} />;
  if (path === "/admin" || path === "/admin/") return <ProjectList />;
  const m = path.match(/^\/admin\/projects\/([\w-]+)\/?$/);
  if (m) return <AdminProjectPage key={m[1]} id={m[1]!} />;
  return <NotFound />;
}
