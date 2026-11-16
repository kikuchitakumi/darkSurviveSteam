// =============================================================
// art-prompts.ts  【ツール：本番イラスト用の AI プロンプト集を生成】
// -------------------------------------------------------------
// 実行: npm run art:prompts  → docs/ART_PROMPTS.md
//
// 現在の画像は全てプログラムで描いた「仮画像」。
// 本番のイラストを画像生成AI（Midjourney / Stable Diffusion / DALL·E /
// Imagen など）で作るための指示文（プロンプト）を、data/ の内容から自動で作る。
//
// ・全素材で同じ「共通スタイル」を先頭に付け、絵柄のブレを防ぐ
// ・敵やカードの名前・説明から、何を描くべきかを英語で組み立てる
// ・サイズ・形式（透過PNG / WebP）・置き場所も一緒に書く
// カードや敵を追加したら、このコマンドを再実行するだけで最新になる。
// =============================================================
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARDS } from '../src/data/cards';
import { ENEMIES } from '../src/data/enemies';
import { ITEMS, KEYS } from '../src/data/items';
import { EQUIPMENT } from '../src/data/equipment';
import { ZONES, FIRST_FLOOR, ROUTE_VISUALS } from '../src/data/floors';
import { TREASURE_CHESTS } from '../src/data/treasures';
import { IMAGES } from '../src/data/images';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- 全素材に共通するスタイル（絵柄を揃えるための土台） ----
const STYLE =
  'premium Japanese digital collectible card game illustration, dark gothic horror fantasy, ' +
  'highly detailed painterly anime-influenced rendering, dramatic cinematic rim lighting, ' +
  'deep shadows with crimson and gold accents, volumetric fog, ornate, ominous atmosphere, 8k, masterpiece';
const NEGATIVE = 'text, watermark, logo, signature, frame, border, blurry, lowres, jpeg artifacts, cartoon, chibi, cute, bright daylight, extra limbs, deformed';
const TRANSPARENT = 'isolated on a plain flat background for easy cutout, full body, centered, no ground';

/** ゾーン（1～5）ごとの色と舞台 */
const ZONE_MOOD: Record<number, string> = {
  1: 'rusted dungeon prison under an ancient tower, damp stone, flickering torches, warm orange light',
  2: 'abandoned bio research laboratory inside a gothic tower, broken specimen tanks, sickly teal-green light',
  3: 'desecrated gothic cathedral chapel, crimson stained glass, melting candles, blood-red light',
  4: 'industrial furnace and clockwork engine hall, giant gears, steam, molten orange glow',
  5: 'eldritch summit of a living flesh tower, pulsating walls, countless eyes, violet abyssal light',
};

/** 敵の見た目のヒント（名前と説明だけでは伝わりにくいものを補足） */
const ENEMY_HINT: Record<string, string> = {
  rot_rat: 'a giant mutated rat with rotting flesh, exposed ribs and glowing red eyes',
  crawler: 'a legless zombie dragging itself on its arms, torn flesh, desperate hungry face',
  rusted_sentry: 'a rusted mechanical knight automaton holding a halberd, glowing red visor slit',
  iron_jailer: 'a hulking prison warden wearing an iron mask, chains wrapped around his arms',
  specimen7: 'a bloated mutated human test subject with surgical stitches and tubes',
  vat_leech: 'a huge pale leech with a circular mouth full of teeth, dripping culture fluid',
  labcoat_revenant: 'a ghostly scientist corpse in a bloodstained lab coat, holding a scalpel',
  failed_chimera: 'a grotesque patchwork chimera of several animals stitched together, out of control',
  praying_corpse: 'a corpse frozen in a praying pose with clasped hands, hollow glowing eyes',
  candle_wraith: 'a floating wraith made of melting candle wax with a burning wick on its head',
  black_zealot: 'a hooded cultist in black robes holding a sacrificial dagger, face hidden in shadow',
  choir_heads: 'a floating cluster of severed heads still singing, eerie mouths open',
  cog_hound: 'a mechanical hound made of gears and flesh, glowing furnace eyes',
  steam_husk: 'a scalded corpse venting hot steam from its cracked skin',
  hanged_marionette: 'a life-size wooden marionette hanging from strings, porcelain cracked face',
  incinerator_keeper: 'a huge armored furnace keeper with a burning chest cavity and a giant shovel',
  shade_eater: 'a shadow beast made of living darkness with a gaping maw',
  eye_swarm: 'a writhing swarm of eyeballs bound together by veins, staring at the viewer',
  empty_armor: 'an empty suit of heroic armor animated by a ghostly glow, holding a greatsword',
  tower_spawn: 'a grotesque spawn born from the tower itself, tentacles and teeth everywhere',
  boss_flesh_warden: 'a colossal mass of fused flesh and bone guarding a gate, many eyes, huge maw',
  boss_stitched_nurse: 'a tall nightmarish nurse with stitched mouth, holding giant syringes and scalpels',
  boss_writhing_researcher: 'a head researcher whose body splits open with writhing tentacles, cracked glasses',
  boss_twin_hound: 'a gigantic two-headed hellhound with burning eyes and spiked back',
  boss_belfry_wraith: 'a ghost bound to a giant cathedral bell, tattered shroud, tolling death',
  boss_parasite_mother: 'a bloated parasite queen laying eggs, spores drifting around her',
  boss_iron_executioner: 'a towering executioner in iron armor dragging an enormous bloody cleaver',
  boss_abyss_priest: 'a high priest of the abyss in ornate black and gold robes, eldritch halo',
  boss_tower_heart: 'a gigantic beating heart grown into the tower walls, pumping blood through veins',
  boss_dawn_devourer: 'a cosmic horror that devours the dawn, black sun halo, countless eyes, final boss',
};

const CARD_HINT: Record<string, string> = {
  block: 'a battered steel shield raised against monstrous claws, sparks',
  iron_wall: 'a towering wall of iron plates with glowing runes forming a barrier',
  steadfast: 'a lone knight planted firmly behind a great shield, unbreakable resolve, golden aura',
  rally: 'a warrior roaring with a blazing red aura, veins glowing, power surging',
  rest: 'a survivor resting by a small campfire in the dark tower, bandaged wounds',
  prayer: 'hands clasped in prayer bathed in pale holy light in a ruined chapel',
  inspiration: 'a sudden spark of insight, a glowing card appearing from darkness',
  blessing: 'two glowing cards descending from a soft divine light',
  dark_blessing: 'three cards rising from a swirling black void, sinister blessing',
  retaliate: 'a bloodied hand striking back, mirror of the enemy blow',
  pride: 'a battered crown on a blade, defiant pride, golden light',
  scheme: 'a puppeteer hand pulling spider-silk strings over a monster',
  trickery: 'a sly masked rogue flipping a dagger between fingers',
  blood_price: 'a dagger cutting a palm over an altar, blood empowering a weapon',
  tit_for_tat: 'a cracked scale of judgment, retaliation, mirrored strike',
  selection: 'a hand choosing one card from a fan of cards, one card glowing',
  stone_throw: 'a jagged rock hurled through the air in a dark corridor',
  fury: 'an explosion of rage, blazing fists, chain of strikes',
  issen: 'a single flash of a katana slash cutting through darkness, motion streak',
  bone_breaker: 'a brutal heavy blade crushing bone, shockwave',
  triple_slash: 'three crossing blade slashes in rapid succession, afterimages',
  lethal_blow: 'a deadly finishing strike, a giant blade descending under a red moon',
  lion_dance: 'a whirlwind of sword strikes forming the shape of a roaring lion',
  armor_break: 'a war hammer shattering a monster’s armor plates',
  black_flame: 'a ball of black flame burning with violet edges',
  inferno: 'a raging inferno erupting from a magic circle',
  flame_vortex: 'a spiraling vortex of fire',
  underworld_flame: 'pale blue flames of the underworld rising from cracks in the ground',
  ashes: 'a storm of burning embers and ash consuming everything',
  will_o_wisp: 'floating ghostly will-o-wisps melting a shield',
  blood_flash: 'a crimson blade slash trailing droplets of blood',
  crimson_slash: 'a massive arc of blood-red energy, self-sacrifice',
  corpse_pile: 'a mountain of corpses, a vengeful spirit rising from it',
  curse_flame: 'a cursed green-black candle flame marking a victim',
  death_curse: 'a skull-shaped curse sigil wrapping around a monster',
  grudge: 'a giant bloodshot eye filled with years of hatred, dark tendrils',
};

function section(title: string, desc: string): string {
  return `\n## ${title}\n\n${desc}\n\n| ファイル | サイズ・形式 | 内容 | プロンプト（英語） |\n|---|---|---|---|\n`;
}
const row = (file: string, size: string, what: string, prompt: string) => `| \`public/assets/${file}\` | ${size} | ${what} | ${prompt.replace(/\|/g, '/')} |\n`;

let md = `# 本番イラスト用 AI プロンプト集（自動生成）

> \`npm run art:prompts\` で自動生成されます。カード・敵を追加したら再実行してください。

## 使い方
1. 下の表から作りたい素材を選び、**プロンプト（英語）** を画像生成AIに入力します。
2. どの素材にも **共通スタイル** と **ネガティブプロンプト** を付けてください（絵柄が揃います）。
3. 出来た画像を **表のファイル名で上書き保存** すれば、コードを変えずにゲームに反映されます。
4. 透過が必要な素材（敵・人物・扉・宝箱・アイコン）は、生成後に背景を削除してください
   （例：remove.bg、Photoshop の「背景を削除」、rembg など）。

### 共通スタイル（全プロンプトの先頭に付ける）
\`\`\`
${STYLE}
\`\`\`

### ネガティブプロンプト（対応しているツールの場合）
\`\`\`
${NEGATIVE}
\`\`\`

### 絵柄を揃えるコツ
- 最初に気に入った1枚（例：1Fの背景やボス）を作り、以降は **その画像をスタイル参照**（Midjourney の \`--sref\`、Stable Diffusion の IP-Adapter など）に使う。
- 同じツール・同じモデル・同じアスペクト比で作る。
- 文字は入れない（ゲーム内で表示するため）。
- 推奨形式：背景＝**WebP**（1920x1080）、それ以外の透過素材＝**PNG**。
`;

// ---- 背景 ----
md += section('背景（1920x1080 / WebP）', '画面全体に表示されます。中央下は敵やメッセージ窓が重なるので、主役は上半分〜左右に置くと見やすくなります。');
md += row(IMAGES.titleKeyVisual, '1920x1080 WebP', 'タイトル画面', `${STYLE}, key visual of an impossibly tall dark tower piercing a blood-red moonlit sky, lightning, crows, dead trees, lone survivor silhouette at the base, epic composition, empty space in the center for the title logo`);
md += row(FIRST_FLOOR.background, '1920x1080 WebP', '1F 塔の入口', `${STYLE}, interior of a colossal gothic tower entrance hall, a huge sealed door at the far end, torches, dust in light beams, first-person view`);
ZONES.forEach((z) => {
  md += row(z.floorBackground, '1920x1080 WebP', `探索 ZONE${z.zone}`, `${STYLE}, ${ZONE_MOOD[z.zone]}, wide gothic hallway with two side passages, first-person view, environment concept art, no characters`);
  md += row(z.battleBackground, '1920x1080 WebP', `戦闘 ZONE${z.zone}`, `${STYLE}, ${ZONE_MOOD[z.zone]}, open battle arena area inside the tower, clear floor space in the center, first-person view, environment concept art, no characters`);
});
md += row(IMAGES.treasureRoom, '1920x1080 WebP', '宝物庫', `${STYLE}, hidden treasury vault inside the tower, piles of gold coins, dusty relics, golden light`);
md += row(IMAGES.shop, '1920x1080 WebP', 'ショップ', `${STYLE}, a cramped merchant's den in the tower, shelves of potions and weapons, warm lantern light`);
md += row(IMAGES.darkShop, '1920x1080 WebP', '闇商人', `${STYLE}, a forbidden black market in the tower, cursed artifacts, eerie violet light, occult symbols`);
md += row(IMAGES.statRoll, '1920x1080 WebP', 'ステータス抽選', `${STYLE}, a ritual chamber with a glowing red magic circle on the floor, fate and destiny theme`);
md += row(IMAGES.gameOver, '1920x1080 WebP', 'ゲームオーバー', `${STYLE}, aftermath of death in the dark tower, blood pool, fallen weapon, crimson fog`);
md += row(IMAGES.clear, '1920x1080 WebP', 'エンディング', `${STYLE}, sunrise breaking through the clouds above the tower summit, hope after the nightmare, golden dawn light`);
md += row('images/bg/bg_event.webp', '1920x1080 WebP', 'イベント', `${STYLE}, a quiet dark alcove in the tower with an old altar, candles, mysterious atmosphere`);

// ---- 敵 ----
md += section('敵・強敵・ボス（透過 PNG）', '縦長の構図で、足元が画像の下端に来るように。ボスは迫力のある大きめの構図に。');
ENEMIES.forEach((e) => {
  const kind = e.kind === 'boss' ? `final boss-class monster for floor ${e.bossFloor}, imposing scale` : e.kind === 'elite' ? 'elite monster, menacing' : 'monster';
  const zone = ZONE_MOOD[e.zones[0]].split(',')[0];
  md += row(e.image, e.kind === 'boss' ? '1200x1280 PNG（透過）' : '880x960 PNG（透過）', `${e.name}：${e.description}`, `${STYLE}, ${kind}, ${ENEMY_HINT[e.id] ?? e.description}, creature of the ${zone}, facing the viewer, ${TRANSPARENT}`);
});

// ---- カード ----
md += section('カードのイラスト（PNG 960x900）', 'カード枠のイラスト窓（縦横ほぼ同じ比率）に表示されます。中央に主題を大きく。');
CARDS.forEach((c) => {
  md += row(c.image, '960x900 PNG', `${c.name}：${c.description.replace(/\n/g, ' ')}`, `${STYLE}, card art, ${CARD_HINT[c.id] ?? c.name}, dynamic composition, centered subject`);
});

// ---- 人物・オブジェクト ----
md += section('人物・オブジェクト（透過 PNG）', '');
md += row(IMAGES.leaderPortrait, '640x640 PNG', '主人公の肖像（丸く切り抜かれます）', `${STYLE}, portrait bust of a hooded lone survivor with a scarred face, determined eyes, lit from below by lantern light, centered face`);
md += row(IMAGES.merchant, '1040x1640 PNG（透過）', '商人', `${STYLE}, a mysterious hooded merchant holding a lantern, only glowing eyes visible, long cloak, ${TRANSPARENT}`);
md += row(IMAGES.darkMerchant, '1040x1640 PNG（透過）', '闇商人', `${STYLE}, a sinister black-market dealer with many glowing violet eyes under the hood, cursed trinkets on the cloak, ${TRANSPARENT}`);
Object.entries(ROUTE_VISUALS).forEach(([k, v]) => {
  md += row(v.image, '720x1120 PNG（透過）', `扉：${v.label}`, `${STYLE}, a heavy gothic pointed-arch wooden double door with iron bands, a glowing ${k} sigil emblem above it, light leaking through the gap, front view, ${TRANSPARENT}`);
});
md += row(IMAGES.door1F, '840x1240 PNG（透過）', '1Fの大扉', `${STYLE}, a colossal ancient tower gate door, carved stone arch, front view, ${TRANSPARENT}`);
Object.values(TREASURE_CHESTS).forEach((c) => {
  md += row(c.image, '640x520 PNG（透過）', c.name, `${STYLE}, an ornate ${c.color} treasure chest with gold trim and a gemstone lock, front view, ${TRANSPARENT}`);
});

// ---- アイコン ----
md += section('アイテム・装備のアイコン（透過 PNG 320x320）', '小さく表示されるので、形がはっきり分かるシルエットに。');
ITEMS.forEach((i) => (md += row(i.image, '320x320 PNG（透過）', `${i.name}：${i.description}`, `${STYLE}, game item icon, ${i.name} (${i.description}), single object, centered, ${TRANSPARENT}`)));
Object.values(KEYS).forEach((k) => (md += row(k.image, '256x256 PNG（透過）', k.name, `${STYLE}, game item icon, an ornate antique ${k.color} gemstone key, single object, centered, ${TRANSPARENT}`)));
EQUIPMENT.forEach((e) => (md += row(e.image, '320x320 PNG（透過）', `${e.name}：${e.description.replace(/\n/g, ' ')}`, `${STYLE}, game equipment icon, ${e.name}, ${e.slot}, single object, centered, ${TRANSPARENT}`)));

md += `
## UI部品について
カード枠・ボタン・パネル・宝石・メダリオンなどの **UI部品** は、プログラムで高品質に生成しています
（\`tools/placeholder-draw.js\`）。AIで作り直す場合は、**透過PNG・同じサイズ・同じ透明部分の位置** を守ってください。
特にカード枠は「イラスト窓が透明」「説明欄が半透明」である必要があります。サイズと用途は \`docs/ASSETS.md\` を参照。
`;

writeFileSync(join(ROOT, 'docs', 'ART_PROMPTS.md'), md);
console.log('✔ docs/ART_PROMPTS.md を生成しました');
