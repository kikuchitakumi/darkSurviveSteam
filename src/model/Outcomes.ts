// =============================================================
// Outcomes.ts  【Model：戦闘外での効果の適用】
// -------------------------------------------------------------
//  - マップ画面でのアイテム使用（回復薬など）
//  - イベントの結果（G・回復・ダメージ・経験値・ステータス・鍵…）
// を GameState に反映する。画面表示用に「何が起きたか」を返す。
// 装備・カード・戦闘など、プレイヤーの確認や画面遷移が必要な結果は
// Controller 側で処理するため、ここでは pending として返す。
// =============================================================
import { getItem } from '@/data/items';
import { Random } from '@/core/Random';
import type { GameState } from './GameState';
import type { EventOutcome, ItemDef, KeyColor } from './types';
import { KEY_COLORS } from './types';
import { rollCardChoices } from './Loot';

/** 戦闘外でアイテムを使う。使えたら true */
export function useItemOutOfBattle(gs: GameState, index: number): boolean {
  const id = gs.data.items[index];
  if (!id) return false;
  const def: ItemDef = getItem(id);
  if (def.usable !== 'anytime') return false;
  for (const e of def.effects) {
    if (e.kind === 'heal') gs.heal(e.amount + (e.scale === 'mag' ? gs.stats.mag : 0));
    else if (e.kind === 'healPercent') gs.heal(Math.ceil((gs.maxHp * e.percent) / 100));
  }
  gs.removeItemAt(index);
  return true;
}

/** イベント結果のうち、Controller が追加で処理すべきもの */
export type PendingOutcome =
  | { kind: 'card'; cardId: string }
  | { kind: 'equipment'; equipmentId: string }
  | { kind: 'battle'; elite: boolean }
  | { kind: 'levelUp'; levels: number[] };

export interface AppliedOutcome {
  /** 画面に出す短い結果メッセージ（トースト等） */
  notes: { text: string; good: boolean }[];
  pending: PendingOutcome[];
}

/**
 * イベントの結果を適用する
 * @param labels 表示用の文言を作る関数（View の翻訳を Model に持ち込まないため外から渡す）
 */
export function applyOutcomes(gs: GameState, outcomes: EventOutcome[], rng: Random, labels: {
  gold: (n: number) => string; heal: (n: number) => string; damage: (n: number) => string;
  exp: (n: number) => string; item: (id: string) => string; itemFull: (id: string) => string;
  key: (c: KeyColor) => string; stat: (s: string, n: number) => string;
}): AppliedOutcome {
  const res: AppliedOutcome = { notes: [], pending: [] };
  for (const o of outcomes) {
    switch (o.kind) {
      case 'gold': gs.addGold(o.amount); res.notes.push({ text: labels.gold(o.amount), good: o.amount >= 0 }); break;
      case 'heal': { const v = gs.heal(o.amount); res.notes.push({ text: labels.heal(v), good: true }); break; }
      case 'damage': { const v = gs.damage(o.amount); res.notes.push({ text: labels.damage(v), good: false }); break; }
      case 'exp': {
        const lv = gs.addExp(o.amount);
        res.notes.push({ text: labels.exp(o.amount), good: true });
        if (lv.length) res.pending.push({ kind: 'levelUp', levels: lv });
        break;
      }
      case 'item':
        if (gs.addItem(o.itemId)) res.notes.push({ text: labels.item(o.itemId), good: true });
        else res.notes.push({ text: labels.itemFull(o.itemId), good: false });
        break;
      case 'key': { const c = o.color === 'random' ? rng.pick(KEY_COLORS) : o.color; gs.addKey(c); res.notes.push({ text: labels.key(c), good: true }); break; }
      case 'stat': gs.addBaseStat(o.stat, o.amount); res.notes.push({ text: labels.stat(o.stat, o.amount), good: o.amount >= 0 }); break;
      case 'card': res.pending.push({ kind: 'card', cardId: o.cardId }); break;
      case 'randomCard': res.pending.push({ kind: 'card', cardId: rollCardChoices(rng, 1, gs.data.floor)[0] }); break;
      case 'equipment': res.pending.push({ kind: 'equipment', equipmentId: o.equipmentId }); break;
      case 'battle': res.pending.push({ kind: 'battle', elite: !!o.elite }); break;
      case 'nothing': break;
    }
  }
  return res;
}

/** 運判定の成功率（0～1） */
export function luckChance(luck: number, check: { base: number; perLuck: number; max?: number }): number {
  return Math.min(check.max ?? 0.95, check.base + luck * check.perLuck);
}
