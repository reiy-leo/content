// 项目详情：顶部是名字、状态、公开地址和发布按钮，再下面是获取码开关；然后三个标签页：图片 / 获取码 / 设置。
import { useCallback, useEffect, useState } from "react";
import { Badge, Banner, Button, InlineCopyText, Loader, Tabs, Text, useKumoToastManager } from "@cloudflare/kumo";
import { AlertCircle, ArrowLeft, ExternalLink, Eye, EyeOff } from "lucide-react";
import type { AdminImage, ProjectSummary } from "../../../src/shared/types.ts";
import { api, errMsg } from "../api.ts";
import { navigate } from "../router.ts";
import { ImagesTab } from "../components/ImagesTab.tsx";
import { CodesTab } from "../components/CodesTab.tsx";
import { SettingsTab } from "../components/SettingsTab.tsx";
import { NotFound } from "../components/NotFound.tsx";
import { AccessCard } from "../components/AccessCard.tsx";
import { useI18n } from "../i18n/index.ts";

export interface Detail { project: ProjectSummary; images: AdminImage[] }

export function AdminProjectPage({ id }: { id: string }) {
  const toast = useKumoToastManager();
  const { t } = useI18n();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<{ status: number; msg: string } | null>(null);
  const [tab, setTab] = useState(() => new URL(location.href).searchParams.get("tab") ?? "images");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await api<Detail>(`/api/admin/projects/${id}`));
      setError(null);
    } catch (e) {
      setError({ status: (e as { status?: number }).status ?? 0, msg: errMsg(e) });
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  const changeTab = (v: string) => {
    setTab(v);
    const url = new URL(location.href);
    url.searchParams.set("tab", v);
    history.replaceState(history.state, "", url.pathname + url.search);
  };

  if (error?.status === 404) return <NotFound title={t.projectGoneTitle} description={t.projectGoneDesc} />;
  if (!detail) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-8">
        {error ? <Banner variant="error" icon={<AlertCircle size={16} />} title={t.loadFailed} description={error.msg} /> : <Loader />}
      </main>
    );
  }
  const p = detail.project;
  const publicUrl = `${location.origin}/p/${p.slug}`;

  const togglePublish = async () => {
    setBusy(true);
    try {
      const next = await api<ProjectSummary>(`/api/admin/projects/${id}`, { method: "PATCH", json: { status: p.status === "published" ? "draft" : "published" } });
      setDetail({ ...detail, project: next });
      toast.add({ title: next.status === "published" ? t.publishedToast : t.unpublishedToast });
    } catch (e) {
      toast.add({ title: t.actionFailed, description: errMsg(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-5 py-8">
      <div className="grid gap-3">
        <div>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate("/admin")}>{t.allProjects}</Button>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <div className="flex items-center gap-2">
              <Text variant="heading" as="h1" size="lg" truncate>{p.title}</Text>
              {p.status === "published" ? <Badge variant="success">{t.published}</Badge> : <Badge variant="neutral">{t.draft}</Badge>}
            </div>
            <div className="flex items-center gap-1">
              <InlineCopyText value={publicUrl} labels={{ copyAction: t.copyPublicUrl, copied: t.copied }}>{publicUrl}</InlineCopyText>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<ExternalLink size={16} />} disabled={p.status !== "published"} onClick={() => window.open(publicUrl, "_blank", "noopener")}>
              {t.openPublicPage}
            </Button>
            <Button
              variant={p.status === "published" ? "secondary" : "primary"}
              icon={p.status === "published" ? <EyeOff size={16} /> : <Eye size={16} />}
              loading={busy}
              disabled={p.status !== "published" && p.imageCount === 0}
              onClick={togglePublish}
            >
              {p.status === "published" ? t.unpublish : t.publish}
            </Button>
          </div>
        </div>
      </div>
      <AccessCard project={p} publicUrl={publicUrl} onSaved={load} />
      <Tabs
        value={tab}
        onValueChange={changeTab}
        tabs={[
          { value: "images", label: t.tabImages(detail.images.length) },
          { value: "codes", label: t.tabCodes(p.codeCount) },
          { value: "settings", label: t.tabSettings },
        ]}
      />
      {tab === "images" && <ImagesTab detail={detail} reload={load} />}
      {tab === "codes" && <CodesTab project={p} imageCount={detail.images.length} reload={load} />}
      {tab === "settings" && <SettingsTab project={p} onSaved={(next) => setDetail({ ...detail, project: next })} />}
    </main>
  );
}
