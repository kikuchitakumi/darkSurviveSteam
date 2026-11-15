// =============================================================
// BattleController.ts  【Controller：戦闘の進行】
// -------------------------------------------------------------
// Model（Combat）と View（BattleScene）の橋渡しをする。
//
//  1. 敵の編成を決め、Combat と BattleScene を作る
//  2. プレイヤーの入力（カード・アイテム・ターン終了）を Combat に渡す
//  3. Combat が出した出来事（CombatEvent）を BattleScene で演出する
//  4. 勝敗が決まったら結果を返す
// =============================================================
import { Audio } from '@/core/AudioManager';
import { zoneOfFloor } from '@/config/balance';
import { getZone } from '@/data/floors';
import { getItem } from '@/data/items';
import { Combat, type BattleKind } from '@/model/Combat';
import { generateEncounter } from '@/model/FloorGenerator';
import { wait } from '@/view/dom';
import { ui } from '@/view/ui';
import { BattleScene } from '@/view/scenes/BattleScene';
import { showVictory } from '@/view/scenes/RewardScene';
import { enemyName } from '@/view/text';
import { t } from '@/i18n';
import type { GameController } from './GameController';

const AMBIENT_BY_ZONE = ['dust', 'dust', 'spores', 'embers', 'embers', 'ash'] as const;

export async function runBattle(ctx: GameController, kind: BattleKind, enemyIds?: string[]): Promise<'won' | 'lost'> {
  const gs = ctx.gs!;
  const floor = gs.data.floor;
  const ids = enemyIds ?? generateEncounter(floor, kind, gs.rng);
  const combat = new Combat(gs, ids, kind, floor, gs.rng);
  const zone = getZone(zoneOfFloor(floor));

  Audio.playBgm(kind === 'boss' ? 'bgm_boss' : kind === 'elite' ? 'bgm_elite' : 'bgm_battle', 0.6);
  Audio.play('se_door');

  let scene!: BattleScene;
  await ui.stage.fadeTransition(() => {
    scene = new BattleScene(combat, {
      background: zone.battleBackground,
      ambient: AMBIENT_BY_ZONE[zone.zone],
      tint: kind === 'boss' ? 'radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(90,0,0,0.55) 100%)' : kind === 'elite' ? 'rgba(60,0,30,0.25)' : undefined,
    });
  });
  const boss = combat.enemies.find((e) => e.def.kind === 'boss');
  await scene.introEnemies(kind, boss ? enemyName(boss.def) : undefined);
  if (gs.data.stats.battlesWon === 0 && floor <= 3) ui.toast(t('hint.battle').replace('\n', ' '), 'info');

  combat.start();
  await scene.play(combat.takeEvents());

  return new Promise((resolve) => {
    let finished = false;

    /** 勝敗チェック */
    const check = async () => {
      if (finished) return;
      if (combat.phase === 'won') {
        finished = true;
        scene.busy = true;
        await scene.clearHand();
        await showVictory();
        cleanup();
        resolve('won');
      } else if (combat.phase === 'lost') {
        finished = true;
        scene.busy = true;
        await wait(700);
        cleanup();
        resolve('lost');
      }
    };

    const cleanup = () => {
      scene.destroy();
      ctx.restoreHudHandlers();
      gs.changed();
    };

    // ---- カードを使う ----
    scene.onPlayCard = async (uid, target) => {
      if (scene.busy || finished) return;
      const r = combat.playCard(uid, target);
      if (r === 'invalid') return;
      await scene.play(combat.takeEvents());
      if (r === 'needChoice' && combat.pending) {
        const picked = await scene.chooseFromHand(combat.pending);
        combat.resolveChoice(picked);
        await scene.play(combat.takeEvents());
      }
      await check();
    };

    // ---- ターン終了 ----
    scene.onEndTurn = async () => {
      if (scene.busy || finished || combat.phase !== 'player') return;
      combat.endTurn();
      await scene.play(combat.takeEvents());
      await check();
    };

    // ---- アイテム（HUD のアイテム枠をクリック） ----
    ui.hudHandlers.onItem = async (index) => {
      if (scene.busy || finished || combat.phase !== 'player') return;
      const id = gs.data.items[index];
      if (!id) return;
      const def = getItem(id);
      let target: number | null = null;
      if (def.target === 'enemy') {
        target = await scene.selectTarget();
        if (target === null) return;
      }
      if (combat.useItem(index, target)) {
        await scene.play(combat.takeEvents());
        await check();
      }
    };
  });
}
