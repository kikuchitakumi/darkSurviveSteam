// =============================================================
// Random.ts  【Core：シード付き乱数】
// -------------------------------------------------------------
// ゲーム内の乱数は全てこのクラスを通す。
// シード（種）を固定すれば同じ展開を再現できるため、
//  - バグの再現
//  - 「シード共有」（配信者・SNS で同じ展開を遊べる＝流行りの要素）
//  - セーブ＆ロードでの乱数の一貫性
// が実現できる。アルゴリズムは高速で品質の良い mulberry32。
// =============================================================

export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** ランダムなシードを作る（新規ゲーム開始時） */
  static randomSeed(): number {
    return (Math.random() * 0xffffffff) >>> 0;
  }

  /** 現在の内部状態（セーブ用） */
  getState(): number {
    return this.state;
  }
  setState(s: number): void {
    this.state = s >>> 0;
  }

  /** 0以上1未満の乱数 */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** min以上max以下の整数 */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** 確率 p で true */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** 配列から1つ選ぶ */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** 重み付きで1つ選ぶ */
  weighted<T>(arr: readonly T[], weightOf: (x: T) => number): T {
    const total = arr.reduce((s, x) => s + Math.max(0, weightOf(x)), 0);
    let r = this.next() * total;
    for (const x of arr) {
      r -= Math.max(0, weightOf(x));
      if (r < 0) return x;
    }
    return arr[arr.length - 1];
  }

  /** 配列をシャッフルした新しい配列を返す（Fisher-Yates） */
  shuffle<T>(arr: readonly T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** 重複なしで n 個選ぶ */
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr).slice(0, n);
  }
}

/** シードを人が読みやすい文字列にする（例: "7F3A-21C9"） */
export function seedToString(seed: number): string {
  const h = (seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `${h.slice(0, 4)}-${h.slice(4)}`;
}
