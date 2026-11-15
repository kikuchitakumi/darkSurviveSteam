// =============================================================
// FloorGenerator.ts  【Model：階の選択肢・敵の編成を決める】
// -------------------------------------------------------------
//  - 2F以降：戦闘 / 戦闘(危険) / イベント / ショップ から2択
//  - 10Fごと：ボス固定
//  - 鍵を持っていれば、たまに「隠し通路（宝物庫）」が追加される
//  - 戦闘の敵の編成（1～3体）もここで決める
// =============================================================
import { BALANCE, zoneOfFloor } from '@/config/balance';
import { ENEMIES } from '@/data/enemies';
import { EVENTS } from '@/data/events';
import { Random } from '@/core/Random';
import type { EventDef, RouteType } from './types';

/** その階がボス階か */
export function isBossFloor(floor: number): boolean {
  return floor % BALANCE.BOSS_INTERVAL === 0;
}

/** 2F以降の選択肢を決める */
export function generateRoutes(floor: number, rng: Random, hasKey: boolean): RouteType[] {
  if (isBossFloor(floor)) return ['boss'];
  const w = BALANCE.ROUTE_WEIGHTS;
  const pool: { type: RouteType; w: number }[] = [
    { type: 'battle', w: w.battle },
    { type: 'elite', w: floor >= BALANCE.ELITE_MIN_FLOOR ? w.elite : 0 },
    { type: 'event', w: w.event },
    { type: 'shop', w: w.shop },
  ];
  // 仕様：基本は2択（同じ種類が2つ並ばないようにする）
  const first = rng.weighted(pool, (x) => x.w).type;
  const second = rng.weighted(pool.filter((x) => x.type !== first), (x) => x.w).type;
  const routes: RouteType[] = [first, second];
  if (hasKey && rng.chance(BALANCE.HIDDEN_PASSAGE_CHANCE)) routes.push('hidden');
  return routes;
}

/** 通常戦闘の敵の数（階が上がるほど増える） */
function enemyCount(floor: number, rng: Random): number {
  if (floor <= 3) return rng.chance(0.25) ? 2 : 1;
  if (floor <= 10) return rng.weighted([1, 2, 3], (n) => (n === 1 ? 40 : n === 2 ? 45 : 15));
  return rng.weighted([1, 2, 3], (n) => (n === 1 ? 25 : n === 2 ? 45 : 30));
}

/** 戦闘の敵編成を決める（敵IDの配列） */
export function generateEncounter(floor: number, kind: 'normal' | 'elite' | 'boss', rng: Random): string[] {
  const zone = zoneOfFloor(floor);
  if (kind === 'boss') {
    const boss = ENEMIES.find((e) => e.kind === 'boss' && e.bossFloor === floor)
      ?? ENEMIES.filter((e) => e.kind === 'boss' && (e.bossFloor ?? 0) <= floor).pop()!;
    return [boss.id];
  }
  if (kind === 'elite') {
    const elites = ENEMIES.filter((e) => e.kind === 'elite' && e.zones.includes(zone));
    return [rng.pick(elites).id];
  }
  const normals = ENEMIES.filter((e) => e.kind === 'normal' && e.zones.includes(zone));
  const n = enemyCount(floor, rng);
  return Array.from({ length: n }, () => rng.pick(normals).id);
}

/** 出現可能なイベントから1つ選ぶ */
export function pickEvent(floor: number, rng: Random): EventDef | null {
  const list = EVENTS.filter((e) => e.enabled && (e.minFloor ?? 0) <= floor && (e.maxFloor ?? 999) >= floor);
  if (!list.length) return null;
  return rng.weighted(list, (e) => e.weight);
}
