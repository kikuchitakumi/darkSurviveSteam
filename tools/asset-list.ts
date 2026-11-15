// =============================================================
// asset-list.ts  【ツール：素材一覧（docs/ASSETS.md）を自動生成】
// -------------------------------------------------------------
// 実行: npm run assets:list
//
// 「どの画像/音が、どこで、何に使われているか」を一覧表にする。
// 画像・音声を差し替える担当者（人 or AI）への指示書として使える。
// data/ を元に作るので、カード等を追加したら再実行するだけで最新になる。
// =============================================================
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARDS } from '../src/data/cards';
import { ENEMIES } from '../src/data/enemies';
import { ITEMS, KEYS } from '../src/data/items';
import { EQUIPMENT } from '../src/data/equipment';
import { STATUS_EFFECTS } from '../src/data/statusEffects';
import { TREASURE_CHESTS } from '../src/data/treasures';
import { ZONES, FIRST_FLOOR, ROUTE_VISUALS } from '../src/data/floors';
import { EVENTS } from '../src/data/events';
import { IMAGES } from '../src/data/images';
import { BGM, SE } from '../src/data/audio';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows: { cat: string; path: string; usage: string; size: string }[] = [];
const size = (p: string) => {
  const f = join(ROOT, 'public', 'assets', p);
  return existsSync(f) ? `${Math.round(statSync(f).size / 1024)}KB` : '❌未作成';
};
const add = (cat: string, path: string, usage: string) => rows.push({ cat, path, usage, size: size(path) });

ZONES.forEach((z) => {
  add('背景', z.floorBackground, `探索画面 ZONE${z.zone}「${z.name}」 1920x1080`);
  add('背景', z.battleBackground, `戦闘画面 ZONE${z.zone}「${z.name}」 1920x1080`);
});
add('背景', FIRST_FLOOR.background, '1F 塔の入口 1920x1080');
const bgUsage: Record<string, string> = { titleKeyVisual: 'タイトル画面キービジュアル', statRoll: 'ステータス抽選', treasureRoom: '宝物庫', shop: 'ショップ', darkShop: '闇商人', gameOver: 'ゲームオーバー', clear: 'エンディング' };
for (const [k, u] of Object.entries(bgUsage)) add('背景', (IMAGES as any)[k], `${u} 1920x1080`);
[...new Set(EVENTS.map((e) => e.background))].forEach((b) => add('背景', b, 'イベント 1920x1080'));
Object.entries(ROUTE_VISUALS).forEach(([k, v]) => add('オブジェクト(透過)', v.image, `分かれ道の扉：${v.label}`));
add('オブジェクト(透過)', IMAGES.door1F, '1Fの大扉');
Object.values(TREASURE_CHESTS).forEach((c) => add('オブジェクト(透過)', c.image, c.name));
add('オブジェクト(透過)', IMAGES.merchant, '商人');
add('オブジェクト(透過)', IMAGES.darkMerchant, '闇商人');
EVENTS.forEach((e) => e.object && add('オブジェクト(透過)', e.object, `イベント「${e.title}」`));
ENEMIES.forEach((e) => add('敵(透過)', e.image, `${e.kind === 'boss' ? `ボス ${e.bossFloor}F` : e.kind === 'elite' ? '強敵' : '敵'}：${e.name}（${e.description}）`));
CARDS.forEach((c) => add('カード絵', c.image, `${c.name}：${c.description.replace(/\n/g, ' ')}`));
Object.entries(IMAGES.cardFrame).forEach(([k, p]) => add('UI', p, `カード枠（${k}）`));
add('UI', IMAGES.cardBack, 'カード裏面');
add('UI', IMAGES.button, 'ボタン枠（透過・全ボタン共通）');
add('UI', IMAGES.panel, 'パネル枠');
add('UI', IMAGES.logo, 'タイトルロゴ');
Object.entries(IMAGES.intent).forEach(([k, p]) => add('UI', p, `敵の意図アイコン：${k}`));
Object.entries(IMAGES.icon).forEach(([k, p]) => add('UI', p, `アイコン：${k}`));
Object.values(STATUS_EFFECTS).forEach((s) => add('状態異常アイコン', s.icon, `${s.name}：${s.description}`));
ITEMS.forEach((i) => add('アイテム', i.image, `${i.name}：${i.description}`));
Object.values(KEYS).forEach((k) => add('アイテム', k.image, k.name));
EQUIPMENT.forEach((e) => add('装備', e.image, `${e.name}：${e.description.replace(/\n/g, ' ')}`));
Object.entries(SE).forEach(([k, d]) => add('効果音(SE)', d.file, `${k}：${d.usage}`));
Object.entries(BGM).forEach(([k, d]) => add('BGM', d.file, `${k}：${d.usage}`));

let md = `# 素材一覧（自動生成）

> このファイルは \`npm run assets:list\` で自動生成されます。手で編集しないでください。
> 素材は全て \`public/assets/\` 以下にあります。**同じファイル名で上書きすれば、コードを変えずに差し替わります。**
> 拡張子を変える場合（例: .wav → .mp3）は \`src/data/\` の該当パスも書き換えてください。

| 種類 | ファイル | 用途 | サイズ |
|---|---|---|---|
`;
for (const r of rows) md += `| ${r.cat} | \`${r.path}\` | ${r.usage.replace(/\|/g, '/')} | ${r.size} |\n`;
writeFileSync(join(ROOT, 'docs', 'ASSETS.md'), md);
console.log(`✔ docs/ASSETS.md を生成しました（${rows.length} 件）`);
