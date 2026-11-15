// =============================================================
// GameState.ts  【Model：1回の冒険（ラン）の状態】
// -------------------------------------------------------------
// 主人公のステータス・所持金・デッキ・アイテム・装備・現在の階など、
// 「セーブすべき情報」を全てここで持つ。
//
//  - data（RunData）は JSON にそのまま保存できる単純なオブジェクト
//  - GameState クラスは data を操作する便利メソッドを提供する
//  - 画面（View）はこのクラスを読むだけで、直接書き換えない
//    （書き換えは Controller から行う）
// =============================================================
import { BALANCE } from '@/config/balance';
import { getEquipment } from '@/data/equipment';
import { Random } from '@/core/Random';
import { bus } from '@/core/EventBus';
import type { EquipSlot, KeyColor, RouteType, StatKey, Stats, StatusId } from './types';
import { STAT_KEYS } from './types';

/** デッキ内のカード1枚（同じカードを複数持てるので uid で区別する） */
export interface DeckCard {
  uid: string;
  cardId: string;
}

/** ランの統計（ゲームオーバー画面・実績用） */
export interface RunStats {
  battlesWon: number;
  enemiesKilled: number;
  damageDealt: number;
  maxHit: number;
  cardsPlayed: number;
  goldEarned: number;
  crits: number;
  bossesKilled: number;
}

/** セーブデータの本体 */
export interface RunData {
  version: 1;
  seed: number;
  rngState: number;
  floor: number;
  gold: number;
  level: number;
  exp: number;
  /** 未使用のステータスポイント */
  statPoints: number;
  /** 割り振り済みのステータス（装備補正を含まない） */
  baseStats: Stats;
  /** 才能が開花したステータス */
  talents: StatKey[];
  richTalent: boolean;
  hp: number;
  deck: DeckCard[];
  /** 消費アイテム（ID の配列） */
  items: string[];
  keys: Record<KeyColor, number>;
  equipment: Record<EquipSlot, string | null>;
  /** 現在の階の選択肢（再開時に同じものを出すため保存） */
  currentRoutes: RouteType[] | null;
  /** 選択済みの道（中断→再開時に同じ道から再開するため。セーブ＆ロードによるやり直し防止） */
  chosenRoute: RouteType | null;
  cardRemoveCount: number;
  uidCounter: number;
  stats: RunStats;
  startedAt: number;
}

export class GameState {
  /** ラン中の乱数（セーブ時に状態も保存する） */
  readonly rng: Random;

  constructor(public data: RunData) {
    this.rng = new Random(data.seed);
    this.rng.setState(data.rngState);
  }

  // ---------------------------------------------------------
  // 生成・保存
  // ---------------------------------------------------------
  /** 新しいランを作る（ステータス決定後に呼ばれる） */
  static create(seed: number, stats: Stats, talents: StatKey[], rich: boolean, deckIds: string[]): GameState {
    const data: RunData = {
      version: 1,
      seed,
      rngState: seed,
      floor: 1,
      gold: rich ? BALANCE.RICH_START_GOLD : BALANCE.START_GOLD,
      level: 1,
      exp: 0,
      statPoints: 0,
      baseStats: { ...stats },
      talents,
      richTalent: rich,
      hp: 0,
      deck: [],
      items: [],
      keys: { red: 0, blue: 0, yellow: 0, green: 0 },
      equipment: { weapon: null, armor: null, accessory: null },
      currentRoutes: null,
      chosenRoute: null,
      cardRemoveCount: 0,
      uidCounter: 0,
      stats: { battlesWon: 0, enemiesKilled: 0, damageDealt: 0, maxHit: 0, cardsPlayed: 0, goldEarned: 0, crits: 0, bossesKilled: 0 },
      startedAt: Date.now(),
    };
    const gs = new GameState(data);
    deckIds.forEach((id) => gs.addCard(id, true));
    data.hp = gs.maxHp;
    return gs;
  }

  /** セーブ用に乱数状態を書き戻した data を返す */
  serialize(): RunData {
    this.data.rngState = this.rng.getState();
    return JSON.parse(JSON.stringify(this.data));
  }

  /** 状態が変わったことを画面に知らせる */
  changed(): void {
    bus.emit('stateChanged');
  }

  // ---------------------------------------------------------
  // ステータス
  // ---------------------------------------------------------
  /** 装備補正込みの最終ステータス（0～99に収める） */
  get stats(): Stats {
    const s = { ...this.data.baseStats };
    for (const slot of ['weapon', 'armor', 'accessory'] as EquipSlot[]) {
      const id = this.data.equipment[slot];
      if (!id) continue;
      const eq = getEquipment(id);
      for (const k of STAT_KEYS) s[k] += eq.stats[k] ?? 0;
    }
    for (const k of STAT_KEYS) s[k] = Math.max(k === 'hp' ? 1 : 0, Math.min(BALANCE.STAT_MAX, s[k]));
    return s;
  }

  /** 装備による補正値だけを返す（画面表示用） */
  equipBonus(stat: StatKey): number {
    let b = 0;
    for (const slot of ['weapon', 'armor', 'accessory'] as EquipSlot[]) {
      const id = this.data.equipment[slot];
      if (id) b += getEquipment(id).stats[stat] ?? 0;
    }
    return b;
  }

  get maxHp(): number {
    return BALANCE.BASE_HP + this.stats.hp * BALANCE.HP_PER_POINT;
  }

  get hp(): number {
    return this.data.hp;
  }

  /** 最大AP（基本3 + 装備補正） */
  get maxAp(): number {
    let ap = BALANCE.BASE_AP;
    for (const slot of ['weapon', 'armor', 'accessory'] as EquipSlot[]) {
      const id = this.data.equipment[slot];
      if (id) ap += getEquipment(id).ap ?? 0;
    }
    return ap;
  }

  /** クリティカル率（運/99 × 50%） */
  get critRate(): number {
    return (this.stats.luk / BALANCE.STAT_MAX) * BALANCE.CRIT_MAX_RATE;
  }

  /** 回避率（運/99 × 50%） */
  get evadeRate(): number {
    return (this.stats.luk / BALANCE.STAT_MAX) * BALANCE.EVADE_MAX_RATE;
  }

  /** 装備品が戦闘開始時に与える状態 */
  get battleStartStatuses(): { status: StatusId; amount: number }[] {
    const list: { status: StatusId; amount: number }[] = [];
    for (const slot of ['weapon', 'armor', 'accessory'] as EquipSlot[]) {
      const id = this.data.equipment[slot];
      if (id) list.push(...(getEquipment(id).battleStartStatus ?? []));
    }
    return list;
  }

  // ---------------------------------------------------------
  // HP
  // ---------------------------------------------------------
  heal(amount: number): number {
    const before = this.data.hp;
    this.data.hp = Math.min(this.maxHp, this.data.hp + Math.max(0, Math.floor(amount)));
    this.changed();
    return this.data.hp - before;
  }

  damage(amount: number): number {
    const before = this.data.hp;
    this.data.hp = Math.max(0, this.data.hp - Math.max(0, Math.floor(amount)));
    this.changed();
    return before - this.data.hp;
  }

  setHp(hp: number): void {
    this.data.hp = Math.max(0, Math.min(this.maxHp, Math.floor(hp)));
    this.changed();
  }

  get isDead(): boolean {
    return this.data.hp <= 0;
  }

  // ---------------------------------------------------------
  // 所持金
  // ---------------------------------------------------------
  addGold(amount: number): void {
    this.data.gold += amount;
    if (amount > 0) this.data.stats.goldEarned += amount;
    this.changed();
  }

  spendGold(amount: number): boolean {
    if (this.data.gold < amount) return false;
    this.data.gold -= amount;
    this.changed();
    return true;
  }

  // ---------------------------------------------------------
  // 経験値・レベル
  // ---------------------------------------------------------
  /** 次のレベルまでに必要な経験値 */
  get expToNext(): number {
    return BALANCE.EXP_BASE + this.data.level * BALANCE.EXP_PER_LEVEL;
  }

  /**
   * 経験値を得る。
   * @returns 上がったレベルの一覧（例: [2,3]）。ステータスポイントは自動で加算される。
   */
  addExp(amount: number): number[] {
    const gained: number[] = [];
    this.data.exp += Math.floor(amount);
    while (this.data.exp >= this.expToNext) {
      this.data.exp -= this.expToNext;
      this.data.level += 1;
      this.data.statPoints += BALANCE.statPointsForLevel(this.data.level);
      gained.push(this.data.level);
    }
    this.changed();
    return gained;
  }

  /**
   * ステータスポイントを割り振る（レベルアップ画面から呼ばれる）
   * HP を上げた場合は最大HPが増えた分、現在HPも増える。
   */
  allocate(alloc: Partial<Stats>): void {
    let used = 0;
    const oldMax = this.maxHp;
    for (const k of STAT_KEYS) {
      const v = Math.max(0, alloc[k] ?? 0);
      const room = BALANCE.STAT_MAX - this.data.baseStats[k];
      const add = Math.min(v, room);
      this.data.baseStats[k] += add;
      used += add;
    }
    this.data.statPoints = Math.max(0, this.data.statPoints - used);
    const diff = this.maxHp - oldMax;
    if (diff > 0) this.data.hp += diff;
    this.changed();
  }

  /** イベント等でステータスを直接増減する */
  addBaseStat(stat: StatKey, amount: number): void {
    const oldMax = this.maxHp;
    this.data.baseStats[stat] = Math.max(stat === 'hp' ? 1 : 0, Math.min(BALANCE.STAT_MAX, this.data.baseStats[stat] + amount));
    const diff = this.maxHp - oldMax;
    if (diff > 0) this.data.hp += diff;
    this.data.hp = Math.min(this.data.hp, this.maxHp);
    this.changed();
  }

  // ---------------------------------------------------------
  // デッキ
  // ---------------------------------------------------------
  addCard(cardId: string, silent = false): DeckCard {
    const card = { uid: `c${++this.data.uidCounter}`, cardId };
    this.data.deck.push(card);
    if (!silent) this.changed();
    return card;
  }

  removeCard(uid: string): void {
    this.data.deck = this.data.deck.filter((c) => c.uid !== uid);
    this.changed();
  }

  // ---------------------------------------------------------
  // アイテム・鍵
  // ---------------------------------------------------------
  get itemSlotsFree(): number {
    return BALANCE.ITEM_SLOTS - this.data.items.length;
  }

  /** アイテムを得る。枠がいっぱいなら false */
  addItem(itemId: string): boolean {
    if (this.itemSlotsFree <= 0) return false;
    this.data.items.push(itemId);
    this.changed();
    return true;
  }

  removeItemAt(index: number): string | undefined {
    const [id] = this.data.items.splice(index, 1);
    this.changed();
    return id;
  }

  addKey(color: KeyColor, n = 1): void {
    this.data.keys[color] += n;
    this.changed();
  }

  useKey(color: KeyColor): boolean {
    if (this.data.keys[color] <= 0) return false;
    this.data.keys[color] -= 1;
    this.changed();
    return true;
  }

  get totalKeys(): number {
    return Object.values(this.data.keys).reduce((a, b) => a + b, 0);
  }

  // ---------------------------------------------------------
  // 装備
  // ---------------------------------------------------------
  /** 装備する。外れた装備の ID を返す（無ければ null） */
  equip(equipmentId: string): string | null {
    const def = getEquipment(equipmentId);
    const old = this.data.equipment[def.slot];
    const oldMax = this.maxHp;
    this.data.equipment[def.slot] = equipmentId;
    // 最大HPが増えたら現在HPも増やす。減ったら上限に合わせる。
    const diff = this.maxHp - oldMax;
    if (diff > 0) this.data.hp += diff;
    this.data.hp = Math.min(this.data.hp, this.maxHp);
    this.changed();
    return old;
  }

  // ---------------------------------------------------------
  // 階
  // ---------------------------------------------------------
  /** 次の階へ進む */
  advanceFloor(): void {
    this.data.floor += 1;
    this.data.currentRoutes = null;
    this.data.chosenRoute = null;
    this.changed();
  }
}
