// =============================================================
// CardView.ts  【View部品：カード1枚の見た目】
// -------------------------------------------------------------
// カードの DOM を組み立てる。手札・報酬・ショップ・デッキ一覧で共通。
//
//   ┌─────/\─────┐ ← 黒鉄の枠（レア度ごとに縁取りの金属が変わる）
//   ●1   /    \    │ ← コスト（血色のガラス玉）
//   │   │ 挿絵 │   │ ← 尖頭アーチの窓。挿絵は窓の「奥」にある
//   │ ◆═ 一 閃 ═◆ │ ← 名札（両端の宝石は種類の色）
//   │ ┌──────────┐ │
//   │ │印 攻撃・剣│ │ ← 羊皮紙の説明欄（墨の文字・紋章の透かし）
//   │ │ 4のダメージ│ │    数値はステータス込みで計算
//   │ └──────────┘ │
//   └──────◆──────┘ ← レア度の宝石
//
// ■ 3D の仕組み（transform-style: preserve-3d）
//   部品を奥行きの違う層に置き、マウスに合わせてカード全体を傾ける。
//     奥  -14px : カードの厚み（側面）
//         -10px : 挿絵（窓の奥なので、傾けると窓から覗き込むようにずれる）
//          0px : 枠・羊皮紙
//         +1px : 文字・紋章
//        +12px : 名札
//        +22px : コスト
//   手前 +26px : 光の反射
// 枠・名札・コスト・紋章の画像は data/images.ts で管理。
// =============================================================
import { IMAGES } from '@/data/images';
import { t } from '@/i18n';
import type { CardDef } from '@/model/types';
import { asset, h, img } from '../dom';
import { cardDesc, cardName } from '../text';

/**
 * 説明文の {damage} などを数値に置き換え、数値部分を強調表示する
 * @param numbers Combat.cardNumbers() の結果（無ければ素の値）
 */
export function renderDescription(def: CardDef, numbers?: Record<string, number>): HTMLElement {
  const base = baseNumbers(def);
  const nums = numbers ?? base;
  let text = cardDesc(def);
  // 実際の数値が無い時（図鑑・プレビューなど）は、ステータス倍率の値（0）を出さずに括弧ごと省く
  if (!numbers) text = text.replace(/[（(]\{(\w+)\}[）)]/g, (m, k) => (base[k] ? m : ''));
  // 1行あたり約13文字として行数を見積もり、3行以上なら小さめの文字にする
  const lines = text.replace(/\{\w+\}/g, '00').split('\n').reduce((n, seg) => n + Math.max(1, Math.ceil(seg.length / 13)), 0);
  const outer = h(`div.card-desc${lines >= 3 ? '.long' : ''}`);
  const el = h('span.card-desc-inner');
  outer.append(el);
  const parts = text.split(/(\{\w+\})/g);
  for (const p of parts) {
    const m = p.match(/^\{(\w+)\}$/);
    if (m && nums[m[1]] !== undefined) {
      const v = nums[m[1]];
      const b = base[m[1]];
      const cls = b === undefined || v === b ? '' : v > b ? '.num-up' : '.num-down';
      el.append(h(`span.num${cls}`, {}, String(v)));
    } else {
      p.split('\n').forEach((line, i) => {
        if (i > 0) el.append(h('br'));
        el.append(line);
      });
    }
  }
  return outer;
}

/** ステータスを考慮しない素の数値 */
function baseNumbers(def: CardDef): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of def.effects) {
    if (e.kind === 'damage' && out.damage === undefined) { out.damage = e.amount; out.hits = typeof e.hits === 'number' ? e.hits : 1; }
    if (e.kind === 'block' && out.block === undefined) out.block = e.amount;
    if (e.kind === 'heal' && out.heal === undefined) out.heal = e.amount;
    if (e.kind === 'selfDamage' && out.self === undefined) out.self = e.amount;
    if (e.kind === 'status' && e.status === 'curse' && out.curse === undefined) out.curse = e.amount;
  }
  return out;
}

/** 「攻撃・剣」「サポート」「防御 ・ 廃棄」のような種類の表示 */
export function cardTypeLabel(def: CardDef): string {
  const base = t(`cardType.${def.type}` as any) + (def.element ? `・${t(`cardElement.${def.element}` as any)}` : '');
  return base + (def.exhaust ? ` ／ ${t('card.exhaust')}` : '');
}

/** カード要素を作る */
export function createCardEl(def: CardDef, opts: { numbers?: Record<string, number>; uid?: string; small?: boolean; tilt?: boolean } = {}): HTMLElement {
  const typeLabel = cardTypeLabel(def);
  const sigil = def.element ? IMAGES.cardElement[def.element] : IMAGES.cardType[def.type];
  const bg = (path: string) => ({ backgroundImage: `url("${asset(path)}")` });
  const tiltEl = h('div.card-tilt', {}, [
    h('div.card-edge'),
    h('div.card-art', {}, [img(def.image), h('div.card-art-light')]),
    h('div.card-foil'),
    h('div.card-frame', { style: bg(IMAGES.cardFrame[def.rarity]) }),
    h('div.card-watermark', { style: bg(sigil) }),
    h('div.card-type', {}, [img(sigil), h('span', {}, typeLabel)]),
    renderDescription(def, opts.numbers),
    h('div.card-plate', { style: bg(IMAGES.cardPlate[def.rarity]) }, [h('i.plate-gem.l'), h('div.card-name', {}, cardName(def)), h('i.plate-gem.r')]),
    h('div.card-cost', { style: bg(IMAGES.cardCostGem) }, h('span', {}, String(def.cost))),
    h('div.card-glare'),
  ]);
  const el = h(`div.card.type-${def.type}.rarity-${def.rarity}${def.element ? '.element-' + def.element : ''}${def.cost === 'X' ? '.cost-x' : ''}${opts.small ? '.card-small' : ''}`, { dataset: { cardId: def.id, uid: opts.uid ?? '' } }, [tiltEl]);
  if (opts.tilt !== false) enableTilt(el);
  return el;
}

/**
 * マウスの位置に合わせてカードを3Dに傾け、光の反射と影を動かす。
 * CSS 変数を更新するだけなので軽い。
 *   --rx / --ry … 傾き（deg）
 *   --px / --py … マウスの位置（-0.5〜0.5。影の向きに使う）
 *   --mx / --my … 光の位置（%）
 */
export function enableTilt(el: HTMLElement): void {
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.style.setProperty('--rx', `${(0.5 - y) * 18}deg`);
    el.style.setProperty('--ry', `${(x - 0.5) * 20}deg`);
    el.style.setProperty('--px', (x - 0.5).toFixed(3));
    el.style.setProperty('--py', (y - 0.5).toFixed(3));
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    el.classList.add('is-tilting');
  });
  el.addEventListener('pointerleave', () => {
    for (const k of ['--rx', '--ry']) el.style.setProperty(k, '0deg');
    for (const k of ['--px', '--py']) el.style.setProperty(k, '0');
    el.classList.remove('is-tilting');
  });
}

/** 手札のカードのコスト表示を更新（「選択」で下がった時など） */
export function updateCardCost(el: HTMLElement, cost: number, reduced: boolean): void {
  const span = el.querySelector('.card-cost span');
  if (span) span.textContent = String(cost);
  el.classList.toggle('cost-down', reduced);
}

/** 手札のカードの数値だけを更新（筋力などが変わった時） */
export function updateCardNumbers(el: HTMLElement, def: CardDef, numbers: Record<string, number>): void {
  const old = el.querySelector('.card-desc');
  if (old) old.replaceWith(renderDescription(def, numbers));
}
