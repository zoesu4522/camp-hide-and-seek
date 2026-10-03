/**
 * 在手機端先壓縮照片再上傳：最長邊 maxSize、JPEG。
 * 現場網路不穩，原圖 3～8MB 太大；壓縮後通常 100～250KB。
 * 會依 EXIF 方向轉正（createImageBitmap imageOrientation: from-image）。
 */
export async function compressImage(file: Blob, maxSize = 1280, quality = 0.78): Promise<Blob> {
  const source = await loadBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas not supported");
  ctx.drawImage(source.image, 0, 0, w, h);
  source.close?.();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("compress failed");
  return blob;
}

interface LoadedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

async function loadBitmap(file: Blob): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { image: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* 退回 <img> 解碼 */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { image: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
