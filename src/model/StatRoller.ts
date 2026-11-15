// =============================================================
// StatRoller.ts  【Model：初期ステータスの抽選】
// -------------------------------------------------------------
// START 後の「ステータスを振る画面」で使う抽選ロジック。
//  - 各ステータスは 1～5 からランダム
//  - 極稀（3%）に「才能」が開花し、8～12 になる
//  - 1% で「金持ちの才能」が覚醒し、初期所持金が 1000G になる
// =============================================================
import { BALANCE } from '@/config/balance';
import { Random } from '@/core/Random';
import type { StatKey, Stats } from './types';
import { STAT_KEYS } from './types';

export interface StatRollResult {
  stats: Stats;
  /** 才能が開花したステータス */
  talents: StatKey[];
  /** 金持ちの才能 */
  rich: boolean;
}

export function rollStats(rng: Random): StatRollResult {
  const stats = {} as Stats;
  const talents: StatKey[] = [];
  for (const k of STAT_KEYS) {
    if (rng.chance(BALANCE.TALENT_CHANCE)) {
      stats[k] = rng.int(BALANCE.TALENT_ROLL_MIN, BALANCE.TALENT_ROLL_MAX);
      talents.push(k);
    } else {
      stats[k] = rng.int(BALANCE.STAT_ROLL_MIN, BALANCE.STAT_ROLL_MAX);
    }
  }
  const rich = rng.chance(BALANCE.RICH_TALENT_CHANCE);
  return { stats, talents, rich };
}
