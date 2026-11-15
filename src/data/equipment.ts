// =============================================================
// equipment.ts  【データ：装備品（武器・防具・アクセサリー）】
// -------------------------------------------------------------
// ★装備品を追加したい時はこのファイルに1件追加するだけでよい。
//
//  - slot   : weapon(武器) / armor(防具) / accessory(アクセサリー)
//             それぞれ1つだけ装備できる。
//  - stats  : ステータス補正（hp/atk/def/mag/luk）
//  - ap     : 最大AP の補正（AP を増やせる貴重な装備）
//  - battleStartStatus : 戦闘開始時に得る状態
//  - pools  : shop / dark(闇商人) / drop(強敵・ボス) / treasure(宝箱)
// =============================================================
import type { EquipmentDef } from '@/model/types';

export const EQUIPMENT: EquipmentDef[] = [
  // ------------------------- 武器 -------------------------
  { id: 'rusty_knife', name: '錆びたナイフ', description: '攻撃力 +2', slot: 'weapon', rarity: 'common', stats: { atk: 2 }, image: 'images/equipment/eq_rusty_knife.png', price: 80, pools: ['shop', 'drop', 'treasure'] },
  { id: 'fire_axe', name: '消防斧', description: '攻撃力 +4 / 運 -1', slot: 'weapon', rarity: 'common', stats: { atk: 4, luk: -1 }, image: 'images/equipment/eq_fire_axe.png', price: 130, pools: ['shop', 'drop', 'treasure'] },
  { id: 'handgun', name: '古びた拳銃', description: '攻撃力 +3 / 運 +2', slot: 'weapon', rarity: 'rare', stats: { atk: 3, luk: 2 }, image: 'images/equipment/eq_handgun.png', price: 180, pools: ['shop', 'drop', 'treasure'] },
  { id: 'ritual_dagger', name: '儀式の短剣', description: '攻撃力 +2 / 魔力 +4', slot: 'weapon', rarity: 'rare', stats: { atk: 2, mag: 4 }, image: 'images/equipment/eq_ritual_dagger.png', price: 190, pools: ['drop', 'treasure', 'dark'] },
  { id: 'chainsaw', name: 'チェーンソー', description: '攻撃力 +8 / 防御力 -2\n戦闘開始時 筋力+1', slot: 'weapon', rarity: 'legendary', stats: { atk: 8, def: -2 }, battleStartStatus: [{ status: 'strength', amount: 1 }], image: 'images/equipment/eq_chainsaw.png', price: 380, pools: ['dark', 'treasure'] },
  { id: 'magnum', name: 'マグナム', description: '攻撃力 +6 / 運 +4\n最大AP +1', slot: 'weapon', rarity: 'legendary', stats: { atk: 6, luk: 4 }, ap: 1, image: 'images/equipment/eq_magnum.png', price: 520, pools: ['dark'] },

  // ------------------------- 防具 -------------------------
  { id: 'leather_jacket', name: '革のジャケット', description: '防御力 +2', slot: 'armor', rarity: 'common', stats: { def: 2 }, image: 'images/equipment/eq_leather_jacket.png', price: 80, pools: ['shop', 'drop', 'treasure'] },
  { id: 'riot_vest', name: '防弾ベスト', description: '防御力 +4 / 体力 +1', slot: 'armor', rarity: 'common', stats: { def: 4, hp: 1 }, image: 'images/equipment/eq_riot_vest.png', price: 140, pools: ['shop', 'drop', 'treasure'] },
  { id: 'lab_coat', name: '血染めの白衣', description: '防御力 +1 / 魔力 +4', slot: 'armor', rarity: 'rare', stats: { def: 1, mag: 4 }, image: 'images/equipment/eq_lab_coat.png', price: 170, pools: ['shop', 'drop', 'treasure'] },
  { id: 'thorn_mail', name: '茨の鎖帷子', description: '防御力 +3\n戦闘開始時 棘3', slot: 'armor', rarity: 'rare', stats: { def: 3 }, battleStartStatus: [{ status: 'thorns', amount: 3 }], image: 'images/equipment/eq_thorn_mail.png', price: 220, pools: ['drop', 'treasure', 'dark'] },
  { id: 'hazmat_suit', name: '防護服', description: '防御力 +6 / 体力 +3', slot: 'armor', rarity: 'legendary', stats: { def: 6, hp: 3 }, image: 'images/equipment/eq_hazmat_suit.png', price: 400, pools: ['dark', 'treasure'] },
  { id: 'abyss_cloak', name: '深淵の外套', description: '防御力 +4 / 魔力 +4\n最大AP +1', slot: 'armor', rarity: 'legendary', stats: { def: 4, mag: 4 }, ap: 1, image: 'images/equipment/eq_abyss_cloak.png', price: 540, pools: ['dark'] },

  // ---------------------- アクセサリー ----------------------
  { id: 'lucky_coin', name: '幸運のコイン', description: '運 +4', slot: 'accessory', rarity: 'common', stats: { luk: 4 }, image: 'images/equipment/eq_lucky_coin.png', price: 90, pools: ['shop', 'drop', 'treasure'] },
  { id: 'old_rosary', name: '古いロザリオ', description: '魔力 +3 / 体力 +1', slot: 'accessory', rarity: 'common', stats: { mag: 3, hp: 1 }, image: 'images/equipment/eq_old_rosary.png', price: 110, pools: ['shop', 'drop', 'treasure'] },
  { id: 'dog_tag', name: '兵士の認識票', description: '攻撃力 +2 / 防御力 +2', slot: 'accessory', rarity: 'rare', stats: { atk: 2, def: 2 }, image: 'images/equipment/eq_dog_tag.png', price: 170, pools: ['shop', 'drop', 'treasure'] },
  { id: 'regen_ring', name: '再生の指輪', description: '体力 +2\n戦闘開始時 再生3', slot: 'accessory', rarity: 'rare', stats: { hp: 2 }, battleStartStatus: [{ status: 'regen', amount: 3 }], image: 'images/equipment/eq_regen_ring.png', price: 210, pools: ['drop', 'treasure', 'dark'] },
  { id: 'energy_core', name: '鼓動するコア', description: '最大AP +1', slot: 'accessory', rarity: 'legendary', stats: {}, ap: 1, image: 'images/equipment/eq_energy_core.png', price: 450, pools: ['dark', 'treasure'] },
  { id: 'eye_amulet', name: '見開く眼の護符', description: '運 +8 / 魔力 +2', slot: 'accessory', rarity: 'legendary', stats: { luk: 8, mag: 2 }, image: 'images/equipment/eq_eye_amulet.png', price: 420, pools: ['dark', 'treasure'] },
];

const EQUIP_MAP = new Map(EQUIPMENT.map((e) => [e.id, e]));
export function getEquipment(id: string): EquipmentDef {
  const e = EQUIP_MAP.get(id);
  if (!e) throw new Error(`Unknown equipment id: ${id}`);
  return e;
}
