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
  strike: '🗡️', defend: '🛡️', seal: '📜', rage: '💢', scavenge: '♻️', executioner: '🪓', flurry: '⚔️', shotgun: '💥',
  hellfire: '🔥', iron_wall: '🧱', toxic_mist: '☣️', terror: '👻', adrenaline: '💉', blood_pact: '🩸', first_aid: '🩹',
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

  // ---- 敵 ----
  ENEMIES.forEach((e) => {
    const kindLabel = e.kind === 'boss' ? `ボス(${e.bossFloor}F)` : e.kind === 'elite' ? '強敵' : '敵';
    const size = e.kind === 'boss' ? [600, 640] : [440, 480];
    list.push(spec(e.image, 'enemy', size[0], size[1], `${kindLabel}：${e.name}`, { id: e.id, kind: e.kind, zone: e.zones[0] }));
  });

  // ---- カード ----
  CARDS.forEach((c) => list.push(spec(c.image, 'cardArt', 400, 240, `カード絵：${c.name}`, { variant: c.type, symbol: CARD_SYMBOL[c.id] ?? '🃏' })));
  for (const [type, p] of Object.entries(IMAGES.cardFrame)) list.push(spec(p, 'cardFrame', 440, 616, `カード枠(${type})`, { variant: type }));
  list.push(spec(IMAGES.cardBack, 'cardBack', 220, 308, 'カード裏面'));

  // ---- アイテム・鍵・装備 ----
  ITEMS.forEach((i) => list.push(spec(i.image, 'icon', 160, 160, `アイテム：${i.name}`, { symbol: ITEM_SYMBOL[i.id] ?? '🧪', short: i.name })));
  const keyTint: Record<string, string> = { red: 'rgba(255,60,60,0.55)', blue: 'rgba(60,120,255,0.55)', yellow: 'rgba(255,220,40,0.5)', green: 'rgba(60,220,100,0.5)' };
  Object.values(KEYS).forEach((k) => list.push(spec(k.image, 'icon', 128, 128, `鍵：${k.name}`, { symbol: '🗝️', tint: keyTint[k.color], short: k.name, circle: false })));
  EQUIPMENT.forEach((e) => list.push(spec(e.image, 'icon', 160, 160, `装備：${e.name}`, { symbol: EQUIP_SYMBOL[e.id] ?? '🛡️', short: e.name, ring: e.rarity === 'legendary' ? '#ffe28a' : e.rarity === 'rare' ? '#6fb3ff' : undefined })));

  // ---- 状態異常・意図 ----
  Object.values(STATUS_EFFECTS).forEach((s) => list.push(spec(s.icon, 'icon', 64, 64, `状態：${s.name}`, { symbol: STATUS_SYMBOL[s.id], bg: s.polarity === 'buff' ? 'rgba(120,80,10,0.95)' : 'rgba(70,20,110,0.95)' })));
  const intents: Record<string, [string, string, string]> = {
    attack: ['⚔️', 'rgba(140,10,10,0.95)', '意図：攻撃'], debuff: ['🌀', 'rgba(70,20,110,0.95)', '意図：デバフ'], buff: ['🔺', 'rgba(140,90,10,0.95)', '意図：バフ'],
    block: ['🛡️', 'rgba(20,60,120,0.95)', '意図：ブロック'], special: ['✴️', 'rgba(20,90,50,0.95)', '意図：特殊'], stun: ['🔒', 'rgba(60,60,60,0.95)', '意図：封印中'],
  };
  for (const [k, p] of Object.entries(IMAGES.intent)) list.push(spec(p, 'icon', 96, 96, intents[k][2], { symbol: intents[k][0], bg: intents[k][1] }));

  // ---- UI ----
  const icons: Record<string, [string, string]> = {
    gold: ['🪙', 'アイコン：所持金'], hp: ['❤️', 'アイコン：HP'], ap: ['🔥', 'アイコン：AP'], block: ['🛡️', 'アイコン：ブロック'], deck: ['🂠', 'アイコン：山札/デッキ'],
    discard: ['🗑️', 'アイコン：捨て札'], exhaust: ['💀', 'アイコン：廃棄'], floor: ['🗼', 'アイコン：階'], menu: ['⚙️', 'アイコン：メニュー'], status: ['📊', 'アイコン：ステータス'],
  };
  for (const [k, p] of Object.entries(IMAGES.icon)) list.push(spec(p, 'icon', 96, 96, icons[k][1], { symbol: icons[k][0], circle: k === 'block' ? false : true }));
  list.push(spec(IMAGES.button, 'button', 600, 120, 'ボタン枠'));
  list.push(spec(IMAGES.panel, 'panel', 800, 600, 'パネル枠'));
  list.push(spec(IMAGES.logo, 'logo', 1200, 300, 'タイトルロゴ'));
  list.push(spec('../favicon.png', 'icon', 64, 64, 'favicon', { symbol: '🗼', bg: 'rgba(100,0,0,0.95)' }));

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
