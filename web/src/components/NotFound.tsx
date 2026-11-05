import { Button, Empty } from "@cloudflare/kumo";
import { ImageOff } from "lucide-react";
import { navigate } from "../router.ts";

export function NotFound({ title = "404 找不到这个页面", description = "链接可能写错了，或者项目还没发布。" }: { title?: string; description?: string }) {
  return (
    <main className="mx-auto max-w-xl px-5 py-24">
      <Empty
        icon={<ImageOff size={32} />}
        title={title}
        description={description}
        contents={<Button variant="secondary" onClick={() => navigate("/")}>回首页</Button>}
      />
    </main>
  );
}
