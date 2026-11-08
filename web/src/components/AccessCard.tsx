// 获取码开关：开 = 要获取码才能下载；关 = 免码，任何人都能下，每个 IP 每分钟 50 次，可设整个项目的下载上限。
// 切换前弹窗确认。开着时右边有「获取码」按钮：生成一个 1 小时有效的码，连同说明一起复制到剪贴板。
import { useState } from "react";
import { Button, Dialog, Input, Switch, Text, useKumoToastManager } from "@cloudflare/kumo";
import { Download, KeyRound, Pencil } from "lucide-react";
import { FREE_RATE_PER_MIN, type ProjectSummary } from "../../../src/shared/types.ts";
import { api, errMsg } from "../api.ts";
import { copyText, fmtTime } from "../lib/format.ts";

/** 「获取码」按钮复制出去的文字：码、公开地址、1 小时内有效、每张图一次 */
export function codeShareText(code: string, publicUrl: string, expiresAt: number | null) {
  return [
    `获取码：${code}`,
    `打开 ${publicUrl} ，填入获取码就能下载原图。`,
    `1 小时内有效${expiresAt ? `（${fmtTime(expiresAt)} 前）` : ""}，每张图只能下载一次。`,
  ].join("\n");
}

const parseMax = (v: string): number | null | "bad" => {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= 1_000_000 ? n : "bad";
};

export function AccessCard({ project, publicUrl, onSaved }: { project: ProjectSummary; publicUrl: string; onSaved: () => Promise<void> }) {
  const toast = useKumoToastManager();
  const on = project.codeRequired;
  const [confirm, setConfirm] = useState(false);
  const [editMax, setEditMax] = useState(false);
  const [max, setMax] = useState("");
  const [busy, setBusy] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openConfirm = () => {
    setMax(project.maxDownloads ? String(project.maxDownloads) : "");
    setError(null);
    setConfirm(true);
  };
  const openEditMax = () => {
    setMax(project.maxDownloads ? String(project.maxDownloads) : "");
    setError(null);
    setEditMax(true);
  };

  const patch = async (body: Record<string, unknown>, done: string, close: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/projects/${project.id}`, { method: "PATCH", json: body });
      await onSaved();
      close();
      toast.add({ title: done });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    if (on) {
      const m = parseMax(max);
      if (m === "bad") return setError("上限要是 1 到 1000000 的整数，不限就留空");
      void patch({ codeRequired: false, maxDownloads: m }, "已关闭获取码，现在不用码就能下载", () => setConfirm(false));
    } else {
      void patch({ codeRequired: true }, "已开启获取码，免码下载已停止", () => setConfirm(false));
    }
  };

  const saveMax = () => {
    const m = parseMax(max);
    if (m === "bad") return setError("上限要是 1 到 1000000 的整数，不限就留空");
    void patch({ maxDownloads: m }, "已保存下载上限", () => setEditMax(false));
  };

  const issue = async () => {
    setIssuing(true);
    try {
      const r = await api<{ codes: string[]; expiresAt: number | null }>(`/api/admin/projects/${project.id}/codes`, {
        method: "POST",
        json: { count: 1, expiresInHours: 1 },
      });
      const code = r.codes[0]!;
      await copyText(codeShareText(code, publicUrl, r.expiresAt));
      toast.add({ title: `获取码 ${code} 已复制`, description: "连同说明一起复制好了，1 小时内有效。" });
      await onSaved();
    } catch (e) {
      toast.add({ title: "没能生成获取码", description: errMsg(e), variant: "error" });
    } finally {
      setIssuing(false);
    }
  };

  const limitText = project.maxDownloads ? `${project.freeDownloads} / ${project.maxDownloads} 次` : `${project.freeDownloads} 次，不限次数`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-kumo-base p-4 ring ring-kumo-line">
      <div className="grid gap-1">
        <Switch label="需要获取码" checked={on} onCheckedChange={openConfirm} />
        <Text variant="secondary" size="sm">
          {on
            ? `已有 ${project.usedCodes} 个获取码下载过图。`
            : `免码下载中，已下载 ${limitText}；每个 IP 每分钟最多 ${FREE_RATE_PER_MIN} 次。`}
        </Text>
      </div>
      <div className="flex flex-wrap gap-2">
        {on ? (
          <Button variant="primary" icon={<KeyRound size={16} />} loading={issuing} onClick={issue}>获取码</Button>
        ) : (
          <Button variant="secondary" icon={<Pencil size={16} />} onClick={openEditMax}>下载上限</Button>
        )}
      </div>

      <Dialog.Root open={confirm} onOpenChange={setConfirm}>
        <Dialog size="base" className="px-6 py-5">
          <div className="grid gap-4">
            <Dialog.Title className="text-base font-semibold">{on ? "关闭获取码？" : "开启获取码？"}</Dialog.Title>
            <Dialog.Description className="text-kumo-subtle">
              {on
                ? `关闭后，任何人打开公开页都能直接下载原图。每个 IP 每分钟最多 ${FREE_RATE_PER_MIN} 次。`
                : "开启后立即停止免码下载，已经发出去还没打开的免码下载链接也会失效。之后要填获取码才能下载。"}
            </Dialog.Description>
            {on && (
              <Input
                label="最多下载多少次"
                type="number"
                min={1}
                placeholder="不限"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                description="整个项目合计，比如 500。留空就不限。"
              />
            )}
            {error && <Text variant="error">{error}</Text>}
            <div className="flex justify-end gap-2">
              <Dialog.Close render={(p) => <Button {...p} variant="secondary">取消</Button>} />
              <Button variant={on ? "destructive" : "primary"} icon={on ? <Download size={16} /> : <KeyRound size={16} />} loading={busy} onClick={toggle}>
                {on ? "关闭获取码" : "开启获取码"}
              </Button>
            </div>
          </div>
        </Dialog>
      </Dialog.Root>

      <Dialog.Root open={editMax} onOpenChange={setEditMax}>
        <Dialog size="base" className="px-6 py-5">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveMax();
            }}
          >
            <Dialog.Title className="text-base font-semibold">免码下载上限</Dialog.Title>
            <Input
              label="最多下载多少次"
              type="number"
              min={1}
              placeholder="不限"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              description={`整个项目合计，现在已下载 ${project.freeDownloads} 次。留空就不限。`}
            />
            {error && <Text variant="error">{error}</Text>}
            <div className="flex justify-end gap-2">
              <Dialog.Close render={(p) => <Button {...p} variant="secondary">取消</Button>} />
              <Button variant="primary" type="submit" loading={busy}>保存</Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
