"use client";

import { planVerticalTiles } from "@/lib/import/imageImport";

/**
 * 浏览器端：把一张图片缩放（宽不超过 MAX_WIDTH，普通照片长边不超过 MAX_LONG_SIDE）并转成 JPEG data URL。
 * 长截图（很高）按竖向切片，每片最高 2000 px，相邻重叠，保证文字清晰。
 */
const MAX_WIDTH = 1280;
const MAX_LONG_SIDE = 2000;
const JPEG_QUALITY = 0.75;

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // decode 完成后图片已在内存，可释放 URL
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export async function compressImageForImport(file: File): Promise<string[]> {
  const img = await loadImage(file);
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (!w0 || !h0) throw new Error("无法读取图片");

  const isLongScreenshot = h0 / w0 > 2.5;
  let scale = Math.min(1, MAX_WIDTH / w0);
  if (!isLongScreenshot) scale = Math.min(scale, MAX_LONG_SIDE / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const tiles = isLongScreenshot ? planVerticalTiles(h) : [{ y: 0, h }];
  const out: string[] = [];
  for (const t of tiles) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = t.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器不支持图片处理");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, t.h);
    // 源图坐标 = 目标坐标 / scale
    ctx.drawImage(img, 0, t.y / scale, w0, t.h / scale, 0, 0, w, t.h);
    out.push(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
  }
  return out;
}
