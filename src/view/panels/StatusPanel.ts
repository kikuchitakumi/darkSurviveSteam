// =============================================================
// StatusPanel.ts  【View パネル：ステータス確認・ポイント割り振り】
// -------------------------------------------------------------
// 主人公のステータス・装備を表示し、未使用のステータスポイントがあれば
// ＋／－ボタンで割り振れる。レベルアップ時にも自動で開かれる。
// 実際の数値の変更は GameState.allocate()（Model）で行う。
// =============================================================
import { Audio } from '@/core/AudioManager';
import { BALANCE } from '@/config/balance';
import { getEquipment } from '@/data/equipment';
import { t } from '@/i18n';
import type { GameState } from '@/model/GameState';
import { STAT_KEYS, type EquipSlot, type StatKey, type Stats } from '@/model/types';
import { button, clear, h, img } from '../dom';
import { openModal } from '../components/Modal';
import { attachTooltip } from '../components/Tooltip';
import { equipDesc, equipName } from '../text';

export function openStatusPanel(gs: GameState, opts: { levelUp?: number[] } = {}): Promise<void> {
  const alloc: Stats = { hp: 0, atk: 0, def: 0, mag: 0, luk: 0 };
  const body = h('div.status-panel');
  const left = () => gs.data.statPoints - STAT_KEYS.reduce((s, k) => s + alloc[k], 0);

  const render = () => {
    clear(body);
    const st = gs.stats;
    // ---- レベルアップ表示 ----
    if (opts.levelUp?.length) {
      const lv = opts.levelUp[opts.levelUp.length - 1];
      body.append(h('div.levelup-head', {}, [
        h('div.levelup-title', {}, t('level.up')),
        h('div.levelup-sub', {}, t('level.reached', { n: lv })),
        opts.levelUp.some((l) => l % 10 === 0) ? h('div.levelup-bonus', {}, t('level.bonus')) : null,
      ]));
    }
    body.append(h('div.points-left', {}, t('level.points', { n: left() })));

    // ---- ステータス一覧 ----
    const rows = h('div.stat-rows');
    rows.append(h('div.stat-row.stat-level', {}, [h('div.stat-name', {}, t('stat.level')), h('div.stat-val', {}, String(gs.data.level)), h('div.stat-ctrl'), h('div.stat-extra', {}, `${t('stat.exp')} ${gs.data.exp}/${gs.expToNext}`)]));
    for (const k of STAT_KEYS) {
      const base = gs.data.baseStats[k];
      const bonus = gs.equipBonus(k);
      const canAdd = left() > 0 && base + alloc[k] < BALANCE.STAT_MAX;
      const row = h(`div.stat-row${gs.data.talents.includes(k) ? '.talent' : ''}`, {}, [
        h('div.stat-name', {}, t(`stat.${k}` as any)),
        h('div.stat-val', {}, [
          String(base + alloc[k]),
          alloc[k] ? h('span.stat-add', {}, ` (+${alloc[k]})`) : null,
          bonus ? h(`span.stat-bonus${bonus < 0 ? '.neg' : ''}`, {}, ` ${bonus > 0 ? '+' : ''}${bonus}`) : null,
        ]),
        h('div.stat-ctrl', {}, gs.data.statPoints > 0 ? [
          button('－', () => { if (alloc[k] > 0) { alloc[k]--; render(); } }, { cls: 'mini', disabled: alloc[k] <= 0, se: 'se_cancel' }),
          button('＋', () => { if (canAdd) { alloc[k]++; Audio.play('se_buff'); render(); } }, { cls: 'mini', disabled: !canAdd, se: 'se_hover' }),
        ] : []),
        h('div.stat-extra', {}, k === 'hp' ? `HP ${gs.hp}/${gs.maxHp}` : k === 'luk' ? `${t('status.crit')} ${(st.luk / 99 * 50).toFixed(1)}%` : ''),
      ]);
      attachTooltip(row, () => t(`stat.${k}.desc` as any));
      rows.append(row);
    }
    rows.append(h('div.stat-row', {}, [h('div.stat-name', {}, 'AP'), h('div.stat-val', {}, String(gs.maxAp)), h('div.stat-ctrl'), h('div.stat-extra', {}, t('stat.ap.desc'))]));
    body.append(rows);

    // ---- 装備 ----
    const eqBox = h('div.equip-box', {}, [h('div.section-title', {}, t('status.equipment'))]);
    for (const slot of ['weapon', 'armor', 'accessory'] as EquipSlot[]) {
      const id = gs.data.equipment[slot];
      const def = id ? getEquipment(id) : null;
      const row = h('div.equip-row', {}, [
        h('div.equip-slot', {}, t(`equip.slot.${slot}` as any)),
        def ? img(def.image, 'equip-icon') : h('div.equip-icon.empty'),
        h('div.equip-name', {}, def ? equipName(def) : t('equip.none')),
        h('div.equip-desc', {}, def ? equipDesc(def).replace(/\n/g, ' / ') : ''),
      ]);
      eqBox.append(row);
    }
    body.append(eqBox);
  };
  render();

  return new Promise((resolve) => {
    const commit = () => {
      const used = STAT_KEYS.some((k) => alloc[k] > 0);
      if (used) {
        gs.allocate(alloc);
        Audio.play('se_levelup');
      }
      (Object.keys(alloc) as StatKey[]).forEach((k) => (alloc[k] = 0));
    };
    const footer = gs.data.statPoints > 0
      ? [
          button(t('level.reset'), () => { (Object.keys(alloc) as StatKey[]).forEach((k) => (alloc[k] = 0)); render(); }, { se: 'se_cancel' }),
          button(t('level.confirm'), () => { commit(); m.close(); }, { cls: 'primary' }),
        ]
      : [button(t('common.close'), () => m.close())];
    const m = openModal(opts.levelUp?.length ? t('level.up') : t('status.title'), body, { cls: `modal-status${opts.levelUp?.length ? '.is-levelup' : ''}`, onClose: () => resolve(), footer });
  });
}
