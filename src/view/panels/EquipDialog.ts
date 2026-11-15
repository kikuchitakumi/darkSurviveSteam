// =============================================================
// EquipDialog.ts  【View パネル：装備の入れ替え確認】
// -------------------------------------------------------------
// 新しい装備を手に入れた時、同じ部位に装備があれば
// 「現在の装備」と「新しい装備」を並べて比較し、どちらにするか選ばせる。
// =============================================================
import { getEquipment } from '@/data/equipment';
import { t } from '@/i18n';
import type { EquipmentDef } from '@/model/types';
import { button, h, img } from '../dom';
import { openModal } from '../components/Modal';
import { equipDesc, equipName } from '../text';

function equipCard(def: EquipmentDef | null, label: string): HTMLElement {
  return h(`div.equip-card${def ? '.rarity-' + def.rarity : ''}`, {}, [
    h('div.equip-card-label', {}, label),
    def ? img(def.image, 'equip-card-icon') : h('div.equip-card-icon.empty'),
    h('div.equip-card-name', {}, def ? equipName(def) : t('equip.none')),
    h('div.equip-card-slot', {}, def ? t(`equip.slot.${def.slot}` as any) : ''),
    h('div.equip-card-desc', {}, def ? equipDesc(def) : ''),
  ]);
}

/** true = 新しい装備を装備する / false = 捨てる */
export function askEquipSwap(currentId: string | null, newId: string): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false;
    const cur = currentId ? getEquipment(currentId) : null;
    const nw = getEquipment(newId);
    const body = h('div.equip-compare', {}, [equipCard(cur, t('equip.current')), h('div.equip-arrow', {}, '▶'), equipCard(nw, t('equip.new'))]);
    const m = openModal(t('equip.swapTitle'), body, {
      dismissable: false,
      onClose: () => resolve(answer),
      footer: [
        button(t('equip.discard'), () => { answer = false; m.close(); }, { se: 'se_cancel' }),
        button(t('equip.equip'), () => { answer = true; m.close(); }, { cls: 'primary' }),
      ],
    });
  });
}
