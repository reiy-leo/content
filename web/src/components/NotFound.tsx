import { Button, Empty } from "@cloudflare/kumo";
import { ImageOff } from "lucide-react";
import { navigate } from "../router.ts";
import { useI18n } from "../i18n/index.ts";

export function NotFound({ title, description }: { title?: string; description?: string }) {
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-xl px-5 py-24">
      <Empty
        icon={<ImageOff size={32} />}
        title={title ?? t.notFoundTitle}
        description={description ?? t.notFoundDesc}
        contents={<Button variant="secondary" onClick={() => navigate("/")}>{t.backHome}</Button>}
      />
    </main>
  );
}
