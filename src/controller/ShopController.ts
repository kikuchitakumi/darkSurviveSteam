// =============================================================
// ShopController.ts  【Controller：ショップ】
// -------------------------------------------------------------
// 品揃えを Model（Loot.rollShop）で決め、ShopScene に表示させる。
// 購入時の所持金チェック・付与はここで行う。
// 20% の確率で闇商人（高額・強力な品）になる。
// =============================================================
import { Audio } from '@/core/AudioManager';
import { getCard } from '@/data/cards';
import { t } from '@/i18n';
import { Combat } from '@/model/Combat';
import { cardRemovePrice, rollShop } from '@/model/Loot';
import { ui } from '@/view/ui';
import { showShop } from '@/view/scenes/ShopScene';
import { pickCard } from '@/view/panels/DeckViewer';
import { cardName } from '@/view/text';
import type { GameController } from './GameController';

export async function runShop(ctx: GameController): Promise<void> {
  const gs = ctx.gs!;
  const stock = rollShop(gs.data.floor, gs.rng);
  let removeUsed = false;
  Audio.playBgm('bgm_shop');

  let done!: Promise<void>;
  await ui.stage.fadeTransition(() => {
    ui.msg.hide();
    done = showShop(stock, {
      gold: () => gs.data.gold,
      numbersOf: (id) => Combat.previewNumbers(gs, getCard(id)),
      removePrice: () => cardRemovePrice(gs.data.cardRemoveCount),
      removeUsed: () => removeUsed,

      onBuy: async (i) => {
        const e = stock.entries[i];
        if (e.sold || gs.data.gold < e.price) return false;
        if (e.kind === 'item' && gs.itemSlotsFree <= 0) {
          Audio.play('se_error');
          ui.toast(t('shop.itemFull'), 'bad');
          return false;
        }
        gs.spendGold(e.price);
        e.sold = true;
        switch (e.kind) {
          case 'card':
            gs.addCard(e.id);
            ui.toast(t('reward.cardAdded', { name: cardName(getCard(e.id)) }), 'good');
            break;
          case 'item':
            gs.addItem(e.id);
            break;
          case 'key':
            gs.addKey(e.id);
            break;
          case 'equipment':
            await ctx.giveEquipment(e.id);
            break;
        }
        ctx.save();
        return true;
      },

      onRemoveCard: async () => {
        const price = cardRemovePrice(gs.data.cardRemoveCount);
        const c = await pickCard(gs.data.deck, t('shop.chooseRemove'));
        if (!c || !gs.spendGold(price)) return false;
        gs.removeCard(c.uid);
        gs.data.cardRemoveCount++;
        removeUsed = true;
        ctx.save();
        return true;
      },
    });
  });
  await done;
}
