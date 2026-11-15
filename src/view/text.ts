// =============================================================
// text.ts  【View：データの表示名を現在の言語で取り出す補助】
// -------------------------------------------------------------
// data/ の日本語をそのまま使うのではなく、必ずここを通して表示することで
// 言語切り替え（i18n）に対応する。
// =============================================================
import { td } from '@/i18n';
import { STATUS_EFFECTS } from '@/data/statusEffects';
import { KEYS } from '@/data/items';
import type { CardDef, EnemyDef, EquipmentDef, ItemDef, KeyColor, StatusId } from '@/model/types';

export const cardName = (d: CardDef) => td('card', d.id, 'name', d.name);
export const cardDesc = (d: CardDef) => td('card', d.id, 'description', d.description);
export const enemyName = (d: EnemyDef) => td('enemy', d.id, 'name', d.name);
export const enemyDesc = (d: EnemyDef) => td('enemy', d.id, 'description', d.description);
export const itemName = (d: ItemDef) => td('item', d.id, 'name', d.name);
export const itemDesc = (d: ItemDef) => td('item', d.id, 'description', d.description);
export const equipName = (d: EquipmentDef) => td('equipment', d.id, 'name', d.name);
export const equipDesc = (d: EquipmentDef) => td('equipment', d.id, 'description', d.description);
export const statusName = (id: StatusId) => td('status', id, 'name', STATUS_EFFECTS[id].name);
export const statusDesc = (id: StatusId, n: number) => td('status', id, 'description', STATUS_EFFECTS[id].description, { n });
export const keyName = (c: KeyColor) => td('key', c, 'name', KEYS[c].name);
