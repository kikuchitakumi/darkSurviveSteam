// =============================================================
// items.ts  【データ：消費アイテム・鍵】
// -------------------------------------------------------------
// ★アイテムを追加したい時はこのファイルに1件追加するだけでよい。
//
//  - usable  : battle(戦闘中のみ) / anytime(マップ画面でも使える)
//  - target  : enemy(敵を選ぶ) / allEnemies / self / none
//  - effects : カードと同じ効果部品（model/types.ts の Effect）
//  - pools   : shop(通常ショップ) / dark(闇商人) / drop(戦闘ドロップ) / treasure(宝箱)
//
// アイテムはAPを消費せず、1ターンに何回でも使える（仕様書より）。
// =============================================================
import type { ItemDef, KeyColor } from '@/model/types';

export const ITEMS: ItemDef[] = [
  {
    id: 'potion',
    name: '回復薬',
    description: 'HP を {heal} 回復する。',
    rarity: 'common',
    usable: 'anytime',
    target: 'self',
    effects: [{ kind: 'heal', amount: 15, scale: 'mag' }],
    image: 'images/items/item_potion.png',
    price: 40,
    pools: ['shop', 'drop', 'treasure'],
  },
  {
    id: 'stimulant',
    name: '気付け薬',
    description: 'AP を 1 得る。',
    rarity: 'common',
    usable: 'battle',
    target: 'self',
    effects: [{ kind: 'gainAp', amount: 1 }],
    image: 'images/items/item_stimulant.png',
    price: 50,
    pools: ['shop', 'drop', 'treasure'],
  },
  {
    id: 'molotov',
    name: '火炎瓶',
    description: '敵全体に 10 ダメージを与える。',
    rarity: 'common',
    usable: 'battle',
    target: 'allEnemies',
    effects: [{ kind: 'damage', amount: 10, scale: 'none', target: 'all' }],
    image: 'images/items/item_molotov.png',
    price: 55,
    pools: ['shop', 'drop', 'treasure'],
  },
  {
    id: 'handgun_ammo',
    name: '拳銃の弾',
    description: '敵1体に 18 ダメージを与える。',
    rarity: 'common',
    usable: 'battle',
    target: 'enemy',
    effects: [{ kind: 'damage', amount: 18, scale: 'none' }],
    image: 'images/items/item_handgun_ammo.png',
    price: 50,
    pools: ['shop', 'drop', 'treasure'],
  },
  {
    id: 'smoke',
    name: '煙幕弾',
    description: '12 ブロックを得る。',
    rarity: 'common',
    usable: 'battle',
    target: 'self',
    effects: [{ kind: 'block', amount: 12, scale: 'none' }],
    image: 'images/items/item_smoke.png',
    price: 45,
    pools: ['shop', 'drop', 'treasure'],
  },
  {
    id: 'poison_vial',
    name: '毒の小瓶',
    description: '敵1体に毒 6 を与える。',
    rarity: 'common',
    usable: 'battle',
    target: 'enemy',
    effects: [{ kind: 'status', status: 'poison', amount: 6, target: 'target' }],
    image: 'images/items/item_poison_vial.png',
    price: 45,
    pools: ['shop', 'drop', 'treasure'],
  },
  {
    id: 'steroid',
    name: '筋肉増強剤',
    description: '筋力 2 を得る（この戦闘中）。',
    rarity: 'rare',
    usable: 'battle',
    target: 'self',
    effects: [{ kind: 'status', status: 'strength', amount: 2, target: 'self' }],
    image: 'images/items/item_steroid.png',
    price: 80,
    pools: ['shop', 'drop', 'treasure'],
  },
  {
    id: 'flashbang',
    name: '閃光弾',
    description: '敵全体の行動を1ターン封じる。',
    rarity: 'rare',
    usable: 'battle',
    target: 'allEnemies',
    effects: [{ kind: 'stun', target: 'all' }],
    image: 'images/items/item_flashbang.png',
    price: 120,
    pools: ['dark', 'treasure'],
  },
  {
    id: 'first_aid_spray',
    name: '救急スプレー',
    description: 'HP を全回復する。',
    rarity: 'legendary',
    usable: 'anytime',
    target: 'self',
    effects: [{ kind: 'healPercent', percent: 100 }],
    image: 'images/items/item_first_aid_spray.png',
    price: 150,
    pools: ['dark', 'treasure'],
  },
  {
    id: 'herb_mix',
    name: '調合ハーブ',
    description: 'HP を最大HPの 50% 回復する。',
    rarity: 'rare',
    usable: 'anytime',
    target: 'self',
    effects: [{ kind: 'healPercent', percent: 50 }],
    image: 'images/items/item_herb_mix.png',
    price: 90,
    pools: ['shop', 'dark', 'treasure'],
  },
];

const ITEM_MAP = new Map(ITEMS.map((i) => [i.id, i]));
export function getItem(id: string): ItemDef {
  const it = ITEM_MAP.get(id);
  if (!it) throw new Error(`Unknown item id: ${id}`);
  return it;
}

// -------------------------------------------------------------
// 鍵（宝物庫の宝箱を開けるのに使う）
// -------------------------------------------------------------
export interface KeyDef {
  color: KeyColor;
  name: string;
  description: string;
  image: string;
  price: number;
}

export const KEYS: Record<KeyColor, KeyDef> = {
  red: { color: 'red', name: '赤い鍵', description: '宝物庫の赤い宝箱を開けられる。', image: 'images/items/key_red.png', price: 120 },
  blue: { color: 'blue', name: '青い鍵', description: '宝物庫の青い宝箱を開けられる。', image: 'images/items/key_blue.png', price: 120 },
  yellow: { color: 'yellow', name: '黄色い鍵', description: '宝物庫の黄色い宝箱を開けられる。', image: 'images/items/key_yellow.png', price: 100 },
  green: { color: 'green', name: '緑の鍵', description: '宝物庫の緑の宝箱を開けられる。', image: 'images/items/key_green.png', price: 100 },
};
