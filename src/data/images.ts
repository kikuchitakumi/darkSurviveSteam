// =============================================================
// images.ts  【データ：画面共通の画像一覧】
// -------------------------------------------------------------
// 背景・UI など「カード/敵/アイテム以外」の画像パスをここで一元管理する。
// 画像は全て public/assets/images/ 以下。
// 現在の画像は tools/generate-placeholders.ts が自動生成した仮画像で、
// 画像の中に「何に使う画像か」が文字で書かれている。
// ★同じファイル名で上書きすれば、コードを変えずに差し替えられる。
// =============================================================
import { CARDS } from './cards';
import { ENEMIES } from './enemies';
import { ITEMS, KEYS } from './items';
import { EQUIPMENT } from './equipment';
import { STATUS_EFFECTS } from './statusEffects';
import { TREASURE_CHESTS } from './treasures';
import { ZONES, FIRST_FLOOR, ROUTE_VISUALS } from './floors';
import { EVENTS } from './events';

export const IMAGES = {
  // ---- 背景（1920x1080） ----
  titleKeyVisual: 'images/bg/bg_title_keyvisual.webp',
  statRoll: 'images/bg/bg_status_roll.webp',
  treasureRoom: 'images/bg/bg_treasure_room.webp',
  shop: 'images/bg/bg_shop.webp',
  darkShop: 'images/bg/bg_dark_shop.webp',
  gameOver: 'images/bg/bg_gameover.webp',
  clear: 'images/bg/bg_clear.webp',

  // ---- 透過オブジェクト ----
  merchant: 'images/objects/obj_merchant.png',
  darkMerchant: 'images/objects/obj_dark_merchant.png',
  door1F: 'images/objects/door_1f.png',

  // ---- UI ----
  logo: 'images/ui/ui_logo.png',
  /** ボタン枠（9スライス：角32pxは伸びない） */
  button: 'images/ui/ui_button.png',
  buttonPrimary: 'images/ui/ui_button_primary.png',
  /** パネル枠（9スライス：角110pxは伸びない）。モーダル・メッセージ窓・報酬画面などで共通 */
  panel: 'images/ui/ui_panel.png',
  cardBack: 'images/ui/ui_card_back.png',
  /** カード枠（レア度ごと）。イラスト窓は透明、説明欄は半透明 */
  cardFrame: {
    basic: 'images/ui/ui_card_frame_bronze.png',
    common: 'images/ui/ui_card_frame_silver.png',
    rare: 'images/ui/ui_card_frame_gold.png',
    legendary: 'images/ui/ui_card_frame_legendary.png',
  },
  /** カードのコストの宝石（数字は上に CSS で表示） */
  cardCostGem: 'images/ui/ui_card_cost_gem.png',
  /** カードの種類のエンブレム（右上） */
  cardType: {
    attack: 'images/ui/ui_type_attack.png',
    defense: 'images/ui/ui_type_defense.png',
    buff: 'images/ui/ui_type_buff.png',
    debuff: 'images/ui/ui_type_debuff.png',
    special: 'images/ui/ui_type_special.png',
  },
  /** AP のクリスタル（点灯／消灯） */
  apCrystal: 'images/ui/ui_ap_crystal.png',
  apCrystalEmpty: 'images/ui/ui_ap_crystal_empty.png',
  /** ターン終了ボタン（丸いメダリオン） */
  endTurn: 'images/ui/ui_end_turn.png',
  /** 主人公の肖像と、その枠 */
  leaderFrame: 'images/ui/ui_leader_frame.png',
  leaderPortrait: 'images/ui/ui_leader_portrait.png',
  intent: {
    attack: 'images/ui/intent_attack.png',
    debuff: 'images/ui/intent_debuff.png',
    buff: 'images/ui/intent_buff.png',
    block: 'images/ui/intent_block.png',
    special: 'images/ui/intent_special.png',
    stun: 'images/ui/intent_stun.png',
  },
  icon: {
    gold: 'images/ui/icon_gold.png',
    hp: 'images/ui/icon_hp.png',
    ap: 'images/ui/icon_ap.png',
    block: 'images/ui/icon_block.png',
    deck: 'images/ui/icon_deck.png',
    discard: 'images/ui/icon_discard.png',
    exhaust: 'images/ui/icon_exhaust.png',
    floor: 'images/ui/icon_floor.png',
    menu: 'images/ui/icon_menu.png',
    status: 'images/ui/icon_status.png',
  },
} as const;

/**
 * ゲームで使う全ての画像パスを集める。
 *  - 起動時の先読み（ローディング画面）
 *  - tools/generate-placeholders.ts（仮画像の自動生成）
 * の両方から使われる。
 */
export function collectAllImagePaths(): string[] {
  const set = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') set.add(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(IMAGES);
  CARDS.forEach((c) => set.add(c.image));
  ENEMIES.forEach((e) => set.add(e.image));
  ITEMS.forEach((i) => set.add(i.image));
  Object.values(KEYS).forEach((k) => set.add(k.image));
  EQUIPMENT.forEach((e) => set.add(e.image));
  Object.values(STATUS_EFFECTS).forEach((s) => set.add(s.icon));
  Object.values(TREASURE_CHESTS).forEach((t) => set.add(t.image));
  ZONES.forEach((z) => { set.add(z.floorBackground); set.add(z.battleBackground); });
  set.add(FIRST_FLOOR.background);
  Object.values(ROUTE_VISUALS).forEach((r) => set.add(r.image));
  EVENTS.forEach((e) => { set.add(e.background); if (e.object) set.add(e.object); });
  return [...set];
}
