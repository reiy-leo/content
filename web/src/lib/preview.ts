// 在浏览器里生成马赛克图和缩略图（Worker 不做图片处理）。
// 马赛克：长边缩到 24 格，再不平滑地放大到长边 960px，只看得出构图和颜色。
// 缩略图：长边 480px，清晰，只给下过这张图的获取码看。
import { getT } from "../i18n/index.ts";

export const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";
const MOSAIC_CELLS = 24;
const MOSAIC_SIZE = 960;
const THUMB_SIZE = 480;

export interface Previews { width: number; height: number; mosaic: Blob; thumb: Blob }

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error(getT().previewNoCanvas);
  return { c, ctx };
}

function toBlob(c: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error(getT().previewFailed))), "image/webp", quality),
  );
}

const fit = (w: number, h: number, long: number) => {
  const s = Math.min(1, long / Math.max(w, h));
  return { w: w * s, h: h * s };
};

export async function makePreviews(file: File): Promise<Previews> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error(/heic|heif/i.test(file.type + file.name) ? getT().previewHeic : getT().previewCannotOpen);
  }
  const { width, height } = bmp;
  try {
    // 缩略图
    const t = fit(width, height, THUMB_SIZE);
    const th = canvas(t.w, t.h);
    th.ctx.imageSmoothingQuality = "high";
    th.ctx.drawImage(bmp, 0, 0, th.c.width, th.c.height);
    const thumb = await toBlob(th.c, 0.8);

    // 马赛克：先缩成小格子，再关掉平滑放大
    const scale = MOSAIC_CELLS / Math.max(width, height);
    const small = canvas(width * scale, height * scale);
    small.ctx.imageSmoothingQuality = "high";
    small.ctx.drawImage(bmp, 0, 0, small.c.width, small.c.height);
    const big = fit(width, height, MOSAIC_SIZE);
    const mz = canvas(big.w, big.h);
    mz.ctx.imageSmoothingEnabled = false;
    mz.ctx.drawImage(small.c, 0, 0, mz.c.width, mz.c.height);
    const mosaic = await toBlob(mz.c, 0.85);
    return { width, height, mosaic, thumb };
  } finally {
    bmp.close();
  }
}
