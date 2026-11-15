// =============================================================
// RewardController.ts  【Controller：戦闘勝利後の報酬】
// -------------------------------------------------------------
// 仕様：勝利報酬は「G・経験値・3枚から1枚選んでデッキに追加」。
// 加えて、強敵・ボスはアイテム/装備/鍵をドロップすることがある。
// 経験値でレベルが上がった場合は、最後にステータス割り振り画面を開く。
// =============================================================
import { BALANCE } from '@/config/balance';
import { getCard } from '@/data/cards';
import { getEquipment } from '@/data/equipment';
import { getItem, KEYS } from '@/data/items';
import { IMAGES } from '@/data/images';
import { t } from '@/i18n';
import { Combat, type BattleKind } from '@/model/Combat';
import { rollBattleReward } from '@/model/Loot';
import { ui } from '@/view/ui';
import { showRewards, type RewardLine } from '@/view/scenes/RewardScene';
import { cardName, equipName, itemName, keyName } from '@/view/text';
import { openStatusPanel } from '@/view/panels/StatusPanel';
import type { GameController } from './GameController';

export async function runRewards(ctx: GameController, kind: BattleKind): Promise<void> {
  const gs = ctx.gs!;
  const reward = rollBattleReward(gs.data.floor, kind, gs.rng);
  const lines: RewardLine[] = [];

  gs.addGold(reward.gold);
  lines.push({ icon: IMAGES.icon.gold, text: t('reward.gold', { n: reward.gold }), kind: 'gold' });

  const levels = gs.addExp(reward.exp);
  lines.push({ icon: IMAGES.icon.status, text: t('reward.exp', { n: reward.exp }), kind: 'exp' });

  if (reward.itemId) {
    const def = getItem(reward.itemId);
    if (gs.addItem(reward.itemId)) lines.push({ icon: def.image, text: t('reward.item', { name: itemName(def) }), kind: 'item' });
    else lines.push({ icon: def.image, text: t('reward.itemFull', { name: itemName(def) }), kind: 'warn' });
  }
  if (reward.key) {
    gs.addKey(reward.key);
    lines.push({ icon: KEYS[reward.key].image, text: t('reward.key', { name: keyName(reward.key) }), kind: 'key' });
  }
  if (reward.equipmentId) {
    const def = getEquipment(reward.equipmentId);
    lines.push({ icon: def.image, text: t('reward.equipment', { name: equipName(def) }), kind: 'equip' });
  }
  if (kind === 'boss' && BALANCE.BOSS_FULL_HEAL) {
    gs.heal(gs.maxHp);
    lines.push({ icon: IMAGES.icon.hp, text: 'HP MAX', kind: 'item' });
  }

  const picked = await showRewards(lines, reward.cardChoices, (id) => Combat.previewNumbers(gs, getCard(id)));
  if (picked) {
    gs.addCard(picked);
    ui.toast(t('reward.cardAdded', { name: cardName(getCard(picked)) }), 'good');
  }
  if (reward.equipmentId) await ctx.giveEquipment(reward.equipmentId);
  if (levels.length) await openStatusPanel(gs, { levelUp: levels });
  ctx.save();
}
