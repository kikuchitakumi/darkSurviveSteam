// =============================================================
// EndScenes.ts  【View シーン：ゲームオーバー／クリア／ローディング】
// -------------------------------------------------------------
//  - showGameOver : 「YOU DIED」→ 冒険の記録 → タイトル/再挑戦
//  - showClear    : 100F のラスボス撃破後のエンディング
//  - showLoading  : 起動時の画像・音声読み込み画面
// =============================================================
import { Audio } from '@/core/AudioManager';
import { IMAGES } from '@/data/images';
import { t } from '@/i18n';
import type { GameState } from '@/model/GameState';
import { animate, button, clear, fmt, h, wait } from '../dom';
import { ui } from '../ui';

function statsTable(gs: GameState): HTMLElement {
  const s = gs.data.stats;
  const mins = Math.floor((Date.now() - gs.data.startedAt) / 60000);
  const rows: [string, string][] = [
    [t('stats.level'), String(gs.data.level)],
    [t('stats.battlesWon'), fmt(s.battlesWon)],
    [t('stats.enemiesKilled'), fmt(s.enemiesKilled)],
    [t('stats.damageDealt'), fmt(s.damageDealt)],
    [t('stats.maxHit'), fmt(s.maxHit)],
    [t('stats.crits'), fmt(s.crits)],
    [t('stats.cardsPlayed'), fmt(s.cardsPlayed)],
    [t('stats.goldEarned'), fmt(s.goldEarned)],
    [t('stats.time'), `${Math.floor(mins / 60)}h ${mins % 60}m`],
  ];
  return h('div.end-stats', {}, rows.map(([k, v]) => h('div.end-stat', {}, [h('span', {}, k), h('span', {}, v)])));
}

export async function showGameOver(gs: GameState): Promise<'title' | 'retry'> {
  ui.hud.setVisible(false);
  ui.msg.hide();
  Audio.stopBgm(0.5);
  Audio.play('se_defeat');
  const root = ui.stage.scene;
  ui.stage.setLowHp(false);
  const died = h('div.you-died', {}, t('gameover.title'));
  const overlay = h('div.gameover-overlay', {}, [died]);
  root.append(overlay);
  await animate(overlay, [{ opacity: 0 }, { opacity: 1 }], { duration: 1200, fill: 'forwards' });
  await animate(died, [{ opacity: 0, transform: 'scale(1.3)', letterSpacing: '0.6em' }, { opacity: 1, transform: 'scale(1)', letterSpacing: '0.25em' }], { duration: 2400, easing: 'ease-out', fill: 'forwards' });
  await wait(600);
  clear(root);
  ui.stage.setBackground(IMAGES.gameOver);
  Audio.playBgm('bgm_gameover');
  return new Promise((resolve) => {
    const panel = h('div.end-panel', {}, [
      h('div.end-title.red', {}, t('gameover.title')),
      h('div.end-floor', {}, t('gameover.reached', { n: gs.data.floor })),
      h('div.end-subtitle', {}, t('gameover.stats')),
      statsTable(gs),
      h('div.end-buttons', {}, [button(t('gameover.toTitle'), () => resolve('title')), button(t('gameover.retry'), () => resolve('retry'), { cls: 'primary' })]),
    ]);
    root.append(h('div.scene.end-scene', {}, panel));
    animate(panel, [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], 800);
  });
}

export async function showClear(gs: GameState): Promise<void> {
  ui.hud.setVisible(false);
  ui.msg.hide();
  const root = ui.stage.scene;
  await ui.stage.fadeTransition(() => {
    clear(root);
    ui.stage.setBackground(IMAGES.clear);
    ui.particles.setAmbient('ash');
  }, 1200);
  Audio.playBgm('bgm_title');
  await ui.msg.say(t('clear.message'));
  ui.msg.hide();
  return new Promise((resolve) => {
    const panel = h('div.end-panel.clear', {}, [
      h('div.end-title.gold', {}, t('clear.title')),
      h('div.end-floor', {}, t('gameover.reached', { n: gs.data.floor })),
      statsTable(gs),
      h('div.end-buttons', {}, [button(t('gameover.toTitle'), () => resolve(), { cls: 'primary' })]),
    ]);
    root.append(h('div.scene.end-scene', {}, panel));
    animate(panel, [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], 1000);
  });
}

/** 起動時のローディング画面。progress(0～1) を更新する関数を返す */
export function showLoading(): { progress: (p: number) => void; done: () => Promise<void> } {
  const fill = h('div.loading-fill');
  const label = h('div.loading-label', {}, 'LOADING');
  const el = h('div.loading-screen', {}, [h('div.loading-title', {}, 'DarkSurvive'), h('div.loading-bar', {}, fill), label]);
  ui.stage.modal.append(el);
  return {
    progress: (p) => {
      fill.style.width = `${Math.round(p * 100)}%`;
      label.textContent = `LOADING ${Math.round(p * 100)}%`;
    },
    done: async () => {
      await animate(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
      el.remove();
    },
  };
}

/** 最初のクリック待ち（ブラウザは操作があるまで音を鳴らせないため） */
export function waitFirstClick(): Promise<void> {
  return new Promise((resolve) => {
    const el = h('div.click-to-start', {}, [h('div.cts-title', {}, 'DarkSurvive'), h('div.cts-sub', {}, t('title.pressStart')), h('div.cts-note', {}, '🎧 Headphones recommended')]);
    ui.stage.modal.append(el);
    const go = () => {
      window.removeEventListener('keydown', go);
      Audio.unlock();
      animate(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: 'forwards' }).then(() => el.remove());
      resolve();
    };
    el.addEventListener('click', go);
    window.addEventListener('keydown', go);
  });
}
