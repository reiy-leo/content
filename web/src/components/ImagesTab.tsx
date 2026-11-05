// 图片：拖文件进来或点按钮选图 → 浏览器先生成马赛克图和缩略图 → 三个文件一起上传。
// 已传的图可以拖动排序、看原图、删除。
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Dialog, Empty, Meter, Text, useKumoToastManager } from "@cloudflare/kumo";
import { Download, ExternalLink, GripVertical, ImagePlus, Trash2, Upload, X } from "lucide-react";
import type { AdminImage } from "../../../src/shared/types.ts";
import { api, errMsg, uploadForm } from "../api.ts";
import { ACCEPT, makePreviews } from "../lib/preview.ts";
import { fmtBytes } from "../lib/format.ts";
import type { Detail } from "../pages/AdminProjectPage.tsx";

const MAX_BYTES = 95 * 1024 * 1024;
const CONCURRENCY = 2;

interface QueueItem { key: string; file: File; state: "waiting" | "preview" | "uploading" | "done" | "error"; progress: number; error?: string }

function ImageCard({
  img, onDelete, dragProps, dragging,
}: {
  img: AdminImage;
  onDelete: () => void;
  dragProps: React.HTMLAttributes<HTMLDivElement>;
  dragging: boolean;
}) {
  return (
    <div {...dragProps} className={`group grid overflow-hidden rounded-xl bg-kumo-base ring ring-kumo-line ${dragging ? "opacity-40" : ""}`}>
      <div className="relative aspect-[4/3] bg-kumo-recessed">
        <img src={`/api/admin/images/${img.id}/thumb`} alt={img.filename} loading="lazy" className="size-full object-contain" draggable={false} />
        <span className="absolute left-2 top-2 flex size-7 cursor-grab items-center justify-center rounded-md bg-kumo-base/80 text-kumo-subtle" title="拖动排序">
          <GripVertical size={14} />
        </span>
      </div>
      <div className="grid gap-1 p-3">
        <Text size="sm" truncate title={img.filename}>{img.filename}</Text>
        <div className="flex items-center justify-between gap-2">
          <Text variant="secondary" size="xs">{img.width}×{img.height} · {fmtBytes(img.sizeBytes)}</Text>
          {img.downloads > 0 ? <Badge variant="info" icon={<Download size={12} />}>{img.downloads}</Badge> : null}
        </div>
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="xs" shape="square" icon={<ExternalLink size={14} />} aria-label="看原图" title="看原图" onClick={() => window.open(`/api/admin/images/${img.id}/original`, "_blank", "noopener")} />
          <Button variant="ghost" size="xs" shape="square" icon={<Trash2 size={14} />} aria-label="删除" title="删除" onClick={onDelete} />
        </div>
      </div>
    </div>
  );
}

export function ImagesTab({ detail, reload }: { detail: Detail; reload: () => Promise<void> }) {
  const toast = useKumoToastManager();
  const projectId = detail.project.id;
  const [images, setImages] = useState(detail.images);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [over, setOver] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<AdminImage | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const running = useRef(0);

  useEffect(() => setImages(detail.images), [detail.images]);

  const patch = (key: string, p: Partial<QueueItem>) => setQueue((q) => q.map((it) => (it.key === key ? { ...it, ...p } : it)));

  // 队列调度：同时最多传 CONCURRENCY 张
  useEffect(() => {
    const waiting = queue.filter((q) => q.state === "waiting");
    if (!waiting.length || running.current >= CONCURRENCY) return;
    for (const item of waiting.slice(0, CONCURRENCY - running.current)) {
      running.current++;
      patch(item.key, { state: "preview" });
      void (async () => {
        try {
          const pv = await makePreviews(item.file);
          patch(item.key, { state: "uploading" });
          const form = new FormData();
          form.append("original", item.file, item.file.name);
          form.append("mosaic", pv.mosaic, "mosaic.webp");
          form.append("thumb", pv.thumb, "thumb.webp");
          form.append("filename", item.file.name);
          form.append("width", String(pv.width));
          form.append("height", String(pv.height));
          await uploadForm(`/api/admin/projects/${projectId}/images`, form, (r) => patch(item.key, { progress: r }));
          patch(item.key, { state: "done", progress: 1 });
        } catch (e) {
          patch(item.key, { state: "error", error: errMsg(e) });
        } finally {
          running.current--;
          setQueue((q) => [...q]); // 触发下一轮调度
        }
      })();
    }
  }, [queue, projectId]);

  // 全部传完后刷新列表，并清掉成功的
  const allSettled = queue.length > 0 && queue.every((q) => q.state === "done" || q.state === "error");
  useEffect(() => {
    if (!allSettled) return;
    void reload();
    const ok = queue.filter((q) => q.state === "done").length;
    if (ok) toast.add({ title: `传好了 ${ok} 张` });
    setQueue((q) => q.filter((it) => it.state === "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSettled]);

  const addFiles = (files: FileList | File[]) => {
    const list = [...files];
    const items: QueueItem[] = [];
    for (const f of list) {
      const base = { key: `${f.name}-${f.size}-${Math.random()}`, file: f, progress: 0 };
      if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(f.type)) {
        items.push({ ...base, state: "error", error: /heic|heif/i.test(f.type + f.name) ? "415 格式不支持：HEIC 请先转成 JPEG" : "415 格式不支持：只收 JPEG、PNG、WebP、AVIF、GIF" });
      } else if (f.size > MAX_BYTES) {
        items.push({ ...base, state: "error", error: "413 文件太大：单张最大 95MB" });
      } else items.push({ ...base, state: "waiting" });
    }
    setQueue((q) => [...q.filter((it) => it.state !== "error"), ...items]);
  };

  const saveOrder = async (next: AdminImage[]) => {
    setImages(next);
    try {
      await api(`/api/admin/projects/${projectId}/images/order`, { method: "PUT", json: { order: next.map((i) => i.id) } });
    } catch (e) {
      toast.add({ title: "排序没保存", description: errMsg(e), variant: "error" });
      void reload();
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await api(`/api/admin/images/${deleting.id}`, { method: "DELETE" });
      toast.add({ title: `已删除 ${deleting.filename}` });
      setDeleting(null);
      await reload();
    } catch (e) {
      toast.add({ title: "删除失败", description: errMsg(e), variant: "error" });
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <div className="grid gap-5">
      <div
        onDragOver={(e) => {
          if (dragIdx !== null) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (dragIdx !== null) return;
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={`grid justify-items-center gap-3 rounded-xl border border-dashed p-8 text-center ${over ? "border-kumo-brand bg-kumo-tint" : "border-kumo-line bg-kumo-base"}`}
      >
        <ImagePlus size={28} className="text-kumo-subtle" />
        <div className="grid gap-1">
          <Text>把图片拖到这里，或者</Text>
          <Text variant="secondary" size="sm">JPEG、PNG、WebP、AVIF、GIF，单张最大 95MB。原图原样保存，预览图在浏览器里生成。</Text>
        </div>
        <Button variant="primary" icon={<Upload size={16} />} onClick={() => inputRef.current?.click()}>选择图片</Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 && (
        <div className="grid gap-2 rounded-xl bg-kumo-base p-4 ring ring-kumo-line">
          {queue.map((q) => (
            <div key={q.key} className="grid gap-1">
              <div className="flex items-center justify-between gap-2">
                <Text size="sm" truncate>{q.file.name}</Text>
                {q.state === "error" ? (
                  <Button variant="ghost" size="xs" shape="square" icon={<X size={14} />} aria-label="移除" onClick={() => setQueue((all) => all.filter((it) => it.key !== q.key))} />
                ) : null}
              </div>
              {q.state === "error" ? (
                <Text variant="error" size="sm">{q.error}</Text>
              ) : (
                <Meter
                  label={{ waiting: "排队中", preview: "生成预览图", uploading: "上传中", done: "完成" }[q.state]}
                  value={Math.round(q.progress * 100)}
                  showValue
                />
              )}
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && queue.length === 0 ? (
        <Empty icon={<ImagePlus size={32} />} title="还没有图片" description="传几张图，发布后访客就能看到马赛克预览。" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <ImageCard
              key={img.id}
              img={img}
              dragging={dragIdx === i}
              onDelete={() => setDeleting(img)}
              dragProps={{
                draggable: true,
                onDragStart: (e) => {
                  setDragIdx(i);
                  e.dataTransfer.effectAllowed = "move";
                },
                onDragOver: (e) => {
                  if (dragIdx === null || dragIdx === i) return;
                  e.preventDefault();
                  const next = [...images];
                  const [moved] = next.splice(dragIdx, 1);
                  next.splice(i, 0, moved!);
                  setImages(next);
                  setDragIdx(i);
                },
                onDragEnd: () => {
                  setDragIdx(null);
                  const changed = images.some((im, idx) => detail.images[idx]?.id !== im.id);
                  if (changed) void saveOrder(images);
                },
              }}
            />
          ))}
        </div>
      )}

      <Dialog.Root open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <Dialog size="base" className="px-6 py-5">
          <div className="grid gap-4">
            <Dialog.Title className="text-base font-semibold">删除这张图？</Dialog.Title>
            <Dialog.Description className="text-kumo-subtle">
              {deleting?.filename} 的原图、预览图和下载记录都会删掉，删了不能恢复。
            </Dialog.Description>
            <div className="flex justify-end gap-2">
              <Dialog.Close render={(p) => <Button {...p} variant="secondary">取消</Button>} />
              <Button variant="destructive" loading={busyDelete} onClick={confirmDelete}>删除</Button>
            </div>
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
