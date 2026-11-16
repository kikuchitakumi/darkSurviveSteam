// =============================================================
// cards.ts  【データ：カード】
// -------------------------------------------------------------
// ★カードを追加したい時はこのファイルに1件追加するだけでよい。
//   （開発メニューから追加したカードは Firebase / ローカルに保存され、
//     起動時にここへ自動で追加・上書きされる → src/services/content.ts）
//
//  - id        : 半角英数字の一意なID（セーブデータで使用、後から変更しない）
//  - name      : カード名（日本語）。英語は i18n/en.ts の card.<id>.name
//  - description : 説明文。{damage} {hits} {block} {heal} {curse} {self} {x} は実数値に置換
//  - type      : attack(攻撃) / defense(防御) / support(サポート)
//  - element   : 攻撃の系統 sword(剣) / magic(魔力) / blood(血) / curse(呪)
//  - cost      : 消費AP。'X' は「残りAPを全て使い、その数を X とする」
//  - effects   : 効果の部品の並び（model/types.ts の Effect を参照）
//      数値は「amount + mult × scale」。例) 攻撃力の3倍 = { amount:0, scale:'atk', mult:3 }
//  - starterCount : 初期デッキに入れる枚数
//  - minFloor / maxFloor / weight : 報酬・ショップに出る階の範囲と出やすさ
//  - image     : カードイラスト（public/assets/ からの相対パス、または https の URL）
// =============================================================
import type { CardDef, Rarity } from '@/model/types';

/** レア度ごとの既定値（価格・入手場所・出やすさ・出始める階） */
const RARITY_DEFAULTS: Record<Rarity, Pick<CardDef, 'price' | 'pools' | 'weight' | 'minFloor'>> = {
  basic: { price: 40, pools: ['starter', 'reward', 'shop'], weight: 6, minFloor: 1 },
  common: { price: 60, pools: ['reward', 'shop'], weight: 10, minFloor: 1 },
  rare: { price: 110, pools: ['reward', 'shop', 'dark'], weight: 6, minFloor: 4 },
  legendary: { price: 180, pools: ['reward', 'dark'], weight: 3, minFloor: 12 },
};

type CardInput = Omit<CardDef, 'image' | 'price' | 'pools'> & Partial<Pick<CardDef, 'image' | 'price' | 'pools'>>;

/** 既定値を補ってカードを作る */
function card(c: CardInput): CardDef {
  return { image: `images/cards/card_${c.id}.png`, ...RARITY_DEFAULTS[c.rarity], ...c } as CardDef;
}

export const CARDS: CardDef[] = [
  // =========================================================
  // 防御
  // =========================================================
  card({ id: 'block', name: 'ブロック', description: '防御力×1（{block}）のシールドを得る。', type: 'defense', rarity: 'basic', cost: 1, target: 'self', starterCount: 3,
    effects: [{ kind: 'block', amount: 0, scale: 'def', mult: 1 }] }),
  card({ id: 'iron_wall', name: '鉄壁', description: '防御力×3（{block}）のシールドを得る。', type: 'defense', rarity: 'basic', cost: 2, target: 'self', starterCount: 1,
    effects: [{ kind: 'block', amount: 0, scale: 'def', mult: 3 }] }),
  card({ id: 'steadfast', name: '不屈の守勢', description: 'この戦闘中、毎ターン\n防御力×1のシールドを得る。', type: 'defense', rarity: 'rare', cost: 3, target: 'self',
    effects: [{ kind: 'status', status: 'fortify', amount: 1, target: 'self' }] }),

  // =========================================================
  // サポート
  // =========================================================
  card({ id: 'rally', name: '奮起', description: '次のターン、攻撃力が2倍になる。', type: 'support', rarity: 'rare', cost: 3, target: 'self',
    effects: [{ kind: 'status', status: 'atkDoubleNext', amount: 1, target: 'self' }] }),
  card({ id: 'rest', name: '休息', description: '攻撃力×1（{heal}）HP を回復する。', type: 'support', rarity: 'common', cost: 1, target: 'self',
    effects: [{ kind: 'heal', amount: 0, scale: 'atk', mult: 1 }] }),
  card({ id: 'prayer', name: '祈り', description: '魔力×1（{heal}）HP を回復する。', type: 'support', rarity: 'common', cost: 1, target: 'self',
    effects: [{ kind: 'heal', amount: 0, scale: 'mag', mult: 1 }] }),
  card({ id: 'inspiration', name: '思いつき', description: 'カードを1枚引く。', type: 'support', rarity: 'common', cost: 0, target: 'none',
    effects: [{ kind: 'draw', amount: 1 }] }),
  card({ id: 'blessing', name: '加護', description: 'カードを2枚引く。', type: 'support', rarity: 'common', cost: 1, target: 'none',
    effects: [{ kind: 'draw', amount: 2 }] }),
  card({ id: 'dark_blessing', name: '闇の加護', description: 'カードを3枚引く。', type: 'support', rarity: 'rare', cost: 2, target: 'none',
    effects: [{ kind: 'draw', amount: 3 }] }),
  card({ id: 'retaliate', name: '報復', description: 'このターン受けたダメージと\n同じだけ（{damage}）ダメージ。', type: 'support', rarity: 'common', cost: 1, target: 'enemy',
    effects: [{ kind: 'damage', amount: 0, scale: 'damageTakenTurn', mult: 1 }] }),
  card({ id: 'pride', name: '誇り', description: 'この戦闘中、行動値（AP）を1上昇させる。\n廃棄。', type: 'support', rarity: 'rare', cost: 1, target: 'self', exhaust: true,
    effects: [{ kind: 'maxAp', amount: 1 }] }),
  card({ id: 'scheme', name: '謀略', description: '相手の行動を1回キャンセルする。', type: 'support', rarity: 'rare', cost: 2, target: 'enemy',
    effects: [{ kind: 'stun', target: 'target' }] }),
  card({ id: 'trickery', name: '小手先', description: 'この戦闘中、ダメージが +2 増加する。', type: 'support', rarity: 'common', cost: 1, target: 'self',
    effects: [{ kind: 'status', status: 'strength', amount: 2, target: 'self' }] }),
  card({ id: 'blood_price', name: '血の代償', description: '毎ターン自分に3ダメージ。\nこの戦闘中、ダメージが攻撃力と\n同じだけ増加する。', type: 'support', rarity: 'legendary', cost: 1, target: 'self',
    effects: [{ kind: 'status', status: 'bloodPrice', amount: 3, target: 'self' }, { kind: 'status', status: 'strength', amount: 0, scale: 'atk', mult: 1, target: 'self' }] }),
  card({ id: 'tit_for_tat', name: 'しっぺ返し', description: 'この戦闘中、敵は攻撃した後\nその攻撃力と同じダメージを受ける。', type: 'support', rarity: 'rare', cost: 2, target: 'self',
    effects: [{ kind: 'status', status: 'retribution', amount: 1, target: 'self' }] }),
  card({ id: 'selection', name: '選択', description: '手札を1枚選ぶ。この戦闘中、\nそのカードのコストを -1 する。廃棄。', type: 'support', rarity: 'rare', cost: 1, target: 'none', exhaust: true,
    effects: [{ kind: 'reduceCostChoice', amount: 1 }] }),

  // =========================================================
  // 攻撃
  // =========================================================
  card({ id: 'stone_throw', name: '投石', description: '{damage} のダメージ。', type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    effects: [{ kind: 'damage', amount: 3, scale: 'none' }] }),
  card({ id: 'fury', name: '憤怒', description: 'このターンに使ったカードの枚数×5\n（{damage}）のダメージ。', type: 'attack', rarity: 'rare', cost: 1, target: 'enemy',
    effects: [{ kind: 'damage', amount: 0, scale: 'cardsPlayedTurn', mult: 5 }] }),

  // ---- 攻撃・剣 ----
  card({ id: 'issen', name: '一閃', description: '攻撃力×1（{damage}）のダメージ。', type: 'attack', element: 'sword', rarity: 'basic', cost: 1, target: 'enemy', starterCount: 3,
    effects: [{ kind: 'damage', amount: 0, scale: 'atk', mult: 1 }] }),
  card({ id: 'bone_breaker', name: '骨断ち', description: '攻撃力×3（{damage}）のダメージ。', type: 'attack', element: 'sword', rarity: 'basic', cost: 2, target: 'enemy', starterCount: 1,
    effects: [{ kind: 'damage', amount: 0, scale: 'atk', mult: 3 }] }),
  card({ id: 'triple_slash', name: '三閃撃', description: '攻撃力×1（{damage}）のダメージを\n{hits} 回。', type: 'attack', element: 'sword', rarity: 'common', cost: 2, target: 'enemy',
    effects: [{ kind: 'damage', amount: 0, scale: 'atk', mult: 1, hits: 3 }] }),
  card({ id: 'lethal_blow', name: '致死の一撃', description: '攻撃力×X（{damage}）のダメージ。\nX＝残りの行動値（AP）。', type: 'attack', element: 'sword', rarity: 'rare', cost: 'X', target: 'enemy',
    effects: [{ kind: 'damage', amount: 0, scale: 'atk', mult: 1, xMult: true }] }),
  card({ id: 'lion_dance', name: '獅子乱舞', description: '攻撃力×1（{damage}）のダメージを\nX 回。X＝残りの行動値（AP）。', type: 'attack', element: 'sword', rarity: 'legendary', cost: 'X', target: 'enemy',
    effects: [{ kind: 'damage', amount: 0, scale: 'atk', mult: 1, hits: 'X' }] }),
  card({ id: 'armor_break', name: '鎧砕き', description: '敵のシールドを 50% 下げる。', type: 'attack', element: 'sword', rarity: 'common', cost: 1, target: 'enemy',
    effects: [{ kind: 'breakBlock', percent: 50, target: 'target' }] }),

  // ---- 攻撃・魔力 ----
  card({ id: 'black_flame', name: '黒炎', description: '魔力×1（{damage}）のダメージ。', type: 'attack', element: 'magic', rarity: 'basic', cost: 1, target: 'enemy', starterCount: 3,
    effects: [{ kind: 'damage', amount: 0, scale: 'mag', mult: 1 }] }),
  card({ id: 'inferno', name: '業火', description: '魔力×3（{damage}）のダメージ。', type: 'attack', element: 'magic', rarity: 'basic', cost: 2, target: 'enemy', starterCount: 1,
    effects: [{ kind: 'damage', amount: 0, scale: 'mag', mult: 3 }] }),
  card({ id: 'flame_vortex', name: '炎渦', description: '魔力×1（{damage}）のダメージを\n{hits} 回。', type: 'attack', element: 'magic', rarity: 'common', cost: 2, target: 'enemy',
    effects: [{ kind: 'damage', amount: 0, scale: 'mag', mult: 1, hits: 3 }] }),
  card({ id: 'underworld_flame', name: '冥府の炎', description: '魔力×X（{damage}）のダメージ。\nX＝残りの行動値（AP）。', type: 'attack', element: 'magic', rarity: 'rare', cost: 'X', target: 'enemy',
    effects: [{ kind: 'damage', amount: 0, scale: 'mag', mult: 1, xMult: true }] }),
  card({ id: 'ashes', name: '灰燼', description: '魔力×1（{damage}）のダメージを\nX 回。X＝残りの行動値（AP）。', type: 'attack', element: 'magic', rarity: 'legendary', cost: 'X', target: 'enemy',
    effects: [{ kind: 'damage', amount: 0, scale: 'mag', mult: 1, hits: 'X' }] }),
  card({ id: 'will_o_wisp', name: '鬼火', description: '敵のシールドを 50% 下げる。', type: 'attack', element: 'magic', rarity: 'common', cost: 1, target: 'enemy',
    effects: [{ kind: 'breakBlock', percent: 50, target: 'target' }] }),

  // ---- 攻撃・血 ----
  card({ id: 'blood_flash', name: '血閃', description: '自分に {self} ダメージ。\n攻撃力×2（{damage}）のダメージ。', type: 'attack', element: 'blood', rarity: 'common', cost: 1, target: 'enemy',
    effects: [{ kind: 'selfDamage', amount: 2, scale: 'none' }, { kind: 'damage', amount: 0, scale: 'atk', mult: 2 }] }),
  card({ id: 'crimson_slash', name: '鮮血斬', description: '自分に {self} ダメージ。\n攻撃力×5（{damage}）のダメージ。', type: 'attack', element: 'blood', rarity: 'rare', cost: 2, target: 'enemy',
    effects: [{ kind: 'selfDamage', amount: 5, scale: 'none' }, { kind: 'damage', amount: 0, scale: 'atk', mult: 5 }] }),
  card({ id: 'corpse_pile', name: '死屍累々', description: 'この戦闘中に減った自分の HP と\n同じだけ（{damage}）ダメージ。', type: 'attack', element: 'blood', rarity: 'rare', cost: 2, target: 'enemy',
    effects: [{ kind: 'damage', amount: 0, scale: 'hpLostBattle', mult: 1 }] }),

  // ---- 攻撃・呪 ----
  card({ id: 'curse_flame', name: '呪炎', description: '魔力×1（{curse}）の呪いを付与する。', type: 'attack', element: 'curse', rarity: 'common', cost: 1, target: 'enemy',
    effects: [{ kind: 'status', status: 'curse', amount: 0, scale: 'mag', mult: 1, target: 'target' }] }),
  card({ id: 'death_curse', name: '呪殺', description: '魔力×X（{curse}）の呪いを付与する。\nX＝残りの行動値（AP）。', type: 'attack', element: 'curse', rarity: 'rare', cost: 'X', target: 'enemy',
    effects: [{ kind: 'status', status: 'curse', amount: 0, scale: 'mag', mult: 1, xMult: true, target: 'target' }] }),
  card({ id: 'grudge', name: '積年の恨み', description: '現在のターン数と同じだけ\n（{curse}）呪いを付与する。', type: 'attack', element: 'curse', rarity: 'rare', cost: 3, target: 'enemy',
    effects: [{ kind: 'status', status: 'curse', amount: 0, scale: 'turn', mult: 1, target: 'target' }] }),
];

// -------------------------------------------------------------
// 検索・登録（開発メニュー / Firebase から追加・上書きできる）
// -------------------------------------------------------------
let index = new Map(CARDS.map((c) => [c.id, c]));

/** IDからカード定義を引く（見つからなければエラー） */
export function getCard(id: string): CardDef {
  const c = index.get(id);
  if (!c) throw new Error(`Unknown card id: ${id}`);
  return c;
}

export function hasCard(id: string): boolean {
  return index.has(id);
}

/** カードを追加・上書きする（同じ id があれば置き換え） */
export function upsertCards(defs: CardDef[]): void {
  for (const d of defs) {
    const i = CARDS.findIndex((c) => c.id === d.id);
    if (i >= 0) CARDS[i] = d;
    else CARDS.push(d);
  }
  index = new Map(CARDS.map((c) => [c.id, c]));
}

/** カードを取り除く */
export function removeCards(ids: string[]): void {
  for (const id of ids) {
    const i = CARDS.findIndex((c) => c.id === id);
    if (i >= 0) CARDS.splice(i, 1);
  }
  index = new Map(CARDS.map((c) => [c.id, c]));
}

/**
 * 初期デッキ（各カードの starterCount から作る）
 * 現在：ブロック×3 / 鉄壁×1 / 一閃×3 / 骨断ち×1 / 黒炎×3 / 業火×1 = 12枚
 */
export function getStarterDeck(): string[] {
  return CARDS.flatMap((c) => Array(Math.max(0, c.starterCount ?? 0)).fill(c.id));
}

/**
 * その階でのカードの出やすさ（0 なら出ない）
 *  - minFloor 〜 maxFloor の外では 0
 *  - 深い階ほどレア・レジェンドが出やすくなる
 */
export function cardWeightAt(c: CardDef, floor: number): number {
  if (floor < (c.minFloor ?? 1) || floor > (c.maxFloor ?? 999)) return 0;
  const base = c.weight ?? 10;
  const depth = Math.min(1, floor / 100);
  const rarityBoost = c.rarity === 'legendary' ? 1 + depth * 3 : c.rarity === 'rare' ? 1 + depth * 1.5 : c.rarity === 'basic' ? 1 - depth * 0.6 : 1;
  return Math.max(0, base * rarityBoost);
}
