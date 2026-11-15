// =============================================================
// types.ts  【Model】
// -------------------------------------------------------------
// ゲーム全体で使う「型（データの形）」の定義ファイル。
// data/ フォルダのカード・敵・アイテム等は全てここで定義した型に従う。
// 新しい効果の種類を追加したい時は、まずここに型を足し、
// model/Combat.ts の処理を追加する、という流れになる。
// =============================================================

/** ステータスの種類（AP以外） */
export type StatKey = 'hp' | 'atk' | 'def' | 'mag' | 'luk';
export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'mag', 'luk'];

/** ステータス値の集合 */
export type Stats = Record<StatKey, number>;

/** 鍵の色（宝物庫の宝箱に対応） */
export type KeyColor = 'red' | 'blue' | 'yellow' | 'green';
export const KEY_COLORS: KeyColor[] = ['red', 'blue', 'yellow', 'green'];

/** レア度 */
export type Rarity = 'basic' | 'common' | 'rare' | 'legendary';

// -------------------------------------------------------------
// 状態異常（バフ・デバフ）
// -------------------------------------------------------------
export type StatusId =
  | 'strength' // 筋力：攻撃ダメージ +N（戦闘中ずっと）
  | 'turnStrength' // 奮起：このターンだけ攻撃ダメージ +N
  | 'dexterity' // 敏捷：獲得ブロック +N
  | 'weak' // 衰弱：与ダメージ -25%
  | 'vulnerable' // 脆弱：被ダメージ +50%
  | 'frail' // 萎縮：獲得ブロック -25%
  | 'poison' // 毒：ターン開始時にN ダメージ、Nは1減る
  | 'stun' // 封印：次の行動ができない
  | 'stunResist' // 封印耐性：封印を受け付けない
  | 'regen' // 再生：ターン終了時にN回復
  | 'thorns'; // 棘：攻撃を受けるとNダメージを返す

// -------------------------------------------------------------
// カード
// -------------------------------------------------------------
/** カードの種類（仕様書の5種類） */
export type CardType = 'attack' | 'debuff' | 'buff' | 'defense' | 'special';

/** カードの対象 */
export type CardTarget = 'enemy' | 'allEnemies' | 'self' | 'none';

/**
 * カード/アイテムの効果。
 * 「何をするか」を小さな部品として並べることで、新しいカードを
 * プログラムを書かずにデータだけで追加できるようにしている。
 */
export type Effect =
  /** ダメージ：amount + 攻撃力(または魔力) を hits 回 */
  | { kind: 'damage'; amount: number; hits?: number; scale?: 'atk' | 'mag' | 'none'; target?: 'target' | 'all' | 'random' }
  /** ブロック獲得：amount + 防御力 */
  | { kind: 'block'; amount: number; scale?: 'def' | 'mag' | 'none' }
  /** 状態異常を付与 */
  | { kind: 'status'; status: StatusId; amount: number; target?: 'target' | 'self' | 'all' }
  /** カードを引く */
  | { kind: 'draw'; amount: number }
  /** 手札から選んで廃棄（プレイヤーに選ばせる） */
  | { kind: 'exhaustChoice'; amount: number }
  /** AP を得る */
  | { kind: 'gainAp'; amount: number }
  /** HP 回復：amount + 魔力（scale指定時） */
  | { kind: 'heal'; amount: number; scale?: 'mag' | 'none' }
  /** 敵の「次の行動」を封じる（＝封印状態を付与。耐性付き） */
  | { kind: 'stun'; target?: 'target' | 'all' }
  /** 最大HPの割合で回復 */
  | { kind: 'healPercent'; percent: number };

/** カード定義（data/cards.ts に並べる） */
export interface CardDef {
  /** 一意なID（英数字）。セーブデータにも使うので変更しないこと */
  id: string;
  /** カード名（日本語。英語は i18n/en.ts の card.<id>.name で上書き） */
  name: string;
  /**
   * 説明文。{damage} {block} {heal} {hits} {amount} は実際の数値に置き換わる。
   */
  description: string;
  type: CardType;
  rarity: Rarity;
  /** 消費AP */
  cost: number;
  target: CardTarget;
  effects: Effect[];
  /** true: 使用後に廃棄（この戦闘中デッキから除外） */
  exhaust?: boolean;
  /** カードイラストの画像パス（assets/ からの相対） */
  image: string;
  /** 基本価格（ショップ） */
  price: number;
  /**
   * 入手できる場所。
   *  starter: 初期デッキ / reward: 戦闘報酬・宝箱 / shop: 通常ショップ / dark: 闇商人
   */
  pools: Array<'starter' | 'reward' | 'shop' | 'dark'>;
}

// -------------------------------------------------------------
// アイテム（消費アイテム）・鍵
// -------------------------------------------------------------
export interface ItemDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  /** battle: 戦闘中のみ使用可 / anytime: いつでも使用可 */
  usable: 'battle' | 'anytime';
  /** 対象を選ぶ必要があるか */
  target: CardTarget;
  effects: Effect[];
  image: string;
  price: number;
  pools: Array<'shop' | 'dark' | 'drop' | 'treasure'>;
}

// -------------------------------------------------------------
// 装備品
// -------------------------------------------------------------
export type EquipSlot = 'weapon' | 'armor' | 'accessory';

export interface EquipmentDef {
  id: string;
  name: string;
  description: string;
  slot: EquipSlot;
  rarity: Rarity;
  /** ステータス補正 */
  stats: Partial<Stats>;
  /** AP 補正（最大AP が増える） */
  ap?: number;
  /** 戦闘開始時に得る状態（例：筋力+1） */
  battleStartStatus?: { status: StatusId; amount: number }[];
  image: string;
  price: number;
  pools: Array<'shop' | 'dark' | 'drop' | 'treasure'>;
}

// -------------------------------------------------------------
// 敵
// -------------------------------------------------------------
/** 敵の行動の種類（仕様書の5種類）＝「意図」アイコンの種類 */
export type IntentType = 'attack' | 'debuff' | 'buff' | 'block' | 'special';

/** 敵の行動の効果 */
export type EnemyEffect =
  | { kind: 'attack'; amount: number; hits?: number }
  | { kind: 'block'; amount: number; target?: 'self' | 'allAllies' }
  | { kind: 'status'; status: StatusId; amount: number; target: 'player' | 'self' | 'allAllies' }
  | { kind: 'heal'; amount: number; target?: 'self' | 'allAllies' }
  | { kind: 'summon'; enemyId: string };

export interface EnemyActionDef {
  id: string;
  /** 行動名（意図のツールチップに表示） */
  name: string;
  intent: IntentType;
  effects: EnemyEffect[];
  /** pattern = 'random' の時の重み */
  weight?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  description: string;
  kind: 'normal' | 'elite' | 'boss';
  /** 出現ゾーン（1:1-20F, 2:21-40F ...）。ボスは floor を使う */
  zones: number[];
  /** ボスの場合の出現階 */
  bossFloor?: number;
  /** 1F 時点での HP（階が上がると倍率がかかる） */
  hp: number;
  /** 行動パターン：cycle=順番に / random=重み付きランダム */
  pattern: 'cycle' | 'random';
  actions: EnemyActionDef[];
  /** 戦闘開始時の状態 */
  startStatus?: { status: StatusId; amount: number }[];
  /** 封印を無効化する */
  stunImmune?: boolean;
  image: string;
  /** 画面上の表示サイズ倍率（1 = 標準） */
  scale?: number;
}

// -------------------------------------------------------------
// イベント
// -------------------------------------------------------------
export type EventOutcome =
  | { kind: 'gold'; amount: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'damage'; amount: number }
  | { kind: 'exp'; amount: number }
  | { kind: 'card'; cardId: string }
  | { kind: 'randomCard' }
  | { kind: 'item'; itemId: string }
  | { kind: 'key'; color: KeyColor | 'random' }
  | { kind: 'equipment'; equipmentId: string }
  | { kind: 'stat'; stat: StatKey; amount: number }
  | { kind: 'battle'; elite?: boolean }
  | { kind: 'nothing' };

export interface EventChoiceDef {
  /** ボタンに表示する文言 */
  label: string;
  /**
   * 運判定（任意）。成功率 = base + 運 × perLuck（最大 max）
   * 成功時 success、失敗時 failure の結果になる。
   */
  luckCheck?: { base: number; perLuck: number; max?: number };
  success: { text: string; outcomes: EventOutcome[] };
  failure?: { text: string; outcomes: EventOutcome[] };
  /** 選択に必要な条件（例：所持金） */
  requireGold?: number;
}

export interface EventDef {
  id: string;
  title: string;
  /** 本文（1要素 = メッセージウィンドウ1ページ） */
  text: string[];
  /** 背景画像 */
  background: string;
  /** 背景の上に表示する透過画像（任意） */
  object?: string;
  choices: EventChoiceDef[];
  /** 出現の重み / 出現階の範囲 */
  weight: number;
  minFloor?: number;
  maxFloor?: number;
  /** false にすると出現しない（作りかけのイベント用） */
  enabled: boolean;
}

// -------------------------------------------------------------
// 宝箱
// -------------------------------------------------------------
export type TreasureContent =
  | { kind: 'gold'; min: number; max: number }
  | { kind: 'randomEquipment'; slot?: EquipSlot; minRarity?: Rarity }
  | { kind: 'randomItem'; count: number }
  | { kind: 'randomCard' }
  | { kind: 'stat'; amount: number };

export interface TreasureChestDef {
  color: KeyColor;
  name: string;
  image: string;
  /** 箱を開けた時に得られるもの（全て得る） */
  contents: TreasureContent[];
}

// -------------------------------------------------------------
// マップ（2F以降の選択肢）
// -------------------------------------------------------------
export type RouteType = 'battle' | 'elite' | 'event' | 'shop' | 'boss' | 'hidden';
