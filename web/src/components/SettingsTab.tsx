// 设置：改名、短地址、简介；删除项目。
import { useState } from "react";
import { Button, Dialog, Input, InputArea, Text, useKumoToastManager } from "@cloudflare/kumo";
import { Trash2 } from "lucide-react";
import type { ProjectSummary } from "../../../src/shared/types.ts";
import { api, errMsg } from "../api.ts";
import { navigate } from "../router.ts";
import { useI18n } from "../i18n/index.ts";

export function SettingsTab({ project, onSaved }: { project: ProjectSummary; onSaved: (p: ProjectSummary) => void }) {
  const toast = useKumoToastManager();
  const { t } = useI18n();
  const [title, setTitle] = useState(project.title);
  const [slug, setSlug] = useState(project.slug);
  const [description, setDescription] = useState(project.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await api<ProjectSummary>(`/api/admin/projects/${project.id}`, { method: "PATCH", json: { title, slug, description } });
      onSaved(next);
      toast.add({ title: t.saved });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api(`/api/admin/projects/${project.id}`, { method: "DELETE" });
      toast.add({ title: t.deletedProjectToast(project.title) });
      navigate("/admin");
    } catch (e) {
      toast.add({ title: t.deleteFailed, description: errMsg(e), variant: "error" });
      setDeleting(false);
    }
  };

  const slugChanged = slug !== project.slug && project.status === "published";

  return (
    <div className="grid max-w-xl gap-8">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input label={t.projectName} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input
          label={t.slug}
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          description={slugChanged ? t.slugChangedWarn : t.slugHint}
        />
        <InputArea aria-label={t.description} placeholder={t.descriptionPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        {error && <Text variant="error">{error}</Text>}
        <div>
          <Button variant="primary" type="submit" loading={busy}>{t.save}</Button>
        </div>
      </form>

      <div className="grid gap-3 rounded-xl bg-kumo-base p-5 ring ring-kumo-line">
        <Text variant="heading" as="h2">{t.deleteProject}</Text>
        <Text variant="secondary">{t.deleteProjectWarn}</Text>
        <div>
          <Button variant="secondary-destructive" icon={<Trash2 size={16} />} onClick={() => setConfirm(true)}>{t.deleteProject}</Button>
        </div>
      </div>

      <Dialog.Root open={confirm} onOpenChange={setConfirm}>
        <Dialog size="base" className="px-6 py-5">
          <div className="grid gap-4">
            <Dialog.Title className="text-base font-semibold">{t.deleteProjectTitle(project.title)}</Dialog.Title>
            <Dialog.Description className="text-kumo-subtle">{t.deleteProjectConfirm(project.slug)}</Dialog.Description>
            <Input aria-label={t.slug} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Dialog.Close render={(p) => <Button {...p} variant="secondary">{t.cancel}</Button>} />
              <Button variant="destructive" loading={deleting} disabled={confirmText !== project.slug} onClick={remove}>{t.delete}</Button>
            </div>
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
