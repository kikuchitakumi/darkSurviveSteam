// =============================================================
// balance.ts
// -------------------------------------------------------------
// ゲームバランスに関わる数値を「全て」ここに集約している。
// 難易度調整をしたい時はまずこのファイルだけを見ればよい。
// =============================================================

export const BALANCE = {
  // ---------------------------------------------------------
  // 塔の構成
  // ---------------------------------------------------------
  /** 最上階（ここのボスを倒すとクリア） */
  MAX_FLOOR: 100,
  /** ボスが出現する間隔（10F, 20F, ...） */
  BOSS_INTERVAL: 10,
  /** 背景が切り替わる間隔（20Fごとにゾーンが変わる） */
  ZONE_SIZE: 20,

  // ---------------------------------------------------------
  // 主人公ステータス
  // ---------------------------------------------------------
  /** 各ステータスの上限 */
  STAT_MAX: 99,
  /** 初期ステータスのランダム範囲（1～5） */
  STAT_ROLL_MIN: 1,
  STAT_ROLL_MAX: 5,
  /** 「才能」が開花する確率（ステータス1つごと） */
  TALENT_CHANCE: 0.03,
  /** 才能開花時の値の範囲 */
  TALENT_ROLL_MIN: 8,
  TALENT_ROLL_MAX: 12,
  /** 振り直しできる回数（最初の1回のみ） */
  STAT_REROLLS: 1,
  /** 初期所持金 */
  START_GOLD: 100,
  /** 金持ちの才能（1%）が覚醒した時の初期所持金 */
  RICH_TALENT_CHANCE: 0.01,
  RICH_START_GOLD: 1000,

  /**
   * 最大HP = BASE_HP + 体力ステータス × HP_PER_POINT
   * （体力ステータス自体の上限は 99。体力3なら最大HP 20+30=50）
   * BASE_HP は「体力1」でも即死しないための底上げ。
   */
  BASE_HP: 20,
  HP_PER_POINT: 10,

  /** AP（アクションポイント）の初期値（固定） */
  BASE_AP: 3,
  /** 1ターンに引くカード枚数 */
  HAND_DRAW: 5,
  /** 手札上限 */
  HAND_LIMIT: 10,
  /** 消費アイテムの所持上限 */
  ITEM_SLOTS: 5,

  /**
   * 運によるクリティカル率：運 / 99 × 50%（最大50%）
   * クリティカル時のダメージ倍率は 3倍
   */
  CRIT_MAX_RATE: 0.5,
  CRIT_MULTIPLIER: 3,
  /** 運による回避率：運 / 99 × 50%（最大50%） */
  EVADE_MAX_RATE: 0.5,

  // ---------------------------------------------------------
  // 状態異常の倍率
  // ---------------------------------------------------------
  WEAK_MULTIPLIER: 0.75, // 衰弱：与ダメージ -25%
  VULNERABLE_MULTIPLIER: 1.5, // 脆弱：被ダメージ +50%
  FRAIL_MULTIPLIER: 0.75, // 萎縮：獲得ブロック -25%

  // ---------------------------------------------------------
  // レベル・経験値
  // ---------------------------------------------------------
  /** 次のレベルまでに必要な経験値 = EXP_BASE + レベル × EXP_PER_LEVEL */
  EXP_BASE: 8,
  EXP_PER_LEVEL: 4,
  /** レベルアップ時のステータスポイント（レベル帯ごと） */
  statPointsForLevel(newLevel: number): number {
    let p = 2;
    if (newLevel >= 50) p = 5;
    else if (newLevel >= 40) p = 4;
    else if (newLevel >= 20) p = 3;
    // レベル10刻みのボーナス
    if (newLevel % 10 === 0) p += 5;
    return p;
  },

  // ---------------------------------------------------------
  // 敵の強さ
  // ---------------------------------------------------------
  /** 敵のHP倍率 = 1 + (階 - 1) × ENEMY_HP_SCALE_PER_FLOOR */
  ENEMY_HP_SCALE_PER_FLOOR: 0.09,
  /** 敵の攻撃・ブロック倍率 = 1 + (階 - 1) × ENEMY_DMG_SCALE_PER_FLOOR */
  ENEMY_DMG_SCALE_PER_FLOOR: 0.06,
  /**
   * 強敵（危険）は通常の何倍か（仕様：そのフロアの敵の倍の強さ）
   * HP は2倍、攻撃・ブロックは1.5倍にして「総合的に約2倍の強さ」に調整。
   */
  ELITE_HP_MULTIPLIER: 2.0,
  ELITE_DMG_MULTIPLIER: 1.5,
  /** 敵の最大数 */
  MAX_ENEMIES: 3,

  // ---------------------------------------------------------
  // 報酬
  // ---------------------------------------------------------
  rewardGold(floor: number, kind: 'normal' | 'elite' | 'boss'): [number, number] {
    const base = 10 + floor * 1.5;
    const m = kind === 'boss' ? 5 : kind === 'elite' ? 2.2 : 1;
    return [Math.floor(base * m * 0.8), Math.floor(base * m * 1.2)];
  },
  rewardExp(floor: number, kind: 'normal' | 'elite' | 'boss'): number {
    const base = 5 + floor * 0.8;
    const m = kind === 'boss' ? 6 : kind === 'elite' ? 2.5 : 1;
    return Math.floor(base * m);
  },
  /** カード報酬の選択肢数 */
  CARD_REWARD_CHOICES: 3,
  /** 強敵撃破時のドロップ率 */
  ELITE_ITEM_DROP: 0.5,
  ELITE_EQUIP_DROP: 0.35,
  ELITE_KEY_DROP: 0.3,
  /** 通常戦闘のドロップ率 */
  NORMAL_ITEM_DROP: 0.15,
  NORMAL_KEY_DROP: 0.05,
  /** ボス撃破後にHP全回復するか */
  BOSS_FULL_HEAL: true,

  // ---------------------------------------------------------
  // マップ（2F以降の選択肢）
  // ---------------------------------------------------------
  /** 選択肢の出現重み */
  ROUTE_WEIGHTS: { battle: 50, elite: 15, event: 20, shop: 15 },
  /** 強敵が出現し始める階 */
  ELITE_MIN_FLOOR: 5,
  /** 鍵を持っている時に「隠し通路」が追加で出現する確率 */
  HIDDEN_PASSAGE_CHANCE: 0.12,

  // ---------------------------------------------------------
  // ショップ
  // ---------------------------------------------------------
  /** 闇商人が出現する確率 */
  DARK_MERCHANT_CHANCE: 0.2,
  /** 階が上がるほど値段も上がる：価格 × (1 + 階 × SHOP_PRICE_PER_FLOOR) */
  SHOP_PRICE_PER_FLOOR: 0.01,
  /** カード削除サービスの基本価格と増分 */
  CARD_REMOVE_BASE: 50,
  CARD_REMOVE_STEP: 25,
  /** 闇商人の価格倍率 */
  DARK_PRICE_MULTIPLIER: 1.5,
} as const;

/** 階数からゾーン番号（1～5）を求める */
export function zoneOfFloor(floor: number): number {
  return Math.min(5, Math.max(1, Math.ceil(floor / BALANCE.ZONE_SIZE)));
}

/** 階数から敵のHP倍率を求める */
export function enemyHpScale(floor: number): number {
  return 1 + (floor - 1) * BALANCE.ENEMY_HP_SCALE_PER_FLOOR;
}

/** 階数から敵の攻撃・ブロック倍率を求める */
export function enemyDmgScale(floor: number): number {
  return 1 + (floor - 1) * BALANCE.ENEMY_DMG_SCALE_PER_FLOOR;
}
