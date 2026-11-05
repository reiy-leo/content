// 首页：一句说明 + 后台入口，不列项目。
import { Button, Text } from "@cloudflare/kumo";
import { Grid3x3, KeyRound, Download } from "lucide-react";
import { navigate } from "../router.ts";

const STEPS = [
  { icon: Grid3x3, title: "先看马赛克预览", body: "打开别人发给你的项目链接，所有图片都打了马赛克。" },
  { icon: KeyRound, title: "填获取码", body: "在项目页填入获取码，就能看到每张图的下载按钮。" },
  { icon: Download, title: "下载原图", body: "每个码每张图只能下一次，下过的图会换成清晰缩略图。" },
];

export function HomePage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-5 py-20">
      <div className="grid gap-3">
        <Text variant="heading" as="h1" size="lg">原图获取</Text>
        <Text variant="secondary">这里放 Rei 分享的图片集。项目只能通过链接打开，没有公开列表。</Text>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.title} className="grid content-start gap-2 rounded-xl bg-kumo-base p-5 ring ring-kumo-line">
            <span className="flex size-9 items-center justify-center rounded-lg bg-kumo-recessed">
              <s.icon size={18} />
            </span>
            <Text variant="heading" as="h2">{s.title}</Text>
            <Text variant="secondary">{s.body}</Text>
          </div>
        ))}
      </div>
      <div>
        <Button variant="secondary" onClick={() => navigate("/admin")}>进入后台</Button>
      </div>
    </main>
  );
}
