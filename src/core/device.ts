// =============================================================
// device.ts  【Core：端末の判定】
// -------------------------------------------------------------
// スマホ・タブレットは PC よりメモリが少なく、使いすぎると
// ブラウザがページを強制的に再読み込みしてしまう（iPhone の Safari で特に起きやすい）。
// 3D 描画などでメモリを多く使う処理は、ここの判定を見て控えめにする。
// =============================================================

/** スマホ・タブレット（iPhone / iPad / Android）か */
export const IS_MOBILE: boolean = (() => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(ua)) return true;
  // iPadOS の Safari は Mac と名乗るため、タッチ対応かどうかで見分ける
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
})();
