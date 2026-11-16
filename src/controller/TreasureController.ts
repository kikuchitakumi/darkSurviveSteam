// =============================================================
// TreasureController.ts  【Controller：宝物庫】
// -------------------------------------------------------------
// 仕様：
//  - 宝物庫の背景に 赤・青・黄・緑 の宝箱を透過画像で配置
//  - 対応する鍵を持っていると「宝箱を開ける」選択肢が出る
//  - 選択肢には常に「帰る」がある
// 宝箱の中身は data/treasures.ts、抽選は model/Loot.ts。
// =============================================================
import { Audio } from '@/core/AudioManager';
import { getCard } from '@/data/cards';
import { getEquipment } from '@/data/equipment';
import { getItem } from '@/data/items';
import { IMAGES } from '@/data/images';
import { TREASURE_CHESTS } from '@/data/treasures';
import { t } from '@/i18n';
import { rollTreasure } from '@/model/Loot';
import { KEY_COLORS, type KeyColor } from '@/model/types';
import { ui } from '@/view/ui';
import { showObjectScene, type ObjectSceneHandle } from '@/view/scenes/ObjectScene';
import { cardName, equipName, itemName } from '@/view/text';
import { centerOf } from '@/view/dom';
import type { GameController } from './GameController';

const CHEST_X: Record<KeyColor, number> = { red: 450, blue: 790, yellow: 1130, green: 1470 };

export async function runTreasure(ctx: GameController): Promise<void> {
  const gs = ctx.gs!;
  const opened = new Set<KeyColor>();
  const colorName = (c: KeyColor) => t(`treasure.color.${c}` as any);

  let scene!: ObjectSceneHandle;
  Audio.play('se_door');
  await ui.stage.fadeTransition(() => {
    scene = showObjectScene({
      background: IMAGES.treasureRoom,
      title: t('treasure.title'),
      ambient: 'dust',
      objects: KEY_COLORS.map((c) => ({ id: c, image: TREASURE_CHESTS[c].image, x: CHEST_X[c], y: 650, height: 230, label: colorName(c) })),
    });
  });
  await ui.msg.say(t('treasure.intro'));

  while (true) {
    const options = KEY_COLORS.filter((c) => gs.data.keys[c] > 0 && !opened.has(c));
    const labels = [...options.map((c) => ({ label: t('treasure.open', { color: colorName(c) }), cls: `chest-${c}` })), { label: t('treasure.leave') }];
    // 鍵が無い宝箱には「鍵が必要」と表示（ホバーのヒント）
    KEY_COLORS.forEach((c) => scene.setClass(c, 'locked', gs.data.keys[c] <= 0 && !opened.has(c)));
    const idx = await ui.msg.choose(labels, options.length ? undefined : t('treasure.locked', { color: KEY_COLORS.filter((c) => !opened.has(c)).map(colorName).join('・') }));
    if (idx >= options.length) break;

    const color = options[idx];
    gs.useKey(color);
    opened.add(color);
    Audio.play('se_chest');
    scene.setClass(color, 'opened', true);
    scene.pulse(color);
    const el = scene.get(color);
    if (el) {
      const p = centerOf(el, ui.stage.el, ui.stage.scale);
      ui.particles.burst(p.x, p.y, 'gold', 2);
      ui.fx.ring(p.x, p.y, 'rgba(255,220,120,0.9)', 360);
    }

    const loot = rollTreasure(TREASURE_CHESTS[color], gs.rng, gs.data.floor);
    const got: string[] = [];
    if (loot.gold) { gs.addGold(loot.gold); got.push(`${loot.gold}G`); Audio.play('se_gold'); }
    for (const id of loot.items) {
      const name = itemName(getItem(id));
      if (gs.addItem(id)) got.push(name);
      else ui.toast(t('reward.itemFull', { name }), 'bad');
    }
    for (const id of loot.cards) { gs.addCard(id); got.push(cardName(getCard(id))); }
    for (const id of loot.equipment) got.push(equipName(getEquipment(id)));
    await ui.msg.say(got.map((g) => t('treasure.got', { name: g })).join('\n') || t('treasure.opened'));
    for (const id of loot.equipment) await ctx.giveEquipment(id);
    ctx.save();
  }
  ui.msg.hide();
}
