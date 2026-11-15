// =============================================================
// simulate.ts  【ツール：バランス確認用の自動対戦シミュレーション】
// -------------------------------------------------------------
// 実行: npm run sim
//
// 単純な思考のボットに 200 回冒険させ、「何階まで到達できたか」の分布を表示する。
// balance.ts や敵の数値を変えた時に、難しすぎ／簡単すぎを数値で確認できる。
//  ※ボットは人間より下手（イベント・ショップ・アイテムを使わない）なので、
//    人間の実際の到達階はこれより高くなる。
// =============================================================
import { Random } from '@/core/Random';
import { STARTER_DECK, getCard } from '@/data/cards';
import { GameState } from '@/model/GameState';
import { Combat } from '@/model/Combat';
import { rollStats } from '@/model/StatRoller';
import { generateEncounter, isBossFloor } from '@/model/FloorGenerator';
import { rollBattleReward } from '@/model/Loot';
import { STAT_KEYS } from '@/model/types';

/** ボットの思考：危なければ防御、それ以外は攻撃（一番HPの低い敵を狙う） */
function bot(c: Combat) {
  for (let turn = 0; turn < 60 && c.phase === 'player'; turn++) {
    let guard = 0;
    while (c.phase === 'player' && guard++ < 20) {
      const incoming = c.aliveEnemies.reduce((s, e) => { const it = c.intentOf(e); return s + (it?.damage ?? 0) * (it?.hits ?? 1); }, 0);
      const playable = c.hand.filter((h) => getCard(h.cardId).cost <= c.player.ap);
      if (!playable.length) break;
      const pick = (id: string) => playable.find((h) => h.cardId === id);
      const target = c.aliveEnemies.sort((a, b) => a.hp - b.hp)[0]?.index ?? null;
      let card = (incoming > c.player.block + 2 && pick('defend')) || pick('seal') && incoming >= 8 && pick('seal') || pick('rage') || pick('strike') || pick('scavenge') || pick('defend') || playable[0];
      const r = c.playCard(card.uid, target);
      if (r === 'needChoice') c.resolveChoice([c.pending!.candidates.find((u) => c.hand.find((h) => h.uid === u)?.cardId === 'defend') ?? c.pending!.candidates[0]]);
      c.takeEvents();
      if (r === 'invalid') break;
    }
    if (c.phase !== 'player') break;
    c.endTurn(); c.takeEvents();
  }
}

const results: number[] = [];
for (let run = 0; run < 200; run++) {
  const rng = new Random(run * 7919 + 1);
  const r = rollStats(rng);
  const gs = GameState.create(run, r.stats, r.talents, r.rich, STARTER_DECK);
  let floor = 2;
  for (; floor <= 100; floor++) {
    gs.data.floor = floor;
    const kind = isBossFloor(floor) ? 'boss' : rng.chance(0.15) && floor >= 5 ? 'elite' : 'normal';
    if (!isBossFloor(floor) && rng.chance(0.3)) { gs.heal(20); continue; } // イベント/ショップ相当
    const c = new Combat(gs, generateEncounter(floor, kind, rng), kind, floor, rng);
    c.start(); c.takeEvents();
    bot(c);
    if (c.phase !== 'won') break;
    const rw = rollBattleReward(floor, kind, rng);
    gs.addGold(rw.gold); gs.addExp(rw.exp);
    if (rng.chance(0.6)) gs.addCard(rw.cardChoices.includes('strike') ? 'strike' : rw.cardChoices[0]);
    if (kind === 'boss') gs.heal(gs.maxHp);
    // ポイント割り振り：体力・攻撃・防御を順に
    while (gs.data.statPoints > 0) { const k = (['hp', 'atk', 'def', 'hp', 'atk'] as const)[gs.data.statPoints % 5]; gs.allocate({ [k]: 1 }); }
  }
  results.push(floor);
}
results.sort((a, b) => a - b);
const pct = (p: number) => results[Math.floor(results.length * p)];
console.log('到達階 中央値', pct(0.5), ' 25%', pct(0.25), ' 75%', pct(0.75), ' 90%', pct(0.9), ' 最大', results[results.length - 1]);
const hist: Record<string, number> = {};
results.forEach((f) => { const b = `${Math.floor((f - 1) / 10) * 10 + 1}-${Math.floor((f - 1) / 10) * 10 + 10}`; hist[b] = (hist[b] ?? 0) + 1; });
console.log(hist); const at: Record<number, number> = {}; results.filter((f) => f <= 12).forEach((f) => (at[f] = (at[f] ?? 0) + 1)); console.log(at);
