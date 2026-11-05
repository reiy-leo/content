// 设置：改名、短地址、简介；删除项目。
import { useState } from "react";
import { Button, Dialog, Input, InputArea, Text, useKumoToastManager } from "@cloudflare/kumo";
import { Trash2 } from "lucide-react";
import type { ProjectSummary } from "../../../src/shared/types.ts";
import { api, errMsg } from "../api.ts";
import { navigate } from "../router.ts";

export function SettingsTab({ project, onSaved }: { project: ProjectSummary; onSaved: (p: ProjectSummary) => void }) {
  const toast = useKumoToastManager();
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
      toast.add({ title: "已保存" });
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
      toast.add({ title: `已删除「${project.title}」` });
      navigate("/admin");
    } catch (e) {
      toast.add({ title: "删除失败", description: errMsg(e), variant: "error" });
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
        <Input label="项目名" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input
          label="短地址"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          description={slugChanged ? "改了以后旧链接会打不开，发出去的链接要重新发。" : "小写字母、数字和横线。"}
        />
        <InputArea aria-label="简介" placeholder="简介（可不填）" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        {error && <Text variant="error">{error}</Text>}
        <div>
          <Button variant="primary" type="submit" loading={busy}>保存</Button>
        </div>
      </form>

      <div className="grid gap-3 rounded-xl bg-kumo-base p-5 ring ring-kumo-line">
        <Text variant="heading" as="h2">删除项目</Text>
        <Text variant="secondary">原图、预览图、获取码和下载记录全部删掉，不能恢复。</Text>
        <div>
          <Button variant="secondary-destructive" icon={<Trash2 size={16} />} onClick={() => setConfirm(true)}>删除项目</Button>
        </div>
      </div>

      <Dialog.Root open={confirm} onOpenChange={setConfirm}>
        <Dialog size="base" className="px-6 py-5">
          <div className="grid gap-4">
            <Dialog.Title className="text-base font-semibold">删除「{project.title}」？</Dialog.Title>
            <Dialog.Description className="text-kumo-subtle">输入短地址 {project.slug} 确认。</Dialog.Description>
            <Input aria-label="短地址" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Dialog.Close render={(p) => <Button {...p} variant="secondary">取消</Button>} />
              <Button variant="destructive" loading={deleting} disabled={confirmText !== project.slug} onClick={remove}>删除</Button>
            </div>
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
