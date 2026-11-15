// =============================================================
// Loot.ts  【Model：報酬・ショップ・宝箱の中身を決める】
// -------------------------------------------------------------
//  - 戦闘勝利報酬（G・経験値・カード3択・ドロップ）
//  - ショップの品揃え（通常 / 闇商人）
//  - 宝箱の中身
// 「何が手に入るか」の抽選は全てこのファイルにまとめている。
// =============================================================
import { BALANCE } from '@/config/balance';
import { CARDS } from '@/data/cards';
import { ITEMS, KEYS } from '@/data/items';
import { EQUIPMENT } from '@/data/equipment';
import { Random } from '@/core/Random';
import type { CardDef, EquipmentDef, EquipSlot, ItemDef, KeyColor, Rarity, TreasureChestDef } from './types';
import { KEY_COLORS } from './types';
import type { BattleKind } from './Combat';

const RARITY_ORDER: Rarity[] = ['basic', 'common', 'rare', 'legendary'];
const rarityAtLeast = (r: Rarity, min: Rarity) => RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf(min);

// -------------------------------------------------------------
// 戦闘報酬
// -------------------------------------------------------------
export interface BattleReward {
  gold: number;
  exp: number;
  cardChoices: string[];
  itemId: string | null;
  equipmentId: string | null;
  key: KeyColor | null;
}

/** カード報酬の候補（仕様：現在は初期デッキのカードのみ = pools に 'reward'） */
export function rewardCardPool(): CardDef[] {
  return CARDS.filter((c) => c.pools.includes('reward'));
}

export function rollCardChoices(rng: Random, n: number = BALANCE.CARD_REWARD_CHOICES): string[] {
  const pool = rewardCardPool();
  // 種類が足りない場合は重複を許す
  if (pool.length >= n) return rng.sample(pool, n).map((c) => c.id);
  return Array.from({ length: n }, () => rng.pick(pool).id);
}

function randomItem(rng: Random, pool: ItemDef['pools'][number]): ItemDef | null {
  const list = ITEMS.filter((i) => i.pools.includes(pool));
  return list.length ? rng.weighted(list, (i) => (i.rarity === 'legendary' ? 1 : i.rarity === 'rare' ? 3 : 8)) : null;
}

export function randomEquipment(rng: Random, pool: EquipmentDef['pools'][number], slot?: EquipSlot, minRarity: Rarity = 'basic'): EquipmentDef | null {
  const list = EQUIPMENT.filter((e) => e.pools.includes(pool) && (!slot || e.slot === slot) && rarityAtLeast(e.rarity, minRarity));
  return list.length ? rng.weighted(list, (e) => (e.rarity === 'legendary' ? 1 : e.rarity === 'rare' ? 3 : 6)) : null;
}

export function rollBattleReward(floor: number, kind: BattleKind, rng: Random): BattleReward {
  const [gmin, gmax] = BALANCE.rewardGold(floor, kind);
  const reward: BattleReward = {
    gold: rng.int(gmin, gmax),
    exp: BALANCE.rewardExp(floor, kind),
    cardChoices: rollCardChoices(rng),
    itemId: null,
    equipmentId: null,
    key: null,
  };
  if (kind === 'boss') {
    reward.equipmentId = randomEquipment(rng, 'drop', undefined, 'rare')?.id ?? null;
    reward.key = rng.pick(KEY_COLORS);
    reward.itemId = randomItem(rng, 'drop')?.id ?? null;
  } else if (kind === 'elite') {
    if (rng.chance(BALANCE.ELITE_ITEM_DROP)) reward.itemId = randomItem(rng, 'drop')?.id ?? null;
    if (rng.chance(BALANCE.ELITE_EQUIP_DROP)) reward.equipmentId = randomEquipment(rng, 'drop')?.id ?? null;
    if (rng.chance(BALANCE.ELITE_KEY_DROP)) reward.key = rng.pick(KEY_COLORS);
  } else {
    if (rng.chance(BALANCE.NORMAL_ITEM_DROP)) reward.itemId = randomItem(rng, 'drop')?.id ?? null;
    if (rng.chance(BALANCE.NORMAL_KEY_DROP)) reward.key = rng.pick(KEY_COLORS);
  }
  return reward;
}

// -------------------------------------------------------------
// ショップ
// -------------------------------------------------------------
export type ShopEntry =
  | { kind: 'card'; id: string; price: number; sold: boolean }
  | { kind: 'item'; id: string; price: number; sold: boolean }
  | { kind: 'equipment'; id: string; price: number; sold: boolean }
  | { kind: 'key'; id: KeyColor; price: number; sold: boolean };

export interface ShopStock {
  dark: boolean;
  entries: ShopEntry[];
}

/** 階が上がるほど少し高くなる。闇商人はさらに高額 */
function priceOf(base: number, floor: number, dark: boolean, rng: Random): number {
  const p = base * (1 + floor * BALANCE.SHOP_PRICE_PER_FLOOR) * (dark ? BALANCE.DARK_PRICE_MULTIPLIER : 1) * (0.9 + rng.next() * 0.2);
  return Math.max(1, Math.round(p / 5) * 5);
}

export function rollShop(floor: number, rng: Random): ShopStock {
  const dark = rng.chance(BALANCE.DARK_MERCHANT_CHANCE);
  const entries: ShopEntry[] = [];
  if (!dark) {
    // ---- 通常の商人：カード5 / アイテム3 / 鍵1 / 装備1 ----
    const cards = CARDS.filter((c) => c.pools.includes('shop'));
    for (let i = 0; i < 5; i++) {
      const c = rng.pick(cards);
      entries.push({ kind: 'card', id: c.id, price: priceOf(c.price, floor, false, rng), sold: false });
    }
    rng.sample(ITEMS.filter((i) => i.pools.includes('shop')), 3).forEach((it) => entries.push({ kind: 'item', id: it.id, price: priceOf(it.price, floor, false, rng), sold: false }));
    const kc = rng.pick(KEY_COLORS);
    entries.push({ kind: 'key', id: kc, price: priceOf(KEYS[kc].price, floor, false, rng), sold: false });
    const eq = randomEquipment(rng, 'shop');
    if (eq) entries.push({ kind: 'equipment', id: eq.id, price: priceOf(eq.price, floor, false, rng), sold: false });
  } else {
    // ---- 闇商人：強力カード3 / 装備3 / アイテム2 ----
    rng.sample(CARDS.filter((c) => c.pools.includes('dark')), 3).forEach((c) => entries.push({ kind: 'card', id: c.id, price: priceOf(c.price, floor, true, rng), sold: false }));
    rng.sample(EQUIPMENT.filter((e) => e.pools.includes('dark')), 3).forEach((e) => entries.push({ kind: 'equipment', id: e.id, price: priceOf(e.price, floor, true, rng), sold: false }));
    rng.sample(ITEMS.filter((i) => i.pools.includes('dark')), 2).forEach((it) => entries.push({ kind: 'item', id: it.id, price: priceOf(it.price, floor, true, rng), sold: false }));
  }
  return { dark, entries };
}

/** カード削除サービスの価格 */
export function cardRemovePrice(removeCount: number): number {
  return BALANCE.CARD_REMOVE_BASE + removeCount * BALANCE.CARD_REMOVE_STEP;
}

// -------------------------------------------------------------
// 宝箱
// -------------------------------------------------------------
export interface TreasureLoot {
  gold: number;
  items: string[];
  equipment: string[];
  cards: string[];
}

export function rollTreasure(chest: TreasureChestDef, rng: Random): TreasureLoot {
  const loot: TreasureLoot = { gold: 0, items: [], equipment: [], cards: [] };
  for (const c of chest.contents) {
    switch (c.kind) {
      case 'gold': loot.gold += rng.int(c.min, c.max); break;
      case 'randomItem': for (let i = 0; i < c.count; i++) { const it = randomItem(rng, 'treasure'); if (it) loot.items.push(it.id); } break;
      case 'randomEquipment': { const e = randomEquipment(rng, 'treasure', c.slot, c.minRarity); if (e) loot.equipment.push(e.id); break; }
      case 'randomCard': loot.cards.push(rng.pick(rewardCardPool()).id); break;
      case 'stat': break;
    }
  }
  return loot;
}
