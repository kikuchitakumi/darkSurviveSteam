// =============================================================
// RewardScene.ts  【View シーン：戦闘勝利の報酬画面】
// -------------------------------------------------------------
// VICTORY 表示 → 獲得した G・経験値・ドロップを一覧表示 →
// 3枚のカードから1枚を選ぶ（スキップ可）。
// 報酬の決定・付与は Controller / Model 側で行い、ここは表示と選択のみ。
// =============================================================
import { Audio } from '@/core/AudioManager';
import { getCard } from '@/data/cards';
import { t } from '@/i18n';
import { animate, button, h, img, wait } from '../dom';
import { ui } from '../ui';
import { createCardEl } from '../components/CardView';

export interface RewardLine {
  icon: string;
  text: string;
  kind?: 'gold' | 'exp' | 'item' | 'equip' | 'key' | 'warn';
}

/** VICTORY のバナー */
export async function showVictory(): Promise<void> {
  Audio.play('se_victory');
  await ui.fx.banner(t('battle.victory'), { cls: 'banner-victory', hold: 900 });
}

/**
 * 報酬一覧とカード選択を表示し、選ばれたカードID（スキップ時 null）を返す
 * @param numbersOf カードの説明文に入れる数値（現在のステータス込み）
 */
export async function showRewards(lines: RewardLine[], cardChoices: string[], numbersOf: (cardId: string) => Record<string, number>): Promise<string | null> {
  const root = ui.stage.scene;
  const overlay = h('div.reward-overlay');
  const panel = h('div.reward-panel', {}, [h('div.reward-title', {}, t('reward.title'))]);
  const list = h('div.reward-list');
  panel.append(list);
  overlay.append(panel);
  root.append(overlay);
  animate(overlay, [{ opacity: 0 }, { opacity: 1 }], 300);
  animate(panel, [{ transform: 'translateY(40px) scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,1.2,.4,1)' });

  // ---- 報酬を1行ずつ表示 ----
  for (const [i, l] of lines.entries()) {
    const row = h(`div.reward-row.kind-${l.kind ?? 'item'}`, {}, [img(l.icon), h('span', {}, l.text)]);
    list.append(row);
    animate(row, [{ opacity: 0, transform: 'translateX(-30px)' }, { opacity: 1, transform: 'none' }], 280);
    Audio.play(l.kind === 'gold' ? 'se_gold' : l.kind === 'warn' ? 'se_error' : 'se_card_draw');
    await wait(i === 0 ? 260 : 180);
  }

  const result = await new Promise<string | null>((resolve) => {
    if (!cardChoices.length) {
      panel.append(h('div.reward-buttons', {}, [button(t('reward.next'), () => resolve(null), { cls: 'primary', se: 'se_door' })]));
      return;
    }
    // ---- カード選択 ----
    panel.append(h('div.reward-subtitle', {}, t('reward.chooseCard')));
    const cards = h('div.reward-cards');
    let done = false;
    cardChoices.forEach((id, i) => {
      const el = createCardEl(getCard(id), { numbers: numbersOf(id) });
      el.classList.add('reward-card');
      el.addEventListener('mouseenter', () => Audio.play('se_hover'));
      el.addEventListener('click', () => {
        if (done) return;
        done = true;
        Audio.play('se_card_play');
        el.classList.add('picked');
        Array.from(cards.children).forEach((c) => c !== el && c.classList.add('not-picked'));
        setTimeout(() => resolve(id), 550);
      });
      cards.append(el);
      animate(el, [{ opacity: 0, transform: 'translateY(60px) rotateY(90deg)' }, { opacity: 1, transform: 'none' }], { duration: 450, delay: i * 120, easing: 'cubic-bezier(.2,1.1,.4,1)', fill: 'backwards' });
    });
    panel.append(cards, h('div.reward-buttons', {}, [button(t('reward.skipCard'), () => !done && resolve(null), { se: 'se_cancel' })]));
  });

  await animate(overlay, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
  overlay.remove();
  return result;
}
