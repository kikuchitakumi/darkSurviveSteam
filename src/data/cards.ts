// =============================================================
// cards.ts  【データ：カード】
// -------------------------------------------------------------
// ★カードを追加したい時はこのファイルに1件追加するだけでよい。
//
//  - id        : 半角英数字の一意なID（セーブデータで使用、後から変更しない）
//  - name      : カード名（日本語）。英語は i18n/en.ts の card.<id>.name
//  - description : 説明文。{damage} {block} {heal} {hits} は実数値に置換される
//  - type      : attack(攻撃) / debuff(デバフ) / buff(バフ) / defense(防御) / special(その他)
//  - cost      : 消費AP
//  - target    : enemy(敵1体を選ぶ) / allEnemies(敵全体) / self(自分) / none
//  - effects   : 効果の部品の並び（model/types.ts の Effect を参照）
//  - pools     : 入手場所 starter / reward / shop / dark
//  - image     : カードイラスト（public/assets/ からの相対パス）
//
// 仕様書の指示により、現時点で「報酬・宝箱・通常ショップ」から出るカードは
// 初期デッキの5種類のみ。闇商人専用の強力カード（pools: ['dark']）は
// 追加カードのサンプルとして用意している。
// =============================================================
import type { CardDef } from '@/model/types';

export const CARDS: CardDef[] = [
  // ---------------------------------------------------------
  // 初期デッキのカード（5種類）
  // ---------------------------------------------------------
  {
    id: 'strike',
    name: '斬りつけ',
    description: '敵に {damage} ダメージを与える。',
    type: 'attack',
    rarity: 'basic',
    cost: 1,
    target: 'enemy',
    effects: [{ kind: 'damage', amount: 1, scale: 'atk' }],
    image: 'images/cards/card_strike.png',
    price: 40,
    pools: ['starter', 'reward', 'shop'],
  },
  {
    id: 'defend',
    name: '身構える',
    description: '{block} ブロックを得る。',
    type: 'defense',
    rarity: 'basic',
    cost: 1,
    target: 'self',
    effects: [{ kind: 'block', amount: 1, scale: 'def' }],
    image: 'images/cards/card_defend.png',
    price: 40,
    pools: ['starter', 'reward', 'shop'],
  },
  {
    id: 'seal',
    name: '封印の札',
    description: '敵の行動を1ターン封じる。',
    type: 'debuff',
    rarity: 'basic',
    cost: 1,
    target: 'enemy',
    effects: [{ kind: 'stun', target: 'target' }],
    image: 'images/cards/card_seal.png',
    price: 60,
    pools: ['starter', 'reward', 'shop'],
  },
  {
    id: 'rage',
    name: '奮起',
    description: 'このターン、自分の攻撃力を +5 する。',
    type: 'buff',
    rarity: 'basic',
    cost: 1,
    target: 'self',
    effects: [{ kind: 'status', status: 'turnStrength', amount: 5, target: 'self' }],
    image: 'images/cards/card_rage.png',
    price: 50,
    pools: ['starter', 'reward', 'shop'],
  },
  {
    id: 'scavenge',
    name: '取捨選択',
    description: '手札のカードを1枚選んで廃棄する。\nカードを2枚引く。',
    type: 'special',
    rarity: 'basic',
    cost: 1,
    target: 'none',
    effects: [
      { kind: 'exhaustChoice', amount: 1 },
      { kind: 'draw', amount: 2 },
    ],
    image: 'images/cards/card_scavenge.png',
    price: 50,
    pools: ['starter', 'reward', 'shop'],
  },

  // ---------------------------------------------------------
  // 闇商人専用カード（追加カードのサンプル）
  // 報酬にも出したくなったら pools に 'reward' を追加するだけ。
  // ---------------------------------------------------------
  {
    id: 'executioner',
    name: '処刑斬り',
    description: '敵に {damage} ダメージを与える。',
    type: 'attack',
    rarity: 'rare',
    cost: 2,
    target: 'enemy',
    effects: [{ kind: 'damage', amount: 12, scale: 'atk' }],
    image: 'images/cards/card_executioner.png',
    price: 120,
    pools: ['dark'],
  },
  {
    id: 'flurry',
    name: '狂乱の連撃',
    description: '敵に {damage} ダメージを {hits} 回与える。',
    type: 'attack',
    rarity: 'rare',
    cost: 1,
    target: 'enemy',
    effects: [{ kind: 'damage', amount: 0, hits: 3, scale: 'atk' }],
    image: 'images/cards/card_flurry.png',
    price: 140,
    pools: ['dark'],
  },
  {
    id: 'shotgun',
    name: '散弾',
    description: '敵全体に {damage} ダメージを与える。',
    type: 'attack',
    rarity: 'rare',
    cost: 2,
    target: 'allEnemies',
    effects: [{ kind: 'damage', amount: 6, scale: 'atk', target: 'all' }],
    image: 'images/cards/card_shotgun.png',
    price: 150,
    pools: ['dark'],
  },
  {
    id: 'hellfire',
    name: '獄炎',
    description: '敵全体に {damage} ダメージ（魔力依存）。\n廃棄。',
    type: 'special',
    rarity: 'legendary',
    cost: 2,
    target: 'allEnemies',
    effects: [{ kind: 'damage', amount: 15, scale: 'mag', target: 'all' }],
    exhaust: true,
    image: 'images/cards/card_hellfire.png',
    price: 220,
    pools: ['dark'],
  },
  {
    id: 'iron_wall',
    name: '鉄壁',
    description: '{block} ブロックを得る。',
    type: 'defense',
    rarity: 'rare',
    cost: 2,
    target: 'self',
    effects: [{ kind: 'block', amount: 12, scale: 'def' }],
    image: 'images/cards/card_iron_wall.png',
    price: 120,
    pools: ['dark'],
  },
  {
    id: 'toxic_mist',
    name: '毒霧',
    description: '敵全体に毒 4 を与える。',
    type: 'debuff',
    rarity: 'rare',
    cost: 1,
    target: 'allEnemies',
    effects: [{ kind: 'status', status: 'poison', amount: 4, target: 'all' }],
    image: 'images/cards/card_toxic_mist.png',
    price: 130,
    pools: ['dark'],
  },
  {
    id: 'terror',
    name: '恐怖の囁き',
    description: '敵に衰弱 2 と脆弱 2 を与える。',
    type: 'debuff',
    rarity: 'rare',
    cost: 1,
    target: 'enemy',
    effects: [
      { kind: 'status', status: 'weak', amount: 2, target: 'target' },
      { kind: 'status', status: 'vulnerable', amount: 2, target: 'target' },
    ],
    image: 'images/cards/card_terror.png',
    price: 110,
    pools: ['dark'],
  },
  {
    id: 'adrenaline',
    name: 'アドレナリン',
    description: 'AP を 2 得る。カードを1枚引く。\n廃棄。',
    type: 'buff',
    rarity: 'legendary',
    cost: 0,
    target: 'self',
    effects: [
      { kind: 'gainAp', amount: 2 },
      { kind: 'draw', amount: 1 },
    ],
    exhaust: true,
    image: 'images/cards/card_adrenaline.png',
    price: 200,
    pools: ['dark'],
  },
  {
    id: 'blood_pact',
    name: '血の契約',
    description: '筋力 3 を得る（戦闘中ずっと有効）。\n廃棄。',
    type: 'buff',
    rarity: 'rare',
    cost: 1,
    target: 'self',
    effects: [{ kind: 'status', status: 'strength', amount: 3, target: 'self' }],
    exhaust: true,
    image: 'images/cards/card_blood_pact.png',
    price: 160,
    pools: ['dark'],
  },
  {
    id: 'first_aid',
    name: '応急処置',
    description: 'HP を {heal} 回復する。\n廃棄。',
    type: 'special',
    rarity: 'rare',
    cost: 1,
    target: 'self',
    effects: [{ kind: 'heal', amount: 8, scale: 'mag' }],
    exhaust: true,
    image: 'images/cards/card_first_aid.png',
    price: 120,
    pools: ['dark'],
  },
];

/** IDからカード定義を引く（見つからなければエラー） */
const CARD_MAP = new Map(CARDS.map((c) => [c.id, c]));
export function getCard(id: string): CardDef {
  const c = CARD_MAP.get(id);
  if (!c) throw new Error(`Unknown card id: ${id}`);
  return c;
}

/**
 * 初期デッキ（仕様書より）
 *  攻撃×5 / 防御×5 / 封印×1 / 奮起×2 / 取捨選択×2 = 15枚
 */
export const STARTER_DECK: string[] = [
  ...Array(5).fill('strike'),
  ...Array(5).fill('defend'),
  'seal',
  ...Array(2).fill('rage'),
  ...Array(2).fill('scavenge'),
];
