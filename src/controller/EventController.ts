// =============================================================
// EventController.ts  【Controller：ランダムイベント】
// -------------------------------------------------------------
// data/events.ts からイベントを1つ選び、
//   本文表示 → 選択肢 → （運判定）→ 結果の適用
// を行う。結果の適用は Model（Outcomes.applyOutcomes）。
// 結果が「戦闘」の場合はそのまま戦闘・報酬に進む。
// =============================================================
import { getCard } from '@/data/cards';
import { getItem } from '@/data/items';
import { t } from '@/i18n';
import { pickEvent } from '@/model/FloorGenerator';
import { applyOutcomes, luckChance } from '@/model/Outcomes';
import { ui } from '@/view/ui';
import { showObjectScene } from '@/view/scenes/ObjectScene';
import { cardName, itemName, keyName } from '@/view/text';
import { openStatusPanel } from '@/view/panels/StatusPanel';
import { td } from '@/i18n';
import { runBattle } from './BattleController';
import { runRewards } from './RewardController';
import type { GameController } from './GameController';

export async function runEvent(ctx: GameController): Promise<'ok' | 'lost'> {
  const gs = ctx.gs!;
  const ev = pickEvent(gs.data.floor, gs.rng);
  if (!ev) return 'ok';

  await ui.stage.fadeTransition(() => {
    showObjectScene({
      background: ev.background,
      objects: ev.object ? [{ id: 'obj', image: ev.object, x: 960, y: 680, height: 440 }] : [],
      title: td('event', ev.id, 'title', ev.title),
      ambient: 'dust',
    });
  });

  for (const [i, page] of ev.text.entries()) await ui.msg.say(td('event', ev.id, `text${i}`, page));

  const luk = gs.stats.luk;
  const idx = await ui.msg.choose(ev.choices.map((c, i) => ({
    label: td('event', ev.id, `choice${i}`, c.label),
    sub: c.luckCheck ? t('event.luck', { n: Math.round(luckChance(luk, c.luckCheck) * 100) }) : undefined,
    disabled: c.requireGold !== undefined && gs.data.gold < c.requireGold,
  })));
  const choice = ev.choices[idx];
  const success = !choice.luckCheck || gs.rng.chance(luckChance(luk, choice.luckCheck));
  const result = success ? choice.success : choice.failure ?? choice.success;

  const applied = applyOutcomes(gs, result.outcomes, gs.rng, {
    gold: (n) => `+${n}G`,
    heal: (n) => `HP +${n}`,
    damage: (n) => `HP -${n}`,
    exp: (n) => t('reward.exp', { n }),
    item: (id) => t('reward.item', { name: itemName(getItem(id)) }),
    itemFull: (id) => t('reward.itemFull', { name: itemName(getItem(id)) }),
    key: (c) => t('reward.key', { name: keyName(c) }),
    stat: (s, n) => `${t(`stat.${s}` as any)} ${n >= 0 ? '+' : ''}${n}`,
  });
  await ui.msg.say(td('event', ev.id, `result${idx}${success ? '' : 'f'}`, result.text));
  applied.notes.forEach((n) => ui.toast(n.text, n.good ? 'good' : 'bad'));
  ui.msg.hide();

  if (gs.isDead) return 'lost';
  for (const p of applied.pending) {
    if (p.kind === 'card') {
      gs.addCard(p.cardId);
      ui.toast(t('reward.cardAdded', { name: cardName(getCard(p.cardId)) }), 'good');
    } else if (p.kind === 'equipment') await ctx.giveEquipment(p.equipmentId);
    else if (p.kind === 'levelUp') await openStatusPanel(gs, { levelUp: p.levels });
    else if (p.kind === 'battle') {
      const r = await runBattle(ctx, p.elite ? 'elite' : 'normal');
      if (r === 'lost') return 'lost';
      await runRewards(ctx, p.elite ? 'elite' : 'normal');
    }
  }
  return 'ok';
}
