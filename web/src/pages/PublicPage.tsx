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
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="base" className="px-6 py-5">
        <div className="grid gap-4">
          <Dialog.Title className="text-base font-semibold">使用须知</Dialog.Title>
          <ul className="grid list-disc gap-1.5 pl-5 text-kumo-default">
            <li>原图只限你自己使用，不能转卖或再次销售。</li>
            <li>不是独占授权，别人也可能拿到同样的图。</li>
            <li>不包含商业授权。</li>
          </ul>
          <div className="grid gap-2">
            <Dialog.Description className="text-kumo-subtle">要商业授权，或定制动作、定制配对头像，请联系：</Dialog.Description>
            <div className="flex flex-wrap items-center gap-2">
              <Text variant="secondary" size="sm">邮件</Text>
              <ClipboardText text={CONTACT_EMAIL} tooltip={{ text: "复制", copiedText: "已复制" }} labels={{ copyAction: "复制邮箱" }} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Text variant="secondary" size="sm">微信</Text>
              <ClipboardText text={CONTACT_WECHAT} tooltip={{ text: "复制", copiedText: "已复制" }} labels={{ copyAction: "复制微信号" }} />
            </div>
          </div>
          <div className="flex justify-end">
            <Dialog.Close render={(p) => <Button {...p} variant="primary">我知道了</Button>} />
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
  const thumb = useThumb(slug, code, img.id, downloaded);
  return (
    <div className="grid overflow-hidden rounded-xl bg-kumo-base ring ring-kumo-line">
      <div className="relative bg-kumo-recessed" style={{ aspectRatio: `${img.width} / ${img.height}` }}>
        {downloaded && thumb ? (
          <img src={thumb} alt={`第 ${index + 1} 张（缩略图）`} className="size-full object-cover" />
        ) : (
          <img src={`/api/p/${slug}/mosaic/${img.id}`} alt={`第 ${index + 1} 张（马赛克预览）`} loading="lazy" className="ct-pixel size-full object-cover" />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <Text variant="secondary" size="sm">第 {index + 1} 张 · {img.width}×{img.height}</Text>
        {unlocked &&
          (downloaded ? (
            <Button size="sm" variant="secondary" icon={<Check size={14} />} disabled>已下载</Button>
          ) : (
            <Button size="sm" variant="primary" icon={<Download size={14} />} loading={busy} disabled={!canDownload} onClick={onDownload}>
              下载原图
            </Button>
          ))}
      </div>
    </div>
  );
}

export function PublicPage({ slug }: { slug: string }) {
  const toast = useKumoToastManager();
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
      (p) => {
        setProject(p);
        document.title = `${p.title} · 原图获取`;
      },
      (e) => setLoadError({ status: e instanceof ApiFail ? e.status : 0, msg: errMsg(e) }),
    );
  }, [slug]);
  useEffect(loadProject, [loadProject]);

  const tryCode = useCallback(
    async (raw: string, silent = false) => {
      const norm = normalizeCode(raw);
      if (!norm) {
        if (!silent) setCodeError("获取码是 8 位字母和数字，比如 ABCD-EFGH");
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
      toast.add({ title: "没能下载", description: errMsg(e), variant: "error" });
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
      toast.add({ title: "没能下载", description: errMsg(e), variant: "error" });
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

  if (loadError?.status === 404) return <NotFound title="404 找不到这个项目" description="链接可能写错了，或者项目还没发布、已经取消发布。" />;
  if (!project) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-10">
        {loadError ? <Banner variant="error" icon={<AlertCircle size={16} />} title="加载失败" description={loadError.msg} /> : <Loader />}
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
          {free ? `共 ${total} 张，预览图都打了马赛克，原图可以直接下载。` : `共 ${total} 张，预览图都打了马赛克。有获取码才能下载原图，每个码每张图只能下一次。`}
        </Text>
      </div>

      <div className="grid gap-3 rounded-xl bg-kumo-base p-4 ring ring-kumo-line">
        {free ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <Text bold>不用获取码，直接下载</Text>
              <Text variant={freeOut ? "error" : "secondary"} size="sm">
                {freeOut ? "这个项目的下载次数已经用完了。" : project.freeLeft !== null ? `整个项目还能下载 ${project.freeLeft} 次。` : "点每张图下面的「下载原图」。"}
              </Text>
            </div>
            {!freeOut && total > 1 && (
              <Button variant="primary" icon={<DownloadCloud size={16} />} loading={bulk} onClick={downloadRest}>全部下载</Button>
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
                aria-label="获取码"
                placeholder="填获取码，比如 ABCD-EFGH"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                variant={codeError ? "error" : "default"}
                error={codeError ?? undefined}
              />
            </div>
            <Button type="submit" variant="primary" icon={<KeyRound size={16} />} loading={checking}>用这个码</Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <Text bold>获取码 {code ? formatCode(code) : ""}</Text>
              {active ? (
                <Text variant="secondary" size="sm">
                  还能下 {left} 张{unlock.expiresAt ? `，${fmtDay(unlock.expiresAt)}过期` : "，不过期"}
                </Text>
              ) : (
                <Text variant="error" size="sm">
                  {unlock.status === "revoked" ? "这个码已作废，不能再下载。" : `这个码已在 ${unlock.expiresAt ? fmtDay(unlock.expiresAt) : ""}过期，不能再下载。`}
                </Text>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {active && left > 0 && (
                <Button variant="primary" icon={<DownloadCloud size={16} />} loading={bulk} onClick={downloadRest}>下载剩下的全部</Button>
              )}
              <Button variant="ghost" icon={<LogOut size={16} />} onClick={forget}>换一个码</Button>
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
