// 获取码开关：开 = 要获取码才能下载；关 = 免码，任何人都能下，每个 IP 每分钟 50 次，可设整个项目的下载上限。
// 切换前弹窗确认。开着时右边有「获取码」按钮：生成一个 1 小时有效的码，连同说明一起复制到剪贴板。
import { useState } from "react";
import { Button, Dialog, Input, Switch, Text, useKumoToastManager } from "@cloudflare/kumo";
import { Download, KeyRound, Pencil } from "lucide-react";
import { FREE_RATE_PER_MIN, type ProjectSummary } from "../../../src/shared/types.ts";
import { api, errMsg } from "../api.ts";
import { copyText, fmtTime } from "../lib/format.ts";
import { getT, useI18n } from "../i18n/index.ts";

/** 「获取码」按钮复制出去的文字：码、公开地址、1 小时内有效、每张图一次 */
export function codeShareText(code: string, publicUrl: string, expiresAt: number | null) {
  const t = getT();
  return [t.shareCode(code), t.shareOpen(publicUrl), t.shareValid(expiresAt ? fmtTime(expiresAt) : null)].join("\n");
}

const parseMax = (v: string): number | null | "bad" => {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= 1_000_000 ? n : "bad";
};

export function AccessCard({ project, publicUrl, onSaved }: { project: ProjectSummary; publicUrl: string; onSaved: () => Promise<void> }) {
  const toast = useKumoToastManager();
  const { t } = useI18n();
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
      if (m === "bad") return setError(t.maxInvalid);
      void patch({ codeRequired: false, maxDownloads: m }, t.turnedOffToast, () => setConfirm(false));
    } else {
      void patch({ codeRequired: true }, t.turnedOnToast, () => setConfirm(false));
    }
  };

  const saveMax = () => {
    const m = parseMax(max);
    if (m === "bad") return setError(t.maxInvalid);
    void patch({ maxDownloads: m }, t.maxSavedToast, () => setEditMax(false));
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
      toast.add({ title: t.issuedToast(code), description: t.issuedDesc });
      await onSaved();
    } catch (e) {
      toast.add({ title: t.issueFailed, description: errMsg(e), variant: "error" });
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-kumo-base p-4 ring ring-kumo-line">
      <div className="grid gap-1">
        <Switch label={t.accessSwitch} checked={on} onCheckedChange={openConfirm} />
        <Text variant="secondary" size="sm">
          {on
            ? t.accessOnInfo(project.usedCodes)
            : t.accessOffInfo(project.freeDownloads, project.maxDownloads, FREE_RATE_PER_MIN)}
        </Text>
      </div>
      <div className="flex flex-wrap gap-2">
        {on ? (
          <Button variant="primary" icon={<KeyRound size={16} />} loading={issuing} onClick={issue}>{t.issueCode}</Button>
        ) : (
          <Button variant="secondary" icon={<Pencil size={16} />} onClick={openEditMax}>{t.downloadLimit}</Button>
        )}
      </div>

      <Dialog.Root open={confirm} onOpenChange={setConfirm}>
        <Dialog size="base" className="px-6 py-5">
          <div className="grid gap-4">
            <Dialog.Title className="text-base font-semibold">{on ? t.confirmOffTitle : t.confirmOnTitle}</Dialog.Title>
            <Dialog.Description className="text-kumo-subtle">
              {on
                ? t.confirmOffDesc(FREE_RATE_PER_MIN)
                : t.confirmOnDesc}
            </Dialog.Description>
            {on && (
              <Input
                label={t.maxLabel}
                type="number"
                min={1}
                placeholder={t.maxPlaceholder}
                value={max}
                onChange={(e) => setMax(e.target.value)}
                description={t.maxHintNew}
              />
            )}
            {error && <Text variant="error">{error}</Text>}
            <div className="flex justify-end gap-2">
              <Dialog.Close render={(p) => <Button {...p} variant="secondary">{t.cancel}</Button>} />
              <Button variant={on ? "destructive" : "primary"} icon={on ? <Download size={16} /> : <KeyRound size={16} />} loading={busy} onClick={toggle}>
                {on ? t.turnOff : t.turnOn}
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
            <Dialog.Title className="text-base font-semibold">{t.editMaxTitle}</Dialog.Title>
            <Input
              label={t.maxLabel}
              type="number"
              min={1}
              placeholder={t.maxPlaceholder}
              value={max}
              onChange={(e) => setMax(e.target.value)}
              description={t.maxHintEdit(project.freeDownloads)}
            />
            {error && <Text variant="error">{error}</Text>}
            <div className="flex justify-end gap-2">
              <Dialog.Close render={(p) => <Button {...p} variant="secondary">{t.cancel}</Button>} />
              <Button variant="primary" type="submit" loading={busy}>{t.save}</Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
