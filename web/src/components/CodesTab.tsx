// 获取码：批量生成（数量、有效期、备注）→ 列表看状态和使用情况 → 单个或批量作废 / 恢复、导出 CSV、看下载明细。
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Banner, Button, Dialog, Empty, InlineCopyText, Input, Loader, Select, Table, Text, useKumoToastManager } from "@cloudflare/kumo";
import { AlertCircle, Ban, Copy, FileDown, KeyRound, ListChecks, Plus, RotateCcw } from "lucide-react";
import type { AdminCode, CodeDownload, CodeStatus, ProjectSummary } from "../../../src/shared/types.ts";
import { api, errMsg } from "../api.ts";
import { copyText, fmtTime } from "../lib/format.ts";

const EXPIRY: Record<string, string> = { "1": "1 天", "3": "3 天", "7": "7 天", "30": "30 天", "90": "90 天", never: "不过期", custom: "选日期" };
const STATUS: Record<CodeStatus, { label: string; variant: "success" | "neutral" | "error" }> = {
  active: { label: "可用", variant: "success" },
  expired: { label: "已过期", variant: "neutral" },
  revoked: { label: "已作废", variant: "error" },
};
const FILTERS: Record<string, string> = { all: "全部", active: "可用", expired: "已过期", revoked: "已作废" };

function GenerateDialog({ projectId, open, onOpenChange, onDone }: { projectId: string; open: boolean; onOpenChange: (v: boolean) => void; onDone: (codes: string[]) => void }) {
  const [count, setCount] = useState("10");
  const [expiry, setExpiry] = useState("7");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    const body: Record<string, unknown> = { count: Number(count), note };
    if (expiry === "never") body.expiresAt = null;
    else if (expiry === "custom") {
      if (!date) return setError("先选过期日期");
      // 选的那天结束时过期（浏览器本地时区）
      body.expiresAt = new Date(`${date}T23:59:59`).getTime();
    } else body.expiresInDays = Number(expiry);
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
          <Dialog.Title className="text-base font-semibold">生成获取码</Dialog.Title>
          <Input label="数量" type="number" min={1} max={500} value={count} onChange={(e) => setCount(e.target.value)} description="一次 1 到 500 个" />
          <Select label="有效期" hideLabel={false} value={expiry} onValueChange={(v) => setExpiry(String(v))} items={EXPIRY} />
          {expiry === "custom" && <Input label="过期日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} description="这一天结束时过期" />}
          <Input label="备注" placeholder="可不填，比如：给小王" value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <Text variant="error">{error}</Text>}
          <div className="flex justify-end gap-2">
            <Dialog.Close render={(p) => <Button {...p} variant="secondary">取消</Button>} />
            <Button variant="primary" type="submit" loading={busy}>生成</Button>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  );
}

function NewCodesDialog({ codes, onClose }: { codes: string[] | null; onClose: () => void }) {
  const toast = useKumoToastManager();
  return (
    <Dialog.Root open={codes !== null} onOpenChange={(v) => !v && onClose()}>
      <Dialog size="base" className="px-6 py-5">
        <div className="grid gap-4">
          <Dialog.Title className="text-base font-semibold">生成了 {codes?.length ?? 0} 个获取码</Dialog.Title>
          <pre className="max-h-72 overflow-auto rounded-lg bg-kumo-recessed p-3 font-mono text-sm">{codes?.join("\n")}</pre>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              icon={<Copy size={16} />}
              onClick={async () => {
                await copyText(codes?.join("\n") ?? "");
                toast.add({ title: "已复制" });
              }}
            >
              全部复制
            </Button>
            <Dialog.Close render={(p) => <Button {...p} variant="primary">好了</Button>} />
          </div>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

function DownloadsDialog({ code, imageCount, onClose }: { code: AdminCode | null; imageCount: number; onClose: () => void }) {
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
            {code?.code} 的下载明细（{code?.downloaded ?? 0}/{imageCount}）
          </Dialog.Title>
          {error && <Text variant="error">{error}</Text>}
          {!rows && !error && <Loader />}
          {rows && rows.length === 0 && <Text variant="secondary">这个码还没下过图。</Text>}
          {rows && rows.length > 0 && (
            <div className="max-h-96 overflow-auto rounded-lg ring ring-kumo-line">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>文件</Table.Head>
                    <Table.Head>状态</Table.Head>
                    <Table.Head>时间</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {rows.map((r) => (
                    <Table.Row key={r.imageId}>
                      <Table.Cell>{r.filename}</Table.Cell>
                      <Table.Cell>{r.status === "done" ? <Badge variant="success">已下载</Badge> : <Badge variant="neutral">已点下载、没开始传</Badge>}</Table.Cell>
                      <Table.Cell>{fmtTime(r.completedAt ?? r.createdAt)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          )}
          <div className="flex justify-end">
            <Dialog.Close render={(p) => <Button {...p} variant="secondary">关闭</Button>} />
          </div>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

export function CodesTab({ project, imageCount, reload }: { project: ProjectSummary; imageCount: number; reload: () => Promise<void> }) {
  const toast = useKumoToastManager();
  const [codes, setCodes] = useState<AdminCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [fresh, setFresh] = useState<string[] | null>(null);
  const [detail, setDetail] = useState<AdminCode | null>(null);
  const [busy, setBusy] = useState(false);

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
      toast.add({ title: restore ? `已恢复 ${ids.length} 个` : `已作废 ${ids.length} 个` });
      setSelected(new Set());
      load();
    } catch (e) {
      toast.add({ title: "操作失败", description: errMsg(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

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
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setGenerating(true)}>生成获取码</Button>
          <Select
            aria-label="按状态筛选"
            value={filter}
            onValueChange={(v) => {
              setFilter(String(v));
              setSelected(new Set());
            }}
            items={Object.fromEntries(Object.entries(FILTERS).map(([k, v]) => [k, `${v} ${counts[k] ?? 0}`]))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <>
              <Button variant="secondary" icon={<Ban size={16} />} loading={busy} onClick={() => setRevoked([...selected], false)}>作废选中的 {selected.size} 个</Button>
              <Button variant="secondary" icon={<RotateCcw size={16} />} disabled={busy} onClick={() => setRevoked([...selected], true)}>恢复</Button>
            </>
          )}
          <Button
            variant="secondary"
            icon={<Copy size={16} />}
            disabled={!counts.active}
            onClick={async () => {
              await copyText((codes ?? []).filter((c) => c.status === "active").map((c) => c.code).join("\n"));
              toast.add({ title: `已复制 ${counts.active} 个可用的码` });
            }}
          >
            复制可用的码
          </Button>
          <Button variant="secondary" icon={<FileDown size={16} />} disabled={!counts.all} onClick={() => (location.href = `/api/admin/projects/${project.id}/codes.csv`)}>
            导出 CSV
          </Button>
        </div>
      </div>

      {error && <Banner variant="error" icon={<AlertCircle size={16} />} title="加载失败" description={error} />}
      {!codes && !error && <Loader />}
      {codes && codes.length === 0 && (
        <Empty
          icon={<KeyRound size={32} />}
          title="还没有获取码"
          description={project.status === "published" ? "生成一批码，发给要下载原图的人。" : "可以先生成，项目发布后才能用。"}
          contents={<Button variant="primary" onClick={() => setGenerating(true)}>生成获取码</Button>}
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
                  aria-label="全选"
                />
                <Table.Head>获取码</Table.Head>
                <Table.Head>状态</Table.Head>
                <Table.Head>已下载</Table.Head>
                <Table.Head>最后下载</Table.Head>
                <Table.Head>过期时间</Table.Head>
                <Table.Head>备注</Table.Head>
                <Table.Head />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {shown.map((c) => (
                <Table.Row key={c.id} variant={selected.has(c.id) ? "selected" : "default"}>
                  <Table.CheckCell checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} aria-label={`选择 ${c.code}`} />
                  <Table.Cell>
                    <InlineCopyText variant="mono" labels={{ copyAction: "复制", copied: "已复制" }}>{c.code}</InlineCopyText>
                  </Table.Cell>
                  <Table.Cell><Badge variant={STATUS[c.status].variant}>{STATUS[c.status].label}</Badge></Table.Cell>
                  <Table.Cell>{c.downloaded} / {imageCount}</Table.Cell>
                  <Table.Cell>{fmtTime(c.lastDownloadAt)}</Table.Cell>
                  <Table.Cell>{c.expiresAt ? fmtTime(c.expiresAt) : "不过期"}</Table.Cell>
                  <Table.Cell><Text variant="secondary" size="sm" truncate>{c.note ?? ""}</Text></Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="xs" shape="square" icon={<ListChecks size={14} />} aria-label="下载明细" title="下载明细" onClick={() => setDetail(c)} />
                      {c.status === "revoked" ? (
                        <Button variant="ghost" size="xs" shape="square" icon={<RotateCcw size={14} />} aria-label="恢复" title="恢复" disabled={busy} onClick={() => setRevoked([c.id], true)} />
                      ) : (
                        <Button variant="ghost" size="xs" shape="square" icon={<Ban size={14} />} aria-label="作废" title="作废" disabled={busy} onClick={() => setRevoked([c.id], false)} />
                      )}
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
      <DownloadsDialog code={detail} imageCount={imageCount} onClose={() => setDetail(null)} />
    </div>
  );
}

