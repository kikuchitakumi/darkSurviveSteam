// =============================================================
// i18n-check.ts  【ツール：未翻訳の文言を一覧表示】
// -------------------------------------------------------------
// 実行: npm run i18n:check
//
// 日本語（基準）にあって英語(en.ts)に無いキーを一覧にする。
// データ（カード・敵・アイテム…）の翻訳漏れもチェックする。
// 出力された一覧を翻訳AIに渡し、結果を en.ts に貼り付ければ翻訳完了。
// =============================================================
import { ja } from '../src/i18n/ja';
import { en } from '../src/i18n/en';
import { CARDS } from '../src/data/cards';
import { ENEMIES } from '../src/data/enemies';
import { ITEMS } from '../src/data/items';
import { EQUIPMENT } from '../src/data/equipment';
import { STATUS_EFFECTS } from '../src/data/statusEffects';
import { EVENTS } from '../src/data/events';

const missing: [string, string][] = [];
const need = (key: string, jaText: string) => {
  if (!(key in en)) missing.push([key, jaText]);
};

for (const [k, v] of Object.entries(ja)) need(k, v);
CARDS.forEach((c) => { need(`card.${c.id}.name`, c.name); need(`card.${c.id}.description`, c.description); });
ENEMIES.forEach((e) => { need(`enemy.${e.id}.name`, e.name); need(`enemy.${e.id}.description`, e.description); });
ITEMS.forEach((i) => { need(`item.${i.id}.name`, i.name); need(`item.${i.id}.description`, i.description); });
EQUIPMENT.forEach((e) => { need(`equipment.${e.id}.name`, e.name); need(`equipment.${e.id}.description`, e.description); });
Object.values(STATUS_EFFECTS).forEach((s) => { need(`status.${s.id}.name`, s.name); need(`status.${s.id}.description`, s.description); });
EVENTS.filter((e) => e.enabled).forEach((e) => {
  need(`event.${e.id}.title`, e.title);
  e.text.forEach((t, i) => need(`event.${e.id}.text${i}`, t));
  e.choices.forEach((c, i) => {
    need(`event.${e.id}.choice${i}`, c.label);
    need(`event.${e.id}.result${i}`, c.success.text);
    if (c.failure) need(`event.${e.id}.result${i}f`, c.failure.text);
  });
});

const total = Object.keys(ja).length;
console.log(`UI文言: ${total - missing.filter(([k]) => k in ja).length}/${total} 翻訳済み`);
console.log(`未翻訳: ${missing.length} 件\n`);
console.log('// ↓ en.ts に貼り付けて英訳を書き込んでください');
for (const [k, v] of missing) console.log(`  '${k}': ${JSON.stringify(v)},`);
