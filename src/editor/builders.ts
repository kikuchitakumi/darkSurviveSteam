// =============================================================
// builders.ts  【開発メニュー：効果・行動・結果の組み立て】
// -------------------------------------------------------------
// カードの効果 / 敵の行動の効果 / イベントの結果 を、
// プルダウンと数値入力だけで組み立てられるようにする。
// 種類ごとに「どの入力欄を出すか」を下の表（スキーマ）で決めている。
// 新しい効果の種類をプログラムに追加した時は、ここにも1行足す。
// =============================================================
import { STATUS_EFFECTS } from '@/data/statusEffects';
import { CARDS } from '@/data/cards';
import { ENEMIES } from '@/data/enemies';
import { ITEMS } from '@/data/items';
import { EQUIPMENT } from '@/data/equipment';
import type { Effect, EnemyEffect, EventOutcome, ValueSource } from '@/model/types';
import { EFFECT_KINDS, STAT_KEYS } from '@/model/types';
import { h } from '@/view/dom';
import { check, field, type FormCtx, listBuilder, num, row, select } from './forms';

// -------------------------------------------------------------
// 表示名
// -------------------------------------------------------------
export const EFFECT_LABEL: Record<Effect['kind'], string> = {
  damage: 'ダメージ',
  block: 'シールド',
  status: '状態を付与',
  draw: 'カードを引く',
  exhaustChoice: '手札を選んで廃棄',
  reduceCostChoice: '手札を選んでコスト軽減（戦闘中）',
  gainAp: 'AP を得る（このターン）',
  maxAp: '最大AP を上げる（戦闘中）',
  heal: 'HP 回復',
  selfDamage: '自分にダメージ',
  breakBlock: '敵のシールドを減らす',
  stun: '敵の行動をキャンセル',
  healPercent: '最大HPの割合で回復',
};

export const SOURCE_LABEL: Record<ValueSource, string> = {
  none: 'なし（固定値）',
  atk: '攻撃力',
  mag: '魔力',
  def: '防御力',
  cardsPlayedTurn: 'このターン使ったカード数',
  damageTakenTurn: 'このターン受けたダメージ',
  hpLostBattle: '戦闘中に減ったHP',
  turn: '現在のターン数',
};

const SOURCES = Object.entries(SOURCE_LABEL) as [ValueSource, string][];
const STATUSES = Object.values(STATUS_EFFECTS).map((s) => [s.id, s.name] as [string, string]);

/** カードの効果ごとに出す入力欄 */
const EFFECT_FIELDS: Record<Effect['kind'], string[]> = {
  damage: ['formula', 'hits', 'targetEnemy'],
  block: ['formula'],
  status: ['status', 'formula', 'targetAny'],
  draw: ['amount'],
  exhaustChoice: ['amount'],
  reduceCostChoice: ['amount'],
  gainAp: ['amount'],
  maxAp: ['amount'],
  heal: ['formula'],
  selfDamage: ['formula'],
  breakBlock: ['percent', 'targetEnemy2'],
  stun: ['targetEnemy2'],
  healPercent: ['percent'],
};

/** 計算式（固定値 + 倍率 × もと × X）の入力欄 */
function formulaFields(ctx: FormCtx, e: any): HTMLElement {
  if (e.amount === undefined) e.amount = 0;
  return row(
    field('固定値', num(ctx, e, 'amount', { required: true })),
    field('＋ 倍率', num(ctx, e, 'mult', { step: 0.5, placeholder: '1' })),
    field('× もと', select(ctx, e, 'scale', SOURCES, { empty: '（既定）' })),
    check(ctx, e, 'xMult', '× X（Xコスト）'),
  );
}

/** カードの効果1件分の入力欄 */
function effectRow(ctx: FormCtx, e: any): HTMLElement {
  const parts: HTMLElement[] = [field('種類', select(ctx, e, 'kind', EFFECT_KINDS.map((k) => [k, EFFECT_LABEL[k]] as [string, string]), { rerender: true }))];
  for (const f of EFFECT_FIELDS[e.kind as Effect['kind']] ?? []) {
    if (f === 'formula') parts.push(formulaFields(ctx, e));
    if (f === 'amount') {
      if (e.amount === undefined) e.amount = 1;
      parts.push(field('数', num(ctx, e, 'amount', { required: true })));
    }
    if (f === 'percent') {
      if (e.percent === undefined) e.percent = 50;
      parts.push(field('割合(%)', num(ctx, e, 'percent', { required: true })));
    }
    if (f === 'hits') {
      const opts: [string, string][] = [['', '1回'], ...[2, 3, 4, 5, 6].map((n) => [String(n), `${n}回`] as [string, string]), ['X', 'X回（Xコスト）']];
      const el = h<'select'>('select.ed-input', {}, opts.map(([v, l]) => h<'option'>('option', { value: v }, l)));
      el.value = e.hits === undefined ? '' : String(e.hits);
      el.addEventListener('change', () => {
        if (el.value === '') delete e.hits;
        else e.hits = el.value === 'X' ? 'X' : Number(el.value);
        ctx.changed();
      });
      parts.push(field('回数', el));
    }
    if (f === 'status') {
      if (!e.status) e.status = 'weak';
      parts.push(field('状態', select(ctx, e, 'status', STATUSES as any)));
    }
    if (f === 'targetEnemy') parts.push(field('対象', select(ctx, e, 'target', [['target', '選んだ敵'], ['all', '敵全体'], ['random', 'ランダムな敵']], { empty: '（選んだ敵）' })));
    if (f === 'targetEnemy2') parts.push(field('対象', select(ctx, e, 'target', [['target', '選んだ敵'], ['all', '敵全体']], { empty: '（選んだ敵）' })));
    if (f === 'targetAny') parts.push(field('対象', select(ctx, e, 'target', [['target', '選んだ敵'], ['all', '敵全体'], ['self', '自分']], { empty: '（選んだ敵）' })));
  }
  return h('div.ed-effect', {}, parts);
}

/** カードの効果リスト */
export function cardEffectsBuilder(ctx: FormCtx, effects: Effect[]): HTMLElement {
  return listBuilder(ctx, effects as any[], (e) => effectRow(ctx, e), () => ({ kind: 'damage', amount: 0, scale: 'atk', mult: 1 }), {
    addLabel: '効果を追加',
    itemTitle: (e: any, i) => `効果 ${i + 1}：${EFFECT_LABEL[e.kind as Effect['kind']] ?? e.kind}`,
  });
}

// -------------------------------------------------------------
// 敵の行動
// -------------------------------------------------------------
const ENEMY_EFFECT_LABEL: Record<EnemyEffect['kind'], string> = { attack: '攻撃', block: 'シールド', status: '状態を付与', heal: '回復', summon: '仲間を呼ぶ' };

function enemyEffectRow(ctx: FormCtx, e: any): HTMLElement {
  const parts: HTMLElement[] = [field('種類', select(ctx, e, 'kind', Object.entries(ENEMY_EFFECT_LABEL) as [string, string][], { rerender: true }))];
  if (e.kind === 'attack') {
    if (e.amount === undefined) e.amount = 5;
    parts.push(row(field('威力(1F相当)', num(ctx, e, 'amount', { required: true })), field('回数', num(ctx, e, 'hits', { min: 1, placeholder: '1' }))));
  }
  if (e.kind === 'block' || e.kind === 'heal') {
    if (e.amount === undefined) e.amount = 5;
    parts.push(row(field('量(1F相当)', num(ctx, e, 'amount', { required: true })), field('対象', select(ctx, e, 'target', [['self', '自分'], ['allAllies', '敵全員']], { empty: '（自分）' }))));
  }
  if (e.kind === 'status') {
    if (!e.status) e.status = 'weak';
    if (e.amount === undefined) e.amount = 1;
    if (!e.target) e.target = 'player';
    parts.push(row(field('状態', select(ctx, e, 'status', STATUSES as any)), field('量', num(ctx, e, 'amount', { required: true })), field('対象', select(ctx, e, 'target', [['player', '主人公'], ['self', '自分'], ['allAllies', '敵全員']]))));
  }
  if (e.kind === 'summon') {
    if (!e.enemyId) e.enemyId = ENEMIES[0]?.id;
    parts.push(field('呼ぶ敵', select(ctx, e, 'enemyId', ENEMIES.map((x) => [x.id, `${x.name}（${x.id}）`] as [string, string]))));
  }
  return h('div.ed-effect', {}, parts);
}

export function enemyActionsBuilder(ctx: FormCtx, actions: any[]): HTMLElement {
  return listBuilder(ctx, actions, (a) => {
    if (!a.effects) a.effects = [];
    return h('div', {}, [
      row(
        field('ID', textInput(ctx, a, 'id')),
        field('行動名', textInput(ctx, a, 'name')),
        field('意図', select(ctx, a, 'intent', [['attack', '攻撃'], ['debuff', 'デバフ'], ['buff', 'バフ'], ['block', 'ブロック'], ['special', '特殊']])),
        field('重み', num(ctx, a, 'weight', { min: 0, placeholder: '1' })),
      ),
      listBuilder(ctx, a.effects, (e) => enemyEffectRow(ctx, e), () => ({ kind: 'attack', amount: 5 }), { addLabel: '効果を追加', itemTitle: (e: any) => ENEMY_EFFECT_LABEL[e.kind as EnemyEffect['kind']] ?? e.kind }),
    ]);
  }, () => ({ id: `act${actions.length + 1}`, name: '攻撃', intent: 'attack', effects: [{ kind: 'attack', amount: 5 }] }), {
    addLabel: '行動を追加',
    itemTitle: (a: any, i) => `行動 ${i + 1}：${a.name ?? ''}`,
  });
}

function textInput(ctx: FormCtx, obj: any, key: string): HTMLInputElement {
  const el = h<'input'>('input.ed-input', { type: 'text', value: obj[key] ?? '' });
  el.addEventListener('input', () => {
    obj[key] = el.value;
    ctx.changed();
  });
  return el;
}

// -------------------------------------------------------------
// イベントの結果
// -------------------------------------------------------------
const OUTCOME_LABEL: Record<EventOutcome['kind'], string> = {
  gold: 'お金', heal: 'HP回復', damage: 'ダメージ', exp: '経験値', card: 'カードを得る', randomCard: 'ランダムなカード',
  item: 'アイテム', key: '鍵', equipment: '装備品', stat: 'ステータス増減', battle: '戦闘になる', nothing: '何もなし',
};

function outcomeRow(ctx: FormCtx, o: any): HTMLElement {
  const parts: HTMLElement[] = [field('結果', select(ctx, o, 'kind', Object.entries(OUTCOME_LABEL) as [string, string][], { rerender: true }))];
  if (['gold', 'heal', 'damage', 'exp'].includes(o.kind)) {
    if (o.amount === undefined) o.amount = 20;
    parts.push(field('量', num(ctx, o, 'amount', { required: true })));
  }
  if (o.kind === 'card') {
    if (!o.cardId) o.cardId = CARDS[0]?.id;
    parts.push(field('カード', select(ctx, o, 'cardId', CARDS.map((c) => [c.id, c.name] as [string, string]))));
  }
  if (o.kind === 'item') {
    if (!o.itemId) o.itemId = ITEMS[0]?.id;
    parts.push(field('アイテム', select(ctx, o, 'itemId', ITEMS.map((c) => [c.id, c.name] as [string, string]))));
  }
  if (o.kind === 'equipment') {
    if (!o.equipmentId) o.equipmentId = EQUIPMENT[0]?.id;
    parts.push(field('装備', select(ctx, o, 'equipmentId', EQUIPMENT.map((c) => [c.id, c.name] as [string, string]))));
  }
  if (o.kind === 'key') {
    if (!o.color) o.color = 'random';
    parts.push(field('色', select(ctx, o, 'color', [['random', 'ランダム'], ['red', '赤'], ['blue', '青'], ['yellow', '黄'], ['green', '緑']])));
  }
  if (o.kind === 'stat') {
    if (!o.stat) o.stat = 'atk';
    if (o.amount === undefined) o.amount = 1;
    parts.push(row(field('ステータス', select(ctx, o, 'stat', STAT_KEYS.map((k) => [k, { hp: '体力', atk: '攻撃力', def: '防御力', mag: '魔力', luk: '運' }[k]] as [string, string]))), field('増減', num(ctx, o, 'amount', { required: true }))));
  }
  if (o.kind === 'battle') parts.push(check(ctx, o, 'elite', '強敵との戦闘'));
  return h('div.ed-effect', {}, parts);
}

export function outcomesBuilder(ctx: FormCtx, outcomes: EventOutcome[]): HTMLElement {
  return listBuilder(ctx, outcomes as any[], (o) => outcomeRow(ctx, o), () => ({ kind: 'gold', amount: 20 }), {
    addLabel: '結果を追加',
    itemTitle: (o: any) => OUTCOME_LABEL[o.kind as EventOutcome['kind']] ?? o.kind,
  });
}

// -------------------------------------------------------------
// 説明文の自動生成（カード）
// -------------------------------------------------------------
function formulaText(e: any, unit: string): string {
  const scale: ValueSource | undefined = e.scale;
  const mult = e.mult ?? 1;
  const x = e.xMult ? 'X' : '';
  if (!scale || scale === 'none') return `${e.amount}${unit}`;
  const base = `${SOURCE_LABEL[scale]}×${mult === 1 && x ? '' : mult}${x}`;
  return `${e.amount ? `${e.amount}＋` : ''}${base}（{${unit}}）`;
}

/** 効果から説明文の下書きを作る（{damage} などの数値の置き換え記号つき） */
export function describeEffects(effects: Effect[], exhaust?: boolean): string {
  const lines: string[] = [];
  for (const e of effects as any[]) {
    switch (e.kind) {
      case 'damage': {
        const tgt = e.target === 'all' ? '敵全体に' : e.target === 'random' ? 'ランダムな敵に' : '';
        const hits = e.hits === 'X' ? 'を X 回' : e.hits > 1 ? 'を {hits} 回' : '';
        lines.push(`${tgt}${formulaText(e, 'damage').replace('{damage}', '{damage}')} のダメージ${hits}。`);
        break;
      }
      case 'block': lines.push(`${formulaText(e, 'block')} のシールドを得る。`); break;
      case 'heal': lines.push(`HP を ${formulaText(e, 'heal')} 回復する。`); break;
      case 'selfDamage': lines.push(`自分に {self} ダメージ。`); break;
      case 'status': {
        const name = STATUS_EFFECTS[e.status as keyof typeof STATUS_EFFECTS]?.name ?? e.status;
        const who = e.target === 'self' ? '自分に' : e.target === 'all' ? '敵全体に' : '';
        lines.push(`${who}${name}を ${e.status === 'curse' ? formulaText(e, 'curse') : e.amount} 付与する。`);
        break;
      }
      case 'draw': lines.push(`カードを${e.amount}枚引く。`); break;
      case 'exhaustChoice': lines.push(`手札を${e.amount}枚選んで廃棄する。`); break;
      case 'reduceCostChoice': lines.push(`手札を1枚選ぶ。この戦闘中、そのコストを -${e.amount} する。`); break;
      case 'gainAp': lines.push(`AP を ${e.amount} 得る。`); break;
      case 'maxAp': lines.push(`この戦闘中、行動値（AP）を${e.amount}上昇させる。`); break;
      case 'breakBlock': lines.push(`敵のシールドを ${e.percent}% 下げる。`); break;
      case 'stun': lines.push('相手の行動を1回キャンセルする。'); break;
      case 'healPercent': lines.push(`HP を最大HPの ${e.percent}% 回復する。`); break;
    }
  }
  if (exhaust) lines.push('廃棄。');
  return lines.join('\n');
}
