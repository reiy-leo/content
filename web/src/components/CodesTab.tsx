// 获取码：批量生成（数量、有效期、备注）→ 列表看状态和使用情况 → 单个或批量作废 / 恢复、删除过期没用过的码、导出 CSV、看下载明细。
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Banner, Button, Dialog, Empty, InlineCopyText, Input, Loader, Select, Table, Text, useKumoToastManager } from "@cloudflare/kumo";
import { AlertCircle, Ban, Copy, FileDown, KeyRound, ListChecks, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { AdminCode, CodeDownload, CodeStatus, ProjectSummary } from "../../../src/shared/types.ts";
import { api, errMsg } from "../api.ts";
import { copyText, fmtTime } from "../lib/format.ts";
import { getLocale, useI18n, type Dict } from "../i18n/index.ts";

const expiryItems = (t: Dict): Record<string, string> => ({
  "1h": t.expiry1h, "1d": t.expiry1d, "3d": t.expiry3d, "7d": t.expiry7d, "30d": t.expiry30d, "90d": t.expiry90d, never: t.never, custom: t.expiryCustom,
});
const STATUS_VARIANT: Record<CodeStatus, "success" | "neutral" | "error"> = { active: "success", expired: "neutral", revoked: "error" };
const statusLabel = (t: Dict, s: CodeStatus) => ({ active: t.statusActive, expired: t.statusExpired, revoked: t.statusRevoked })[s];
const filterItems = (t: Dict): Record<string, string> => ({ all: t.filterAll, active: t.statusActive, expired: t.statusExpired, revoked: t.statusRevoked });

function GenerateDialog({ projectId, open, onOpenChange, onDone }: { projectId: string; open: boolean; onOpenChange: (v: boolean) => void; onDone: (codes: string[]) => void }) {
  const { t } = useI18n();
  const [count, setCount] = useState("10");
  const [expiry, setExpiry] = useState("7d");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    const body: Record<string, unknown> = { count: Number(count), note };
    if (expiry === "never") body.expiresAt = null;
    else if (expiry === "1h") body.expiresInHours = 1;
    else if (expiry === "custom") {
      if (!date) return setError(t.pickDateFirst);
      // 选的那天结束时过期（浏览器本地时区）
      body.expiresAt = new Date(`${date}T23:59:59`).getTime();
    } else body.expiresInDays = parseInt(expiry, 10);
    setBusy(true);
    try {
      const r = await api<{ codes: string[] }>(`/api/admin/projects/${projectId}/codes`, { method: "POST", json: body });
      onDone(r.codes);
      onOpenChange(false);
      setNote("");
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
          <Dialog.Title className="text-base font-semibold">{t.generateCodes}</Dialog.Title>
          <Input label={t.count} type="number" min={1} max={500} value={count} onChange={(e) => setCount(e.target.value)} description={t.countHint} />
          <Select label={t.validity} hideLabel={false} value={expiry} onValueChange={(v) => setExpiry(String(v))} items={expiryItems(t)} />
          {expiry === "custom" && <Input label={t.expiryDate} type="date" value={date} onChange={(e) => setDate(e.target.value)} description={t.expiryDateHint} />}
          <Input label={t.note} placeholder={t.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <Text variant="error">{error}</Text>}
          <div className="flex justify-end gap-2">
            <Dialog.Close render={(p) => <Button {...p} variant="secondary">{t.cancel}</Button>} />
            <Button variant="primary" type="submit" loading={busy}>{t.generate}</Button>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  );
}

function NewCodesDialog({ codes, onClose }: { codes: string[] | null; onClose: () => void }) {
  const toast = useKumoToastManager();
  const { t } = useI18n();
  return (
    <Dialog.Root open={codes !== null} onOpenChange={(v) => !v && onClose()}>
      <Dialog size="base" className="px-6 py-5">
        <div className="grid gap-4">
          <Dialog.Title className="text-base font-semibold">{t.generatedTitle(codes?.length ?? 0)}</Dialog.Title>
          <pre className="max-h-72 overflow-auto rounded-lg bg-kumo-recessed p-3 font-mono text-sm">{codes?.join("\n")}</pre>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              icon={<Copy size={16} />}
              onClick={async () => {
                await copyText(codes?.join("\n") ?? "");
                toast.add({ title: t.copied });
              }}
            >
              {t.copyAll}
            </Button>
            <Dialog.Close render={(p) => <Button {...p} variant="primary">{t.done}</Button>} />
          </div>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

/** 过期了、一张没下过的码才能删（后端会再查一遍，还会跳过有未过期下载票据的码） */
const canDelete = (c: AdminCode, at = Date.now()) => c.expiresAt !== null && c.expiresAt <= at && c.downloaded === 0;

function DeleteDialog({ ids, busy, onConfirm, onClose }: { ids: string[] | null; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog.Root open={ids !== null} onOpenChange={(v) => !v && onClose()}>
      <Dialog size="base" className="px-6 py-5">
        <div className="grid gap-4">
          <Dialog.Title className="text-base font-semibold">{t.deleteConfirmTitle(ids?.length ?? 0)}</Dialog.Title>
          <Text variant="secondary">{t.deleteConfirmDesc}</Text>
          <div className="flex justify-end gap-2">
            <Dialog.Close render={(p) => <Button {...p} variant="secondary">{t.cancel}</Button>} />
            <Button variant="destructive" icon={<Trash2 size={16} />} loading={busy} onClick={onConfirm}>{t.deleteCode}</Button>
          </div>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

function DownloadsDialog({ code, imageCount, onClose }: { code: AdminCode | null; imageCount: number; onClose: () => void }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<CodeDownload[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!code) return;
    setRows(null);
    setError(null);
    api<CodeDownload[]>(`/api/admin/codes/${code.id}/downloads`).then(setRows, (e) => setError(errMsg(e)));
  }, [code]);
  return (
    <Dialog.Root open={code !== null} onOpenChange={(v) => !v && onClose()}>
      <Dialog size="lg" className="px-6 py-5">
        <div className="grid gap-4">
          <Dialog.Title className="text-base font-semibold">
            {t.downloadsTitle(code?.code ?? "", code?.downloaded ?? 0, imageCount)}
          </Dialog.Title>
          {error && <Text variant="error">{error}</Text>}
          {!rows && !error && <Loader />}
          {rows && rows.length === 0 && <Text variant="secondary">{t.noDownloadsYet}</Text>}
          {rows && rows.length > 0 && (
            <div className="max-h-96 overflow-auto rounded-lg ring ring-kumo-line">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>{t.colFile}</Table.Head>
                    <Table.Head>{t.colStatus}</Table.Head>
                    <Table.Head>{t.colTime}</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {rows.map((r) => (
                    <Table.Row key={r.imageId}>
                      <Table.Cell>{r.filename}</Table.Cell>
                      <Table.Cell>{r.status === "done" ? <Badge variant="success">{t.dlDone}</Badge> : <Badge variant="neutral">{t.dlPending}</Badge>}</Table.Cell>
                      <Table.Cell>{fmtTime(r.completedAt ?? r.createdAt)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          )}
          <div className="flex justify-end">
            <Dialog.Close render={(p) => <Button {...p} variant="secondary">{t.close}</Button>} />
          </div>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

export function CodesTab({ project, imageCount, reload }: { project: ProjectSummary; imageCount: number; reload: () => Promise<void> }) {
  const toast = useKumoToastManager();
  const { t } = useI18n();
  const [codes, setCodes] = useState<AdminCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [fresh, setFresh] = useState<string[] | null>(null);
  const [detail, setDetail] = useState<AdminCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<string[] | null>(null);

  const load = useCallback(() => {
    api<AdminCode[]>(`/api/admin/projects/${project.id}/codes`).then(
      (c) => {
        setCodes(c);
        setError(null);
      },
      (e) => setError(errMsg(e)),
    );
  }, [project.id]);
  useEffect(load, [load]);

  const shown = useMemo(() => (codes ?? []).filter((c) => filter === "all" || c.status === filter), [codes, filter]);
  const counts = useMemo(() => {
    const n = { all: 0, active: 0, expired: 0, revoked: 0 } as Record<string, number>;
    for (const c of codes ?? []) {
      n.all!++;
      n[c.status]!++;
    }
    return n;
  }, [codes]);

  const setRevoked = async (ids: string[], restore: boolean) => {
    setBusy(true);
    try {
      await api(`/api/admin/projects/${project.id}/codes/revoke`, { method: "POST", json: { ids, restore } });
      toast.add({ title: restore ? t.restoredToast(ids.length) : t.revokedToast(ids.length) });
      setSelected(new Set());
      load();
    } catch (e) {
      toast.add({ title: t.actionFailed, description: errMsg(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const removeCodes = async (ids: string[]) => {
    setBusy(true);
    try {
      const r = await api<{ deleted: number; skipped: number }>(`/api/admin/projects/${project.id}/codes/delete`, { method: "POST", json: { ids } });
      toast.add({ title: t.codesDeletedToast(r.deleted), description: r.skipped ? t.deleteSkipped(r.skipped) : undefined });
      setSelected(new Set());
      setToDelete(null);
      load();
      void reload();
    } catch (e) {
      toast.add({ title: t.actionFailed, description: errMsg(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  };
  const deletableSelected = (codes ?? []).filter((c) => selected.has(c.id) && canDelete(c)).map((c) => c.id);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allChecked = shown.length > 0 && shown.every((c) => selected.has(c.id));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setGenerating(true)}>{t.generateCodes}</Button>
          <Select
            aria-label={t.filterByStatus}
            value={filter}
            onValueChange={(v) => {
              setFilter(String(v));
              setSelected(new Set());
            }}
            items={Object.fromEntries(Object.entries(filterItems(t)).map(([k, v]) => [k, `${v} ${counts[k] ?? 0}`]))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <>
              <Button variant="secondary" icon={<Ban size={16} />} loading={busy} onClick={() => setRevoked([...selected], false)}>{t.revokeSelected(selected.size)}</Button>
              <Button variant="secondary" icon={<RotateCcw size={16} />} disabled={busy} onClick={() => setRevoked([...selected], true)}>{t.restore}</Button>
              <Button
                variant="secondary"
                icon={<Trash2 size={16} />}
                disabled={busy || !deletableSelected.length}
                title={deletableSelected.length ? undefined : t.deleteOnlyExpired}
                onClick={() => setToDelete(deletableSelected)}
              >
                {t.deleteSelected(deletableSelected.length)}
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            icon={<Copy size={16} />}
            disabled={!counts.active}
            onClick={async () => {
              await copyText((codes ?? []).filter((c) => c.status === "active").map((c) => c.code).join("\n"));
              toast.add({ title: t.copiedActive(counts.active ?? 0) });
            }}
          >
            {t.copyActive}
          </Button>
          <Button variant="secondary" icon={<FileDown size={16} />} disabled={!counts.all} onClick={() => (location.href = `/api/admin/projects/${project.id}/codes.csv?lang=${getLocale()}`)}>
            {t.exportCsv}
          </Button>
        </div>
      </div>

      {error && <Banner variant="error" icon={<AlertCircle size={16} />} title={t.loadFailed} description={error} />}
      {!codes && !error && <Loader />}
      {codes && codes.length === 0 && (
        <Empty
          icon={<KeyRound size={32} />}
          title={t.noCodesTitle}
          description={project.status === "published" ? t.noCodesDescPublished : t.noCodesDescDraft}
          contents={<Button variant="primary" onClick={() => setGenerating(true)}>{t.generateCodes}</Button>}
        />
      )}
      {codes && codes.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-kumo-base ring ring-kumo-line">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.CheckHead
                  checked={allChecked}
                  indeterminate={!allChecked && shown.some((c) => selected.has(c.id))}
                  onCheckedChange={() => setSelected(allChecked ? new Set() : new Set(shown.map((c) => c.id)))}
                  aria-label={t.selectAll}
                />
                <Table.Head>{t.colCode}</Table.Head>
                <Table.Head>{t.colStatus}</Table.Head>
                <Table.Head>{t.colDownloaded}</Table.Head>
                <Table.Head>{t.colLastDownload}</Table.Head>
                <Table.Head>{t.colExpires}</Table.Head>
                <Table.Head>{t.colNote}</Table.Head>
                <Table.Head />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {shown.map((c) => (
                <Table.Row key={c.id} variant={selected.has(c.id) ? "selected" : "default"}>
                  <Table.CheckCell checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} aria-label={t.selectCode(c.code)} />
                  <Table.Cell>
                    <InlineCopyText variant="mono" labels={{ copyAction: t.copy, copied: t.copied }}>{c.code}</InlineCopyText>
                  </Table.Cell>
                  <Table.Cell><Badge variant={STATUS_VARIANT[c.status]}>{statusLabel(t, c.status)}</Badge></Table.Cell>
                  <Table.Cell>{c.downloaded} / {imageCount}</Table.Cell>
                  <Table.Cell>{fmtTime(c.lastDownloadAt)}</Table.Cell>
                  <Table.Cell>{c.expiresAt ? fmtTime(c.expiresAt) : t.never}</Table.Cell>
                  <Table.Cell><Text variant="secondary" size="sm" truncate>{c.note ?? ""}</Text></Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="xs" shape="square" icon={<ListChecks size={14} />} aria-label={t.downloadDetails} title={t.downloadDetails} onClick={() => setDetail(c)} />
                      {c.status === "revoked" ? (
                        <Button variant="ghost" size="xs" shape="square" icon={<RotateCcw size={14} />} aria-label={t.restore} title={t.restore} disabled={busy} onClick={() => setRevoked([c.id], true)} />
                      ) : (
                        <Button variant="ghost" size="xs" shape="square" icon={<Ban size={14} />} aria-label={t.revoke} title={t.revoke} disabled={busy} onClick={() => setRevoked([c.id], false)} />
                      )}
                      <Button
                        variant="ghost"
                        size="xs"
                        shape="square"
                        icon={<Trash2 size={14} />}
                        aria-label={t.deleteCode}
                        title={canDelete(c) ? t.deleteCode : t.deleteOnlyExpired}
                        disabled={busy || !canDelete(c)}
                        onClick={() => setToDelete([c.id])}
                      />
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}

      <GenerateDialog
        projectId={project.id}
        open={generating}
        onOpenChange={setGenerating}
        onDone={(c) => {
          setFresh(c);
          load();
          void reload();
        }}
      />
      <NewCodesDialog codes={fresh} onClose={() => setFresh(null)} />
      <DeleteDialog ids={toDelete} busy={busy} onConfirm={() => toDelete && void removeCodes(toDelete)} onClose={() => setToDelete(null)} />
      <DownloadsDialog code={detail} imageCount={imageCount} onClose={() => setDetail(null)} />
    </div>
  );
}

