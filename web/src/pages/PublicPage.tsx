// 公开页：所有图只显示马赛克图。填获取码后每张图出现「下载原图」；下过的图换成清晰缩略图，不能再下。
// 项目关了获取码（免码）时，不用填码，每张图直接能下。
// 获取码只存在这个标签页（sessionStorage），不进 cookie，也不进 URL。填码成功后弹出使用须知。
import { useCallback, useEffect, useRef, useState } from "react";
import { Banner, Button, ClipboardText, Dialog, Input, Loader, Text, useKumoToastManager } from "@cloudflare/kumo";
import { AlertCircle, Check, Download, DownloadCloud, KeyRound, LogOut } from "lucide-react";
import {
  CONTACT_EMAIL, CONTACT_WECHAT, formatCode, normalizeCode, type PublicImage, type PublicProject, type UnlockResult,
} from "../../../src/shared/types.ts";
import { ApiFail, api, errMsg } from "../api.ts";
import { fmtDay } from "../lib/format.ts";
import { NotFound } from "../components/NotFound.tsx";
import { getT, useI18n } from "../i18n/index.ts";

const storeKey = (slug: string) => `ct-code:${slug}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 已下载的图：用码去拿缩略图（码放请求头里），转成 blob 地址显示 */
function useThumb(slug: string, code: string | null, imageId: string, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !code) return;
    let alive = true;
    let objectUrl: string | null = null;
    void (async () => {
      // 刚下载时 /dl 可能还没把记录标成已下载，稍等重试几次
      for (let i = 0; i < 5 && alive; i++) {
        const res = await fetch(`/api/p/${slug}/thumb/${imageId}`, { headers: { "X-Access-Code": code } }).catch(() => null);
        if (res?.ok) {
          objectUrl = URL.createObjectURL(await res.blob());
          if (alive) setUrl(objectUrl);
          return;
        }
        await sleep(1200);
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [slug, code, imageId, enabled]);
  return url;
}

/** 填码成功后的使用须知 */
function TermsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="base" className="px-6 py-5">
        <div className="grid gap-4">
          <Dialog.Title className="text-base font-semibold">{t.termsTitle}</Dialog.Title>
          <ul className="grid list-disc gap-1.5 pl-5 text-kumo-default">
            <li>{t.terms1}</li>
            <li>{t.terms2}</li>
            <li>{t.terms3}</li>
          </ul>
          <div className="grid gap-2">
            <Dialog.Description className="text-kumo-subtle">{t.termsContact}</Dialog.Description>
            <div className="flex flex-wrap items-center gap-2">
              <Text variant="secondary" size="sm">{t.email}</Text>
              <ClipboardText text={CONTACT_EMAIL} tooltip={{ text: t.copy, copiedText: t.copied }} labels={{ copyAction: t.copyEmail }} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Text variant="secondary" size="sm">{t.wechat}</Text>
              <ClipboardText text={CONTACT_WECHAT} tooltip={{ text: t.copy, copiedText: t.copied }} labels={{ copyAction: t.copyWechat }} />
            </div>
          </div>
          <div className="flex justify-end">
            <Dialog.Close render={(p) => <Button {...p} variant="primary">{t.gotIt}</Button>} />
          </div>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

function ImageTile({
  slug, img, index, code, unlocked, downloaded, canDownload, busy, onDownload,
}: {
  slug: string; img: PublicImage; index: number; code: string | null; unlocked: boolean; downloaded: boolean; canDownload: boolean; busy: boolean; onDownload: () => void;
}) {
  const { t } = useI18n();
  const thumb = useThumb(slug, code, img.id, downloaded);
  return (
    <div className="grid overflow-hidden rounded-xl bg-kumo-base ring ring-kumo-line">
      <div className="relative bg-kumo-recessed" style={{ aspectRatio: `${img.width} / ${img.height}` }}>
        {downloaded && thumb ? (
          <img src={thumb} alt={t.imageAltThumb(index + 1)} className="size-full object-cover" />
        ) : (
          <img src={`/api/p/${slug}/mosaic/${img.id}`} alt={t.imageAltMosaic(index + 1)} loading="lazy" className="ct-pixel size-full object-cover" />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <Text variant="secondary" size="sm">{t.imageMeta(index + 1, img.width, img.height)}</Text>
        {unlocked &&
          (downloaded ? (
            <Button size="sm" variant="secondary" icon={<Check size={14} />} disabled>{t.downloaded}</Button>
          ) : (
            <Button size="sm" variant="primary" icon={<Download size={14} />} loading={busy} disabled={!canDownload} onClick={onDownload}>
              {t.downloadOriginal}
            </Button>
          ))}
      </div>
    </div>
  );
}

export function PublicPage({ slug }: { slug: string }) {
  const toast = useKumoToastManager();
  const { t } = useI18n();
  const [project, setProject] = useState<PublicProject | null>(null);
  const [loadError, setLoadError] = useState<{ status: number; msg: string } | null>(null);
  const [input, setInput] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [unlock, setUnlock] = useState<UnlockResult | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const [terms, setTerms] = useState(false);
  const bulkStop = useRef(false);

  const loadProject = useCallback(() => {
    api<PublicProject>(`/api/p/${slug}`).then(
      (p) => setProject(p),
      (e) => setLoadError({ status: e instanceof ApiFail ? e.status : 0, msg: errMsg(e) }),
    );
  }, [slug]);
  useEffect(loadProject, [loadProject]);
  // 标题跟着语言变
  useEffect(() => {
    if (project) document.title = `${project.title} · ${t.appName}`;
  }, [project?.title, t]);

  const tryCode = useCallback(
    async (raw: string, silent = false) => {
      const norm = normalizeCode(raw);
      if (!norm) {
        if (!silent) setCodeError(getT().codeFormat);
        return;
      }
      setChecking(true);
      setCodeError(null);
      try {
        const r = await api<UnlockResult>(`/api/p/${slug}/unlock`, { method: "POST", json: { code: norm } });
        setCode(norm);
        setUnlock(r);
        sessionStorage.setItem(storeKey(slug), norm);
        if (!silent && r.status === "active") setTerms(true);
      } catch (e) {
        sessionStorage.removeItem(storeKey(slug));
        if (!silent) setCodeError(errMsg(e));
      } finally {
        setChecking(false);
      }
    },
    [slug],
  );

  // 同一个标签页里刷新，自动带上之前填过的码
  useEffect(() => {
    const saved = sessionStorage.getItem(storeKey(slug));
    if (saved) {
      setInput(formatCode(saved));
      void tryCode(saved, true);
    }
  }, [slug, tryCode]);

  const forget = () => {
    bulkStop.current = true;
    sessionStorage.removeItem(storeKey(slug));
    setCode(null);
    setUnlock(null);
    setInput("");
  };

  const startDownload = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.append(a);
    a.click();
    a.remove();
  };

  const setBusy = (imageId: string, on: boolean) =>
    setBusyIds((s) => {
      const n = new Set(s);
      if (on) n.add(imageId);
      else n.delete(imageId);
      return n;
    });

  /** 免码下载：不带码，可以重复下 */
  const downloadFree = async (imageId: string): Promise<boolean> => {
    setBusy(imageId, true);
    try {
      const r = await api<{ url: string }>(`/api/p/${slug}/downloads`, { method: "POST", json: { imageId } });
      startDownload(r.url);
      setProject((p) => (p && p.freeLeft !== null ? { ...p, freeLeft: Math.max(0, p.freeLeft - 1) } : p));
      return true;
    } catch (e) {
      // 403：刚开了获取码；410：次数用完。都重新拉一次项目
      if (e instanceof ApiFail && (e.status === 403 || e.status === 410)) loadProject();
      toast.add({ title: t.downloadFailed, description: errMsg(e), variant: "error" });
      return false;
    } finally {
      setBusy(imageId, false);
    }
  };

  const downloadOne = async (imageId: string): Promise<boolean> => {
    if (!project?.codeRequired) return downloadFree(imageId);
    if (!code) return false;
    setBusy(imageId, true);
    try {
      const r = await api<{ url: string }>(`/api/p/${slug}/downloads`, { method: "POST", json: { code, imageId } });
      startDownload(r.url);
      setUnlock((u) => (u ? { ...u, downloaded: [...new Set([...u.downloaded, imageId])] } : u));
      return true;
    } catch (e) {
      if (e instanceof ApiFail && e.status === 409) setUnlock((u) => (u ? { ...u, downloaded: [...new Set([...u.downloaded, imageId])] } : u));
      if (e instanceof ApiFail && e.status === 410) void tryCode(code, true);
      if (e instanceof ApiFail && e.status === 403) loadProject();
      toast.add({ title: t.downloadFailed, description: errMsg(e), variant: "error" });
      return false;
    } finally {
      setBusy(imageId, false);
    }
  };

  const downloadRest = async () => {
    if (!project || (project.codeRequired && !unlock)) return;
    bulkStop.current = false;
    setBulk(true);
    const rest = project.codeRequired ? project.images.filter((i) => !unlock!.downloaded.includes(i.id)) : project.images;
    for (const img of rest) {
      if (bulkStop.current) break;
      const ok = await downloadOne(img.id);
      if (!ok) break;
      await sleep(1500); // 给浏览器一点时间开始上一张，避免被当成批量弹窗拦掉
    }
    setBulk(false);
  };

  if (loadError?.status === 404) return <NotFound title={t.projectNotFoundTitle} description={t.projectNotFoundDesc} />;
  if (!project) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-10">
        {loadError ? <Banner variant="error" icon={<AlertCircle size={16} />} title={t.loadFailed} description={loadError.msg} /> : <Loader />}
      </main>
    );
  }

  const free = !project.codeRequired;
  const freeOut = free && project.freeLeft === 0;
  const active = unlock?.status === "active";
  const total = project.images.length;
  const left = unlock ? project.images.filter((i) => !unlock.downloaded.includes(i.id)).length : total;

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-5 py-8">
      <div className="grid gap-2">
        <Text variant="heading" as="h1" size="lg">{project.title}</Text>
        {project.description && <Text variant="secondary" DANGEROUS_className="whitespace-pre-line">{project.description}</Text>}
        <Text variant="secondary" size="sm">
          {free ? t.summaryFree(total) : t.summaryCode(total)}
        </Text>
      </div>

      <div className="grid gap-3 rounded-xl bg-kumo-base p-4 ring ring-kumo-line">
        {free ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <Text bold>{t.freeTitle}</Text>
              <Text variant={freeOut ? "error" : "secondary"} size="sm">
                {freeOut ? t.freeOut : project.freeLeft !== null ? t.freeLeft(project.freeLeft) : t.freeHint}
              </Text>
            </div>
            {!freeOut && total > 1 && (
              <Button variant="primary" icon={<DownloadCloud size={16} />} loading={bulk} onClick={downloadRest}>{t.downloadAll}</Button>
            )}
          </div>
        ) : !unlock ? (
          <form
            className="flex flex-wrap items-start gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void tryCode(input);
            }}
          >
            <div className="min-w-56 flex-1">
              <Input
                aria-label={t.accessCode}
                placeholder={t.codePlaceholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                variant={codeError ? "error" : "default"}
                error={codeError ?? undefined}
              />
            </div>
            <Button type="submit" variant="primary" icon={<KeyRound size={16} />} loading={checking}>{t.useCode}</Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <Text bold>{t.codeLabel(code ? formatCode(code) : "")}</Text>
              {active ? (
                <Text variant="secondary" size="sm">
                  {t.leftActive(left, unlock.expiresAt ? fmtDay(unlock.expiresAt) : null)}
                </Text>
              ) : (
                <Text variant="error" size="sm">
                  {unlock.status === "revoked" ? t.codeRevokedMsg : t.codeExpiredMsg(unlock.expiresAt ? fmtDay(unlock.expiresAt) : "")}
                </Text>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {active && left > 0 && (
                <Button variant="primary" icon={<DownloadCloud size={16} />} loading={bulk} onClick={downloadRest}>{t.downloadRest}</Button>
              )}
              <Button variant="ghost" icon={<LogOut size={16} />} onClick={forget}>{t.changeCode}</Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {project.images.map((img, i) => (
          <ImageTile
            key={img.id}
            slug={slug}
            img={img}
            index={i}
            code={code}
            unlocked={free || !!unlock}
            downloaded={!free && !!unlock?.downloaded.includes(img.id)}
            canDownload={(free ? !freeOut : active) && !bulk}
            busy={busyIds.has(img.id)}
            onDownload={() => void downloadOne(img.id)}
          />
        ))}
      </div>
      <TermsDialog open={terms} onOpenChange={setTerms} />
    </main>
  );
}
