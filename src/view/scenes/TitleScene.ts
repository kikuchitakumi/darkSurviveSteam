// =============================================================
// TitleScene.ts  【View シーン：タイトル画面】
// -------------------------------------------------------------
// キービジュアルを背景に、中央に START / CONTINUE / OPTION を表示する。
// 演出：ロゴの明滅（切れかけた電灯のように）・稲光・霧・塵。
// 選ばれた項目を Promise で Controller に返す（ロジックは持たない）。
// =============================================================
import { GAME_CONFIG } from '@/config/gameConfig';
import { Audio } from '@/core/AudioManager';
import { IMAGES } from '@/data/images';
import { t } from '@/i18n';
import { animate, button, clear, h } from '../dom';
import { ui } from '../ui';
import { openOptions } from '../panels/OptionsPanel';

export function showTitle(opts: { hasSave: boolean; bestFloor: number }): Promise<'start' | 'continue'> {
  const root = ui.stage.scene;
  clear(root);
  ui.hud.setVisible(false);
  ui.msg.hide();
  ui.stage.setBackground(IMAGES.titleKeyVisual);
  ui.particles.setAmbient('embers');

  return new Promise((resolve) => {
    const logo = h('div.title-logo', {}, [
      h('div.title-logo-main', { dataset: { text: GAME_CONFIG.TITLE } }, GAME_CONFIG.TITLE),
      h('div.title-logo-sub', {}, 'A DECKBUILDING ROGUELIKE OF THE TOWER'),
    ]);
    const menu = h('div.title-menu', {}, [
      button(t('title.start'), () => done('start'), { cls: 'title-btn' }),
      button(t('title.continue'), () => done('continue'), { cls: 'title-btn', disabled: !opts.hasSave }),
      button(t('title.option'), () => openOptions(), { cls: 'title-btn' }),
    ]);
    const footer = h('div.title-footer', {}, [
      opts.bestFloor > 0 ? h('div.title-best', {}, t('title.best', { n: opts.bestFloor })) : null,
      h('div.title-version', {}, `v${GAME_CONFIG.VERSION}`),
    ]);
    const lightning = h('div.lightning');
    root.append(h('div.scene.title-scene', {}, [lightning, logo, menu, footer]));

    animate(logo, [{ opacity: 0, filter: 'blur(20px)', transform: 'scale(1.1)' }, { opacity: 1, filter: 'blur(0)', transform: 'scale(1)' }], { duration: 2200, easing: 'cubic-bezier(.2,.8,.2,1)' });
    Array.from(menu.children).forEach((b, i) => animate(b, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 600, delay: 900 + i * 120, fill: 'backwards' }));

    // 不定期な稲光
    let alive = true;
    const flash = () => {
      if (!alive) return;
      lightning.classList.remove('on');
      void lightning.offsetWidth;
      lightning.classList.add('on');
      setTimeout(flash, 6000 + Math.random() * 9000);
    };
    setTimeout(flash, 3500);

    const done = (r: 'start' | 'continue') => {
      alive = false;
      Audio.play('se_door');
      resolve(r);
    };
  });
}
