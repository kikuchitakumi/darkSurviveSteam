// =============================================================
// imageTools.ts  【開発メニュー：画像の取り込み】
// -------------------------------------------------------------
// アップロードされた画像を、用途に合った大きさに縮小して WebP に変換する。
// （PNG のままだと重く、Firebase の容量・読み込み時間を圧迫するため）
// WebP は透過も保てるので、敵・キャラクターの透過画像もそのまま使える。
// =============================================================

/** 用途ごとの最大サイズ */
export const IMAGE_LIMITS = {
  card: { w: 960, h: 900 },
  enemy: { w: 1200, h: 1280 },
  background: { w: 1920, h: 1080 },
  character: { w: 1200, h: 1400 },
} as const;

export type ImageUse = keyof typeof IMAGE_LIMITS;

/** File → 縮小した WebP の Blob */
export async function prepareImage(file: File, use: ImageUse): Promise<Blob> {
  const limit = IMAGE_LIMITS[use];
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, limit.w / bmp.width, limit.h / bmp.height);
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を変換できませんでした'))), 'image/webp', 0.9));
}
