// =============================================================
// generate-placeholders.ts  【ツール：仮画像の一括生成】
// -------------------------------------------------------------
// 実行: npm run gen:images
//
// data/ に登録されている全てのカード・敵・アイテム・背景などから
// 必要な画像の一覧を作り、Edge（ヘッドレス）の Canvas で仮画像を描いて
// public/assets/images/ に PNG で保存する。
//
//  - 既にファイルがある場合はスキップ（本番画像を上書きしないため）
//    → 全て作り直したい時は `npm run gen:images -- --force`
//  - 新しいカードや敵を data/ に追加したら、このコマンドを実行するだけで
//    仮画像が自動で用意される。
// =============================================================
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARDS } from '../src/data/cards';
import { ENEMIES } from '../src/data/enemies';
import { ITEMS, KEYS } from '../src/data/items';
import { EQUIPMENT } from '../src/data/equipment';
import { STATUS_EFFECTS } from '../src/data/statusEffects';
import { TREASURE_CHESTS } from '../src/data/treasures';
import { ZONES, FIRST_FLOOR, ROUTE_VISUALS } from '../src/data/floors';
import { EVENTS } from '../src/data/events';
import { IMAGES, collectAllImagePaths } from '../src/data/images';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets');
const FORCE = process.argv.includes('--force');

interface Spec {
  path: string;
  file: string;
  type: string;
  w: number;
  h: number;
  title: string;
  [k: string]: unknown;
}

// ---- 絵文字の割り当て（仮画像のシンボル） ----
const CARD_SYMBOL: Record<string, string> = {
  block: '🛡️', iron_wall: '🧱', steadfast: '🏰', rally: '📯', rest: '🛌', prayer: '🙏', inspiration: '💡', blessing: '✨', dark_blessing: '🌑',
  retaliate: '🔁', pride: '👑', scheme: '🕸️', trickery: '🎭', blood_price: '🩸', tit_for_tat: '⚖️', selection: '🃏',
  stone_throw: '🪨', fury: '💢', issen: '🗡️', bone_breaker: '🦴', triple_slash: '⚔️', lethal_blow: '💀', lion_dance: '🦁', armor_break: '🔨',
  black_flame: '🔥', inferno: '🌋', flame_vortex: '🌪️', underworld_flame: '☄️', ashes: '🌫️', will_o_wisp: '👻',
  blood_flash: '🩸', crimson_slash: '🗡️', corpse_pile: '⚰️', curse_flame: '🕯️', death_curse: '☠️', grudge: '👁️',
};
const ITEM_SYMBOL: Record<string, string> = {
  potion: '🧪', stimulant: '💉', molotov: '🍾', handgun_ammo: '🔫', smoke: '💨', poison_vial: '☠️', steroid: '💪',
  flashbang: '⚡', first_aid_spray: '🧴', herb_mix: '🌿',
};
const EQUIP_SYMBOL: Record<string, string> = {
  rusty_knife: '🔪', fire_axe: '🪓', handgun: '🔫', ritual_dagger: '🗡️', chainsaw: '⚙️', magnum: '🔫',
  leather_jacket: '🧥', riot_vest: '🦺', lab_coat: '🥼', thorn_mail: '🌵', hazmat_suit: '☢️', abyss_cloak: '🌌',
  lucky_coin: '🪙', old_rosary: '📿', dog_tag: '🏷️', regen_ring: '💍', energy_core: '🔋', eye_amulet: '🧿',
};
const STATUS_SYMBOL: Record<string, string> = {
  strength: '💪', turnStrength: '💢', dexterity: '🌀', weak: '🥀', vulnerable: '💔', frail: '🦴', poison: '☠️',
  stun: '🔒', stunResist: '🔐', regen: '💚', thorns: '🌵',
  curse: '☠️', fortify: '🏰', atkDoubleNext: '⏫', atkDouble: '💥', bloodPrice: '🩸', retribution: '🔁',
};
const ROUTE_SYMBOL: Record<string, string> = { battle: '⚔️', elite: '💀', event: '❓', shop: '🪙', boss: '👹', hidden: '🗝️' };
const BG_THEME: Record<string, string> = {
  bg_title_keyvisual: 'title', bg_status_roll: 'roll', bg_treasure_room: 'treasure', bg_shop: 'shop', bg_dark_shop: 'darkshop',
  bg_gameover: 'gameover', bg_clear: 'clear', bg_event: 'event', bg_tower_1f: 'entrance',
};

function spec(path: string, type: string, w: number, h: number, title: string, extra: Record<string, unknown> = {}): Spec {
  return { path, file: basename(path), type, w, h, title, ...extra };
}

/** data/ から画像の一覧（仕様）を作る */
function buildSpecs(): Spec[] {
  const list: Spec[] = [];
  // ---- 背景 ----
  ZONES.forEach((z) => {
    list.push(spec(z.floorBackground, 'background', 1920, 1080, `背景：塔の内部 ZONE${z.zone}「${z.name}」(${(z.zone - 1) * 20 + 1}F〜${z.zone * 20}F)`, { theme: `tower${z.zone}` }));
    list.push(spec(z.battleBackground, 'background', 1920, 1080, `背景：戦闘画面 ZONE${z.zone}「${z.name}」`, { theme: `tower${z.zone}`, kind: 'battle' }));
  });
  list.push(spec(FIRST_FLOOR.background, 'background', 1920, 1080, '背景：1F 塔の入口', { theme: 'entrance' }));
  const bgTitles: Record<string, string> = {
    titleKeyVisual: '背景：タイトル画面のキービジュアル', statRoll: '背景：ステータス抽選画面', treasureRoom: '背景：宝物庫',
    shop: '背景：ショップ（商人）', darkShop: '背景：闇商人', gameOver: '背景：ゲームオーバー', clear: '背景：エンディング（クリア）',
  };
  for (const [k, title] of Object.entries(bgTitles)) {
    const p = (IMAGES as any)[k] as string;
    list.push(spec(p, 'background', 1920, 1080, title, { theme: BG_THEME[basename(p, '.webp')] }));
  }
  EVENTS.forEach((e) => list.push(spec(e.background, 'background', 1920, 1080, '背景：イベント', { theme: 'event' })));

  // ---- オブジェクト ----
  for (const [r, v] of Object.entries(ROUTE_VISUALS)) list.push(spec(v.image, 'door', 360, 560, `扉：${v.label}`, { variant: r, symbol: ROUTE_SYMBOL[r] }));
  list.push(spec(IMAGES.door1F, 'door', 420, 620, '扉：1Fの大扉（2Fへ）', { variant: '1f' }));
  Object.values(TREASURE_CHESTS).forEach((c) => list.push(spec(c.image, 'chest', 320, 260, `宝箱：${c.name}`, { variant: c.color })));
  list.push(spec(IMAGES.merchant, 'figure', 520, 820, '人物：商人', { variant: 'normal' }));
  list.push(spec(IMAGES.darkMerchant, 'figure', 520, 820, '人物：闇商人', { variant: 'dark' }));
  EVENTS.forEach((e) => e.object && list.push(spec(e.object, 'object', 480, 480, `イベント：${e.title}`, { symbol: e.id === 'whispering_altar' ? '💀' : e.id === 'bloody_box' ? '📦' : '🪖' })));

  // ---- 敵（体型と特徴。見た目のバリエーションを作るための仮の設定） ----
  const ARCH: Record<string, Record<string, unknown>> = {
    rot_rat: { archetype: 'beast' }, crawler: { archetype: 'beast' }, cog_hound: { archetype: 'beast' }, shade_eater: { archetype: 'beast' },
    failed_chimera: { archetype: 'beast' }, boss_twin_hound: { archetype: 'beast', twinHead: true },
    rusted_sentry: { archetype: 'humanoid', armored: true, weapon: true }, empty_armor: { archetype: 'humanoid', armored: true, weapon: true },
    iron_jailer: { archetype: 'humanoid', armored: true }, boss_iron_executioner: { archetype: 'humanoid', armored: true, weapon: true },
    incinerator_keeper: { archetype: 'humanoid', armored: true, weapon: true },
    labcoat_revenant: { archetype: 'humanoid', stitches: true }, praying_corpse: { archetype: 'humanoid' }, specimen7: { archetype: 'humanoid', stitches: true },
    steam_husk: { archetype: 'humanoid' }, hanged_marionette: { archetype: 'humanoid', stitches: true },
    black_zealot: { archetype: 'humanoid', hooded: true }, boss_abyss_priest: { archetype: 'humanoid', hooded: true },
    boss_stitched_nurse: { archetype: 'humanoid', stitches: true }, boss_writhing_researcher: { archetype: 'humanoid', stitches: true },
    candle_wraith: { archetype: 'floating', candle: true }, eye_swarm: { archetype: 'floating', multiEye: true }, boss_belfry_wraith: { archetype: 'floating' },
    choir_heads: { archetype: 'floating', multiHead: true }, boss_dawn_devourer: { archetype: 'blob', multiEye: true },
  };
  ENEMIES.forEach((e) => {
    const kindLabel = e.kind === 'boss' ? `ボス(${e.bossFloor}F)` : e.kind === 'elite' ? '強敵' : '敵';
    const size = e.kind === 'boss' ? [600, 640] : [440, 480];
    list.push(spec(e.image, 'enemy', size[0], size[1], `${kindLabel}：${e.name}`, { id: e.id, kind: e.kind, zone: e.zones[0], archetype: 'blob', ...(ARCH[e.id] ?? {}) }));
  });

  // ---- カード ----
  CARDS.forEach((c) => list.push(spec(c.image, 'cardArt', 480, 450, `カード絵：${c.name}`, { variant: c.element ?? c.type, symbol: CARD_SYMBOL[c.id] ?? '🃏' })));
  for (const [rarity, p] of Object.entries(IMAGES.cardFrame)) list.push(spec(p, 'cardFrame', 440, 616, `カード枠(${rarity})`, { variant: rarity }));
  list.push(spec(IMAGES.cardBack, 'cardBack', 440, 616, 'カード裏面'));
  list.push(spec(IMAGES.cardCostGem, 'costGem', 128, 128, 'カードのコスト宝石'));
  const typeIcon: Record<string, [string, number]> = { attack: ['⚔️', 0], defense: ['🛡️', 215], support: ['✨', 40], buff: ['🔺', 38], debuff: ['🌀', 275], special: ['✴️', 150] };
  for (const [type, p] of Object.entries(IMAGES.cardType)) list.push(spec(p, 'medallionIcon', 96, 96, `カード種別：${type}`, { symbol: typeIcon[type][0], hue: typeIcon[type][1], sat: 70 }));
  const elementIcon: Record<string, [string, number]> = { sword: ['🗡️', 355], magic: ['🔮', 255], blood: ['🩸', 350], curse: ['☠️', 130] };
  for (const [el, p] of Object.entries(IMAGES.cardElement)) list.push(spec(p, 'medallionIcon', 96, 96, `攻撃の系統：${el}`, { symbol: elementIcon[el][0], hue: elementIcon[el][1], sat: 70 }));

  // ---- アイテム・鍵・装備（元の色を活かしたメダリオン） ----
  ITEMS.forEach((i) => list.push(spec(i.image, 'itemIcon', 160, 160, `アイテム：${i.name}`, { symbol: ITEM_SYMBOL[i.id] ?? '🧪', rim: i.rarity === 'legendary' ? 'gold' : i.rarity === 'rare' ? 'silver' : 'bronze', hue: 25 })));
  Object.values(KEYS).forEach((k) => list.push(spec(k.image, 'keyIcon', 128, 128, `鍵：${k.name}`, { variant: k.color })));
  EQUIPMENT.forEach((e) => list.push(spec(e.image, 'itemIcon', 160, 160, `装備：${e.name}`, { symbol: EQUIP_SYMBOL[e.id] ?? '🛡️', rim: e.rarity === 'legendary' ? 'gold' : e.rarity === 'rare' ? 'silver' : 'bronze', hue: e.slot === 'weapon' ? 5 : e.slot === 'armor' ? 215 : 280, mode: 'relief', emblemMetal: e.rarity === 'legendary' ? 'gold' : e.rarity === 'rare' ? 'silver' : 'bronze' })));

  // ---- 状態異常・意図（金の浮き彫りメダリオン） ----
  Object.values(STATUS_EFFECTS).forEach((s) => list.push(spec(s.icon, 'medallionIcon', 72, 72, `状態：${s.name}`, { symbol: STATUS_SYMBOL[s.id], hue: s.polarity === 'buff' ? 35 : 275, sat: 70 })));
  const intents: Record<string, [string, number, string]> = {
    attack: ['⚔️', 0, '意図：攻撃'], debuff: ['🌀', 275, '意図：デバフ'], buff: ['🔺', 38, '意図：バフ'],
    block: ['🛡️', 215, '意図：ブロック'], special: ['✴️', 150, '意図：特殊'], stun: ['🔒', 0, '意図：封印中'],
  };
  for (const [k, p] of Object.entries(IMAGES.intent)) list.push(spec(p, 'medallionIcon', 112, 112, intents[k][2], { symbol: intents[k][0], hue: intents[k][1], sat: k === 'stun' ? 0 : 75, emblemMetal: k === 'stun' ? 'silver' : 'gold' }));

  // ---- UI ----
  const icons: Record<string, [string, string, number]> = {
    gold: ['🪙', 'アイコン：所持金', 40], hp: ['❤️', 'アイコン：HP', 0], ap: ['🔥', 'アイコン：AP', 20], block: ['🛡️', 'アイコン：ブロック', 215], deck: ['🂠', 'アイコン：山札/デッキ', 25],
    discard: ['♻️', 'アイコン：捨て札', 25], exhaust: ['💀', 'アイコン：廃棄', 275], floor: ['🗼', 'アイコン：階', 25], menu: ['⚙️', 'アイコン：メニュー', 25], status: ['📜', 'アイコン：ステータス', 25],
  };
  for (const [k, p] of Object.entries(IMAGES.icon)) {
    if (k === 'gold') list.push(spec(p, 'coin', 96, 96, icons[k][1]));
    else if (k === 'block') list.push(spec(p, 'shield', 96, 96, icons[k][1]));
    else if (k === 'hp') list.push(spec(p, 'medallionIcon', 96, 96, icons[k][1], { symbol: '❤️', hue: 0, sat: 70, emblemMetal: 'ruby', glow: 'rgba(255,40,40,0.8)' }));
    else list.push(spec(p, 'medallionIcon', 96, 96, icons[k][1], { symbol: icons[k][0], hue: icons[k][2], sat: 45 }));
  }
  list.push(spec(IMAGES.apCrystal, 'apCrystal', 96, 128, 'AP クリスタル（点灯）', { variant: 'lit' }));
  list.push(spec(IMAGES.apCrystalEmpty, 'apCrystal', 96, 128, 'AP クリスタル（消灯）', { variant: 'empty' }));
  list.push(spec(IMAGES.endTurn, 'endTurn', 320, 320, 'ターン終了ボタン'));
  list.push(spec(IMAGES.leaderFrame, 'leaderFrame', 400, 400, '主人公の肖像の枠'));
  list.push(spec(IMAGES.leaderPortrait, 'portrait', 320, 320, '主人公の肖像（仮）'));
  list.push(spec(IMAGES.button, 'button', 300, 96, 'ボタン枠', { variant: 'normal' }));
  list.push(spec(IMAGES.buttonPrimary, 'button', 300, 96, 'ボタン枠（強調）', { variant: 'primary' }));
  list.push(spec(IMAGES.panel, 'panel', 512, 512, 'パネル枠'));
  list.push(spec(IMAGES.logo, 'logo', 1200, 300, 'タイトルロゴ'));
  list.push(spec('../favicon.png', 'medallionIcon', 64, 64, 'favicon', { symbol: '🗼', hue: 0, sat: 70 }));

  // 重複除去
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.path) ? false : (seen.add(s.path), true)));
}

async function main() {
  const specs = buildSpecs();
  // data/ にあるのに仕様が無い画像が無いか確認
  const covered = new Set(specs.map((s) => s.path));
  const missing = collectAllImagePaths().filter((p) => !covered.has(p));
  if (missing.length) console.warn('⚠ 仕様が無い画像:', missing);

  const browser = await chromium.launch({ channel: 'msedge', headless: true }).catch(() => chromium.launch({ channel: 'chrome', headless: true }));
  const page = await browser.newPage();
  await page.setContent('<html><body style="margin:0;background:#000"></body></html>');
  await page.addStyleTag({ content: "@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@900&display=swap');" }).catch(() => {});
  await page.addScriptTag({ content: readFileSync(join(ROOT, 'tools', 'placeholder-draw.js'), 'utf8') });
  await page.waitForTimeout(500);

  let made = 0;
  let skipped = 0;
  for (const s of specs) {
    const out = s.path.startsWith('../') ? join(ROOT, 'public', basename(s.path)) : join(OUT, s.path);
    if (existsSync(out) && !FORCE) {
      skipped++;
      continue;
    }
    const dataUrl = await page.evaluate((sp) => (window as any).drawAsset(sp), s);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
    made++;
  }
  await browser.close();
  console.log(`✔ 画像生成: ${made} 枚作成 / ${skipped} 枚スキップ（既存）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
