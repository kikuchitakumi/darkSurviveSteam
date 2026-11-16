// =============================================================
// frameBudget.ts  【3D：重い時に自動で描画解像度を下げる】
// -------------------------------------------------------------
// 毎フレーム tick() を呼ぶと、直近のフレーム間隔の平均を見て
// 「重い（だいたい 45fps を下回っている）」と判断した時に true を返す。
// 呼び出し側はそのたびに解像度を一段下げる（下げるだけで、上げ直しはしない）。
// 性能の低い PC でも、戦闘がカクカクし続けないようにするための仕組み。
// =============================================================
export class FrameBudget {
  private sum = 0;
  private count = 0;
  private last = 0;
  /** 解像度を変えた直後は、落ち着くまで判定しない */
  private coolUntil = 0;

  constructor(private limitMs = 22, private samples = 90) {
    // 画面を開いた直後（読み込みや演出で一瞬重い）は判定しない
    this.coolUntil = performance.now() + 2500;
  }

  tick(now: number): boolean {
    if (this.last) {
      const d = now - this.last;
      // タブを切り替えていた等の極端な間隔は数えない
      if (d < 250) {
        this.sum += d;
        this.count++;
      }
    }
    this.last = now;
    if (now < this.coolUntil) {
      this.sum = 0;
      this.count = 0;
      return false;
    }
    if (this.count < this.samples) return false;
    const avg = this.sum / this.count;
    this.sum = 0;
    this.count = 0;
    if (avg <= this.limitMs) return false;
    this.coolUntil = now + 1500;
    return true;
  }
}
