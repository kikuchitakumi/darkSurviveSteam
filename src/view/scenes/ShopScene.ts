// =============================================================
// ShopScene.ts  【View シーン：ショップ（商人／闇商人）】
// -------------------------------------------------------------
// 商人の透過画像を背景に重ね、商品を棚に並べる。
//  - カード / アイテム / 鍵 / 装備品 / カード削除サービス
//  - 所持金が足りない商品は値段が赤くなる
// 購入の可否判定・所持金の増減は Controller（ShopController）が行う。
// =============================================================
import { Audio } from '@/core/AudioManager';
import { getCard } from '@/data/cards';
import { getEquipment } from '@/data/equipment';
import { getItem, KEYS } from '@/data/items';
import { IMAGES } from '@/data/images';
import { t } from '@/i18n';
import type { ShopEntry, ShopStock } from '@/model/Loot';
import { animate, button, clear, fmt, h, img } from '../dom';
import { ui } from '../ui';
import { createCardEl } from '../components/CardView';
import { attachTooltip } from '../components/Tooltip';
import { equipDesc, equipName, itemDesc, itemName, keyName } from '../text';

export interface ShopHandlers {
  gold: () => number;
  numbersOf: (cardId: string) => Record<string, number>;
  onBuy: (index: number) => Promise<boolean>;
  onRemoveCard: () => Promise<boolean>;
  removePrice: () => number;
  removeUsed: () => boolean;
}

export function showShop(stock: ShopStock, hd: ShopHandlers): Promise<void> {
  const root = ui.stage.scene;
  clear(root);
  ui.stage.setBackground(stock.dark ? IMAGES.darkShop : IMAGES.shop);
  ui.particles.setAmbient(stock.dark ? 'spores' : 'dust');

  const merchant = h('div.shop-merchant', {}, img(stock.dark ? IMAGES.darkMerchant : IMAGES.merchant));
  const speech = h('div.shop-speech', {}, t(stock.dark ? 'shop.darkGreeting' : 'shop.greeting'));
  const shelf = h('div.shop-shelf');
  const wrap = h(`div.scene.shop-scene${stock.dark ? '.dark' : ''}`, {}, [
    h('div.shop-title', {}, t(stock.dark ? 'shop.darkTitle' : 'shop.title')),
    merchant,
    speech,
    shelf,
  ]);
  root.append(wrap);
  animate(merchant, [{ opacity: 0, transform: 'translateX(-60px)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: 'ease-out' });

  const say = (text: string) => {
    speech.textContent = text;
    animate(speech, [{ opacity: 0.2, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], 200);
  };

  const priceTag = (price: number, sold: boolean) => h(`div.price${!sold && hd.gold() < price ? '.cant' : ''}`, {}, sold ? t('shop.sold') : [img(IMAGES.icon.gold), fmt(price)]);

  return new Promise((resolve) => {
    const buy = async (i: number) => {
      const e = stock.entries[i];
      if (e.sold) return;
      if (hd.gold() < e.price) {
        Audio.play('se_error');
        say(t('shop.notEnoughGold'));
        return;
      }
      const ok = await hd.onBuy(i);
      if (ok) {
        Audio.play('se_gold');
        say(t('shop.thanks'));
      }
      render();
    };

    const render = () => {
      clear(shelf);
      const section = (title: string, list: HTMLElement[]) => list.length && shelf.append(h('div.shop-section', {}, [h('div.shop-section-title', {}, title), h('div.shop-row', {}, list)]));

      const cards: HTMLElement[] = [];
      const goods: HTMLElement[] = [];
      stock.entries.forEach((e: ShopEntry, i) => {
        if (e.kind === 'card') {
          const el = h(`div.shop-item.shop-card${e.sold ? '.sold' : ''}`, {}, [createCardEl(getCard(e.id), { numbers: hd.numbersOf(e.id), small: true }), priceTag(e.price, e.sold)]);
          el.addEventListener('click', () => buy(i));
          cards.push(el);
        } else {
          let icon = '';
          let name = '';
          let desc = '';
          if (e.kind === 'item') { const d = getItem(e.id); icon = d.image; name = itemName(d); desc = itemDesc(d); }
          if (e.kind === 'equipment') { const d = getEquipment(e.id); icon = d.image; name = equipName(d); desc = `${t(`equip.slot.${d.slot}` as any)}\n${equipDesc(d)}`; }
          if (e.kind === 'key') { icon = KEYS[e.id].image; name = keyName(e.id); desc = KEYS[e.id].description; }
          const el = h(`div.shop-item.shop-good.kind-${e.kind}${e.sold ? '.sold' : ''}`, {}, [img(icon, 'shop-good-icon'), h('div.shop-good-name', {}, name), priceTag(e.price, e.sold)]);
          attachTooltip(el, () => ({ title: name, body: desc.replace('{heal}', '15+') }));
          el.addEventListener('click', () => buy(i));
          goods.push(el);
        }
      });
      section(t('shop.cards'), cards);
      section(`${t('shop.items')} / ${t('shop.equipment')}`, goods);

      // カード削除サービス（通常の商人のみ）
      if (!stock.dark) {
        const used = hd.removeUsed();
        const price = hd.removePrice();
        const svc = h(`div.shop-item.shop-service${used ? '.sold' : ''}`, {}, [h('div.shop-service-icon', {}, '✂'), h('div.shop-good-name', {}, t('shop.removeCard')), h('div.shop-service-desc', {}, t('shop.removeCardDesc')), priceTag(price, used)]);
        svc.addEventListener('click', async () => {
          if (used) return;
          if (hd.gold() < price) { Audio.play('se_error'); say(t('shop.notEnoughGold')); return; }
          if (await hd.onRemoveCard()) { Audio.play('se_card_exhaust'); say(t('shop.thanks')); }
          render();
        });
        section(t('shop.services'), [svc]);
      }
    };
    render();
    wrap.append(h('div.shop-leave', {}, [button(t('shop.leave'), () => resolve(), { cls: 'primary', se: 'se_door' })]));
  });
}
