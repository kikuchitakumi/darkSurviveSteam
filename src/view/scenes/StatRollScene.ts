// =============================================================
// StatRollScene.ts  【View シーン：ステータス抽選画面】
// -------------------------------------------------------------
// START 後に表示される「運命の選定」画面。
//  - 各ステータスがスロットマシンのように回転して決まる
//  - 才能開花したステータスは金色に光る
//  - 振り直しは1回のみ（回数は Controller から渡される）
// 抽選そのもの（乱数）は model/StatRoller.ts が行う。
// =============================================================
import { Audio } from '@/core/AudioManager';
import { BALANCE } from '@/config/balance';
import { IMAGES } from '@/data/images';
import { seedToString } from '@/core/Random';
import { t } from '@/i18n';
import type { StatRollResult } from '@/model/StatRoller';
import { STAT_KEYS } from '@/model/types';
import { animate, button, clear, fmt, h, wait } from '../dom';
import { ui } from '../ui';
import { attachTooltip } from '../components/Tooltip';

export interface StatRollView {
  /** 抽選結果をアニメーション付きで表示 */
  reveal(r: StatRollResult, rerollsLeft: number): Promise<void>;
  /** プレイヤーの選択を待つ */
  waitChoice(): Promise<'reroll' | 'accept'>;
}

export function showStatRoll(seed: number): StatRollView {
  const root = ui.stage.scene;
  clear(root);
  ui.hud.setVisible(false);
  ui.msg.hide();
  ui.stage.setBackground(IMAGES.statRoll);
  ui.particles.setAmbient('dust');

  const slots = new Map<string, { box: HTMLElement; num: HTMLElement; tag: HTMLElement }>();
  const grid = h('div.roll-grid');
  for (const k of STAT_KEYS) {
    const num = h('div.roll-num', {}, '?');
    const tag = h('div.roll-tag');
    const box = h('div.roll-slot', {}, [h('div.roll-label', {}, t(`stat.${k}` as any)), h('div.roll-window', {}, num), tag, h('div.roll-desc', {}, t(`stat.${k}.desc` as any))]);
    attachTooltip(box, () => t(`stat.${k}.desc` as any));
    slots.set(k, { box, num, tag });
    grid.append(box);
  }
  // AP は固定
  grid.append(h('div.roll-slot.fixed', {}, [h('div.roll-label', {}, 'AP'), h('div.roll-window', {}, h('div.roll-num', {}, String(BALANCE.BASE_AP))), h('div.roll-tag'), h('div.roll-desc', {}, t('stat.ap.desc'))]));

  const goldNum = h('div.roll-gold-num', {}, '---');
  const goldTag = h('div.roll-tag');
  const buttons = h('div.roll-buttons');
  root.append(h('div.scene.roll-scene', {}, [
    h('div.roll-title', {}, t('roll.title')),
    h('div.roll-subtitle', {}, t('roll.subtitle')),
    grid,
    h('div.roll-gold', {}, [h('div.roll-label', {}, t('roll.startGold')), goldNum, goldTag]),
    buttons,
    h('div.roll-seed', {}, `${t('roll.seed')} ${seedToString(seed)}`),
  ]));

  let choiceResolver: ((v: 'reroll' | 'accept') => void) | null = null;

  return {
    async reveal(r, rerollsLeft) {
      clear(buttons);
      // 全スロットを回転させ、左から順に止める
      const spinning = new Map<string, boolean>();
      for (const k of STAT_KEYS) {
        const s = slots.get(k)!;
        s.box.classList.remove('talent', 'settled');
        s.tag.textContent = '';
        spinning.set(k, true);
        (async () => {
          while (spinning.get(k)) {
            s.num.textContent = String(1 + Math.floor(Math.random() * 9));
            await wait(45);
          }
        })();
      }
      goldNum.textContent = '---';
      goldTag.textContent = '';
      await wait(500);
      for (const k of STAT_KEYS) {
        Audio.play('se_roll');
        spinning.set(k, false);
        const s = slots.get(k)!;
        s.num.textContent = String(r.stats[k]);
        s.box.classList.add('settled');
        animate(s.num, [{ transform: 'scale(1.8)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], 300);
        if (r.talents.includes(k)) {
          await wait(150);
          s.box.classList.add('talent');
          s.tag.textContent = t('roll.talent');
          Audio.play('se_talent');
          ui.fx.shake(0.4);
        }
        await wait(260);
      }
      Audio.play('se_gold');
      goldNum.textContent = `${fmt(r.rich ? BALANCE.RICH_START_GOLD : BALANCE.START_GOLD)} G`;
      if (r.rich) {
        goldTag.textContent = t('roll.rich');
        goldNum.parentElement!.classList.add('talent');
        Audio.play('se_talent');
      } else goldNum.parentElement!.classList.remove('talent');
      animate(goldNum, [{ transform: 'scale(1.6)' }, { transform: 'scale(1)' }], 300);

      buttons.append(
        button(rerollsLeft > 0 ? t('roll.reroll', { n: rerollsLeft }) : t('roll.rerollNone'), () => choiceResolver?.('reroll'), { disabled: rerollsLeft <= 0 }),
        button(t('roll.accept'), () => choiceResolver?.('accept'), { cls: 'primary', se: 'se_door' }),
      );
      Array.from(buttons.children).forEach((b, i) => animate(b, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: i * 100, fill: 'backwards' }));
    },
    waitChoice() {
      return new Promise((r) => (choiceResolver = r));
    },
  };
}
