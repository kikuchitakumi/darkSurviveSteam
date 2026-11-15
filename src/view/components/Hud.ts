// =============================================================
// Hud.ts  【View部品：画面上部のステータスバー】
// -------------------------------------------------------------
// 階・HP・所持金・レベル/経験値・鍵・アイテム・各種ボタンを常に表示する。
// GameState の変更（stateChanged）を受けて自動で表示を更新する。
// 戦闘中はアニメーションと表示を合わせるため、HP表示を lock できる。
// =============================================================
import { bus } from '@/core/EventBus';
import { IMAGES } from '@/data/images';
import { getItem } from '@/data/items';
import { BALANCE, zoneOfFloor } from '@/config/balance';
import { t } from '@/i18n';
import type { GameState } from '@/model/GameState';
import { KEY_COLORS } from '@/model/types';
import { seedToString } from '@/core/Random';
import { animate, button, clear, fmt, h, img } from '../dom';
import { attachTooltip } from './Tooltip';
import { itemDesc, itemName, keyName } from '../text';
import type { Combat } from '@/model/Combat';

export interface HudHandlers {
  onItem: (index: number, el: HTMLElement) => void;
  onDeck: () => void;
  onStatus: () => void;
  onMenu: () => void;
}

export class Hud {
  private el: HTMLElement;
  private gs: GameState | null = null;
  private refs!: {
    floor: HTMLElement; zone: HTMLElement; hpFill: HTMLElement; hpLag: HTMLElement; hpText: HTMLElement;
    gold: HTMLElement; level: HTMLElement; expFill: HTMLElement; keys: HTMLElement; items: HTMLElement;
    statusBadge: HTMLElement; seed: HTMLElement;
  };
  /** true の間、HP は showHp() でのみ更新される（戦闘演出用） */
  hpLock = false;
  private lastGold = 0;
  /** 戦闘中だけ、回復量の計算に Combat を使う（ツールチップ用） */
  combat: Combat | null = null;

  constructor(layer: HTMLElement, private handlers: HudHandlers) {
    this.el = h('div.hud');
    layer.append(this.el);
    this.build();
    bus.on('stateChanged', () => this.refresh());
    bus.on('languageChanged', () => { this.build(); this.refresh(); });
  }

  private build(): void {
    clear(this.el);
    const floor = h('div.hud-floor-num');
    const zone = h('div.hud-floor-zone');
    const hpFill = h('div.bar-fill.hp');
    const hpLag = h('div.bar-lag');
    const hpText = h('div.bar-text');
    const gold = h('span.hud-gold-text');
    const level = h('div.hud-level-text');
    const expFill = h('div.bar-fill.exp');
    const keys = h('div.hud-keys');
    const items = h('div.hud-items');
    const statusBadge = h('div.badge');
    const seed = h('div.hud-seed');

    const hpBox = h('div.hud-hp', {}, [img(IMAGES.icon.hp, 'hud-icon'), h('div.bar.bar-hp', {}, [hpLag, hpFill, hpText])]);
    attachTooltip(hpBox, () => (this.gs ? { title: 'HP', body: `${this.gs.hp} / ${this.gs.maxHp}\n${t('stat.hp.desc')}` } : null));
    const goldBox = h('div.hud-gold', {}, [img(IMAGES.icon.gold, 'hud-icon'), gold]);
    const lvBox = h('div.hud-level', {}, [level, h('div.bar.bar-exp', {}, [expFill])]);
    attachTooltip(lvBox, () => (this.gs ? { title: `${t('stat.level')} ${this.gs.data.level}`, body: `${t('stat.exp')} ${this.gs.data.exp} / ${this.gs.expToNext}` } : null));

    const statusBtn = button(t('hud.status'), () => this.handlers.onStatus(), { cls: 'hud-btn' });
    statusBtn.prepend(img(IMAGES.icon.status, 'hud-btn-icon'));
    statusBtn.append(statusBadge);

    const deckBtn = button(t('hud.deck'), () => this.handlers.onDeck(), { cls: 'hud-btn' });
    deckBtn.prepend(img(IMAGES.icon.deck, 'hud-btn-icon'));
    const menuBtn = button(t('hud.menu'), () => this.handlers.onMenu(), { cls: 'hud-btn' });
    menuBtn.prepend(img(IMAGES.icon.menu, 'hud-btn-icon'));

    this.el.append(
      h('div.hud-left', {}, [h('div.hud-floor', {}, [img(IMAGES.icon.floor, 'hud-icon'), h('div', {}, [floor, zone])]), hpBox, goldBox, lvBox]),
      h('div.hud-center', {}, [keys, items]),
      h('div.hud-right', {}, [deckBtn, statusBtn, menuBtn, seed]),
    );
    this.refs = { floor, zone, hpFill, hpLag, hpText, gold, level, expFill, keys, items, statusBadge, seed };
  }

  /** 表示対象のゲーム状態を設定（null で非表示） */
  bind(gs: GameState | null): void {
    this.gs = gs;
    this.el.classList.toggle('visible', !!gs);
    if (gs) this.lastGold = gs.data.gold;
    this.refresh();
  }

  setVisible(v: boolean): void {
    this.el.classList.toggle('visible', v && !!this.gs);
  }

  /** HP表示を直接更新（戦闘演出用） */
  showHp(hp: number, max: number): void {
    const r = this.refs;
    const pct = Math.max(0, Math.min(100, (hp / max) * 100));
    r.hpFill.style.width = `${pct}%`;
    setTimeout(() => (r.hpLag.style.width = `${pct}%`), 350);
    r.hpText.textContent = `${hp} / ${max}`;
    r.hpFill.classList.toggle('low', pct <= 30);
  }

  refresh(): void {
    const gs = this.gs;
    if (!gs) return;
    const d = gs.data;
    const r = this.refs;
    r.floor.textContent = t('common.floor', { n: d.floor });
    r.zone.textContent = t('floor.zone', { n: zoneOfFloor(d.floor) }) + ` / ${BALANCE.MAX_FLOOR}F`;
    if (!this.hpLock) this.showHp(d.hp, gs.maxHp);
    // 所持金は増減した時にアニメーション
    if (d.gold !== this.lastGold) {
      animate(r.gold, [{ transform: 'scale(1.5)', color: d.gold > this.lastGold ? '#ffe28a' : '#ff6b6b' }, { transform: 'scale(1)' }], 400);
      this.lastGold = d.gold;
    }
    r.gold.textContent = fmt(d.gold);
    r.level.textContent = `Lv ${d.level}`;
    r.expFill.style.width = `${Math.min(100, (d.exp / gs.expToNext) * 100)}%`;
    r.statusBadge.textContent = d.statPoints > 0 ? String(d.statPoints) : '';
    r.statusBadge.classList.toggle('visible', d.statPoints > 0);
    r.seed.textContent = `${t('hud.seed')} ${seedToString(d.seed)}`;

    // 鍵
    clear(r.keys);
    for (const c of KEY_COLORS) {
      const k = h(`div.hud-key.key-${c}${d.keys[c] > 0 ? '.has' : ''}`, {}, [img(`images/items/key_${c}.png`), h('span', {}, String(d.keys[c]))]);
      attachTooltip(k, () => ({ title: keyName(c), body: `× ${d.keys[c]}` }));
      r.keys.append(k);
    }
    // アイテム枠
    clear(r.items);
    for (let i = 0; i < BALANCE.ITEM_SLOTS; i++) {
      const id = d.items[i];
      const slot = h(`div.hud-item${id ? '.filled' : ''}`);
      if (id) {
        const def = getItem(id);
        slot.append(img(def.image));
        slot.addEventListener('click', () => this.handlers.onItem(i, slot));
        attachTooltip(slot, () => {
          const heal = def.effects.find((e) => e.kind === 'heal') as { amount: number; scale?: 'mag' | 'none' } | undefined;
          const healV = heal ? heal.amount + (heal.scale === 'mag' ? gs.stats.mag : 0) : 0;
          return { title: itemName(def), body: itemDesc(def).replace('{heal}', String(healV)), footer: def.usable === 'battle' ? '⚔ Battle only' : '' };
        });
      }
      r.items.append(slot);
    }
  }

  /** 指定アイテム枠の要素（エフェクト位置用） */
  itemSlotEl(i: number): HTMLElement | null {
    return this.refs.items.children[i] as HTMLElement | null;
  }
}
