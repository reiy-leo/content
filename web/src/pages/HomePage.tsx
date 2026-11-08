// 首页：一句说明 + 后台入口，不列项目。
import { Button, Text } from "@cloudflare/kumo";
import { Grid3x3, KeyRound, Download } from "lucide-react";
import { navigate } from "../router.ts";
import { useI18n } from "../i18n/index.ts";

export function HomePage() {
  const { t } = useI18n();
  const steps = [
    { icon: Grid3x3, title: t.homeStep1Title, body: t.homeStep1Body },
    { icon: KeyRound, title: t.homeStep2Title, body: t.homeStep2Body },
    { icon: Download, title: t.homeStep3Title, body: t.homeStep3Body },
  ];
  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-5 py-20">
      <div className="grid gap-3">
        <Text variant="heading" as="h1" size="lg">{t.appName}</Text>
        <Text variant="secondary">{t.homeIntro}</Text>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div key={i} className="grid content-start gap-2 rounded-xl bg-kumo-base p-5 ring ring-kumo-line">
            <span className="flex size-9 items-center justify-center rounded-lg bg-kumo-recessed">
              <s.icon size={18} />
            </span>
            <Text variant="heading" as="h2">{s.title}</Text>
            <Text variant="secondary">{s.body}</Text>
          </div>
        ))}
      </div>
      <div>
        <Button variant="secondary" onClick={() => navigate("/admin")}>{t.homeEnterAdmin}</Button>
      </div>
    </main>
  );
}
