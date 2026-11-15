// =============================================================
// BattleScene.ts  【View シーン：戦闘画面】
// -------------------------------------------------------------
// 戦闘の「見た目」と「入力」を担当する。ルールは一切持たない。
//
// ■ 画面構成（1920x1080）
//   上部        : HUD（共通）
//   中央        : 敵（最大3体）。頭上に意図、足元に名前・HP・状態異常
//   左下        : プレイヤーのHP/ブロック/状態異常、AP、山札
//   下中央      : 手札（扇形に並ぶ）
//   右下        : ターン終了ボタン、捨て札、廃棄
//
// ■ 演出の仕組み
//   Model(Combat) が出した CombatEvent の一覧を play() で受け取り、
//   1つずつアニメーションしながら表示を更新する。
//   表示用の値（vState）は Model とは別に持ち、演出の進行に合わせて変える。
//   最後に syncAll() で Model と完全に一致させる（ズレ防止）。
//
// ■ 入力
//   - カードをクリック：対象不要なら即使用／敵対象なら矢印で狙う
//   - カードをドラッグ：上に投げると使用／敵の上で離すとその敵に使用
//   - [1]～[9],[0]：手札のカードを選択　[E]：ターン終了　[Esc]/右クリック：キャンセル
// =============================================================
import { Audio } from '@/core/AudioManager';
import { getCard } from '@/data/cards';
import { getItem } from '@/data/items';
import { IMAGES } from '@/data/images';
import { STATUS_EFFECTS } from '@/data/statusEffects';
import { t } from '@/i18n';
import type { Combat, CombatEvent, EnemyInstance, PendingChoice, Ref, StatusMap } from '@/model/Combat';
import type { StatusId } from '@/model/types';
import { animate, button, clear, h, img, wait } from '../dom';
import { ui } from '../ui';
import { createCardEl, updateCardNumbers } from '../components/CardView';
import { attachTooltip } from '../components/Tooltip';
import { isModalOpen } from '../components/Modal';
import { enemyDesc, enemyName, itemName, statusDesc, statusName } from '../text';
import { showPile } from '../panels/DeckViewer';
import type { AmbientKind } from '../effects/Particles';

/** 表示用の参加者の状態 */
interface VState {
  hp: number;
  maxHp: number;
  block: number;
  statuses: StatusMap;
}

interface EnemyView {
  el: HTMLElement;
  sprite: HTMLElement;
  hpFill: HTMLElement;
  hpLag: HTMLElement;
  hpText: HTMLElement;
  block: HTMLElement;
  statuses: HTMLElement;
  intent: HTMLElement;
}

// 画面レイアウト用の定数
const HAND_Y = 948; // 手札カードの中心Y
const PLAY_ZONE = { x: 960, y: 560 };
const ENEMY_FOOT_Y = 650;
/** 敵画像の基本の高さ（data/enemies.ts の scale が掛かる） */
const ENEMY_BASE_HEIGHT = 300;
const DRAW_POS = { x: 110, y: 990 };
const DISCARD_POS = { x: 1810, y: 990 };
const PLAYER_POS = { x: 960, y: 760 };

export class BattleScene {
  root: HTMLElement;
  private enemyLayer: HTMLElement;
  private handEl: HTMLElement;
  private enemyViews = new Map<number, EnemyView>();
  private cardEls = new Map<string, HTMLElement>();
  private playing = new Map<string, HTMLElement>();
  private player!: { hpFill: HTMLElement; hpLag: HTMLElement; hpText: HTMLElement; block: HTMLElement; statuses: HTMLElement };
  private apOrb!: HTMLElement;
  private drawCount!: HTMLElement;
  private discardCount!: HTMLElement;
  private exhaustCount!: HTMLElement;
  private endTurnBtn!: HTMLButtonElement;
  private hintEl!: HTMLElement;
  private arrow!: SVGSVGElement;
  private arrowPath!: SVGPathElement;

  /** 表示用の状態（'p' = プレイヤー, 'e0'～'e2' = 敵） */
  private vState = new Map<string, VState>();
  private vDraw = 0;
  private vDiscard = 0;
  private vExhaust = 0;

  /** 演出中は入力を受け付けない */
  busy = false;
  private targeting: { uid: string; resolve?: (i: number | null) => void } | null = null;
  private hoverEnemy: number | null = null;
  private hoveredCard: string | null = null;
  private choosing: { count: number; picked: Set<string>; candidates: string[]; resolve: (uids: string[]) => void } | null = null;
  private keyHandler: (e: KeyboardEvent) => void;
  private moveHandler: (e: PointerEvent) => void;

  // ---- Controller が設定する入力ハンドラ ----
  onPlayCard: (uid: string, target: number | null) => void = () => {};
  onEndTurn: () => void = () => {};

  constructor(private combat: Combat, opts: { background: string; ambient?: AmbientKind; tint?: string }) {
    const stage = ui.stage;
    clear(stage.scene);
    ui.msg.hide();
    ui.hud.setVisible(true);
    ui.hud.hpLock = true;
    stage.setBackground(opts.background, { tint: opts.tint });
    ui.particles.setAmbient(opts.ambient ?? 'dust');

    this.enemyLayer = h('div.enemy-layer');
    this.handEl = h('div.hand');
    this.root = h('div.scene.battle-scene', {}, [this.enemyLayer]);
    this.buildUi();
    this.root.append(this.handEl);
    stage.scene.append(this.root);

    // 初期の表示状態（Combat.start() の前に作るので、山札＝デッキ全体）
    this.vState.set('p', { hp: combat.playerHp, maxHp: combat.gs.maxHp, block: 0, statuses: {} });
    this.vDraw = combat.gs.data.deck.length;
    combat.enemies.forEach((e) => this.createEnemyView(e, false));
    this.renderCounts();
    this.renderPlayer();
    ui.hud.showHp(combat.playerHp, combat.gs.maxHp);

    this.keyHandler = (e) => this.onKey(e);
    this.moveHandler = (e) => this.onPointerMove(e);
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('pointermove', this.moveHandler);
    this.root.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancelTargeting();
    });
    this.root.addEventListener('click', (e) => {
      // 敵以外をクリックしたら狙いをキャンセル
      if (this.targeting && !(e.target as HTMLElement).closest('.enemy')) this.cancelTargeting();
    });
  }

  /** シーン終了時の後片付け */
  destroy(): void {
    window.removeEventListener('keydown', this.keyHandler);
    window.removeEventListener('pointermove', this.moveHandler);
    ui.hud.hpLock = false;
    ui.stage.setLowHp(false);
  }

  // =========================================================
  // UI 構築
  // =========================================================
  private buildUi(): void {
    // ---- プレイヤーパネル ----
    const hpFill = h('div.bar-fill.hp');
    const hpLag = h('div.bar-lag');
    const hpText = h('div.bar-text');
    const block = h('div.block-badge', {}, [img(IMAGES.icon.block), h('span')]);
    const statuses = h('div.status-row');
    this.player = { hpFill, hpLag, hpText, block, statuses };
    const panel = h('div.player-panel', {}, [h('div.player-label', {}, 'YOU'), h('div.player-hp', {}, [block, h('div.bar.bar-hp.big', {}, [hpLag, hpFill, hpText])]), statuses]);

    // ---- AP ----
    this.apOrb = h('div.ap-orb', {}, [h('div.ap-orb-ring'), h('div.ap-orb-text')]);
    attachTooltip(this.apOrb, () => ({ title: 'AP', body: t('stat.ap.desc') }));

    // ---- 山札・捨て札・廃棄 ----
    this.drawCount = h('div.pile-count');
    this.discardCount = h('div.pile-count');
    this.exhaustCount = h('div.pile-count');
    const drawPile = h('div.pile.pile-draw', { onclick: () => showPile(this.combat.drawPile, t('battle.drawPile')) }, [img(IMAGES.icon.deck), this.drawCount, h('div.pile-label', {}, t('battle.drawPile'))]);
    const discardPile = h('div.pile.pile-discard', { onclick: () => showPile(this.combat.discardPile, t('battle.discardPile')) }, [img(IMAGES.icon.discard), this.discardCount, h('div.pile-label', {}, t('battle.discardPile'))]);
    const exhaustPile = h('div.pile.pile-exhaust', { onclick: () => showPile(this.combat.exhaustPile, t('battle.exhaustPile')) }, [img(IMAGES.icon.exhaust), this.exhaustCount, h('div.pile-label', {}, t('battle.exhaustPile'))]);

    // ---- ターン終了 ----
    this.endTurnBtn = button(t('battle.endTurn'), () => !this.busy && !this.choosing && this.onEndTurn(), { cls: 'end-turn-btn', se: 'se_click' });
    this.hintEl = h('div.battle-hint');

    // ---- 狙いの矢印（SVG） ----
    const NS = 'http://www.w3.org/2000/svg';
    this.arrow = document.createElementNS(NS, 'svg');
    this.arrow.classList.add('target-arrow');
    this.arrow.setAttribute('viewBox', '0 0 1920 1080');
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = '<marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#ff3b3b"/></marker>';
    this.arrowPath = document.createElementNS(NS, 'path');
    this.arrowPath.setAttribute('marker-end', 'url(#arrowhead)');
    this.arrow.append(defs, this.arrowPath);

    this.root.append(panel, this.apOrb, drawPile, discardPile, exhaustPile, this.endTurnBtn, this.hintEl, this.arrow);
  }

  // =========================================================
  // 敵の表示
  // =========================================================
  /** 敵の X 座標（並び順 index と敵の総数から決める） */
  private enemyX(index: number): number {
    const n = Math.max(this.combat.enemies.length, index + 1);
    const layouts: Record<number, number[]> = { 1: [1000], 2: [760, 1240], 3: [560, 1000, 1440] };
    return (layouts[Math.min(3, n)] ?? layouts[3])[index] ?? 1000;
  }

  private createEnemyView(e: EnemyInstance, animateIn: boolean): void {
    this.enemyViews.get(e.index)?.el.remove();
    this.vState.set(`e${e.index}`, { hp: e.hp, maxHp: e.maxHp, block: e.block, statuses: { ...e.statuses } });
    const height = ENEMY_BASE_HEIGHT * (e.def.scale ?? 1);
    const sprite = h('div.enemy-sprite', {}, [img(e.def.image)]);
    sprite.style.height = `${height}px`;
    sprite.style.animationDelay = `${-Math.random() * 3}s`;
    const hpFill = h('div.bar-fill.enemy-hp');
    const hpLag = h('div.bar-lag');
    const hpText = h('div.bar-text');
    const block = h('div.block-badge.small', {}, [img(IMAGES.icon.block), h('span')]);
    const statuses = h('div.status-row.small');
    const intent = h('div.intent');
    const el = h(`div.enemy.enemy-${e.def.kind}`, { dataset: { index: String(e.index) } }, [
      h('div.enemy-shadow'),
      intent,
      sprite,
      h('div.enemy-info', {}, [h('div.enemy-name', {}, enemyName(e.def)), h('div.enemy-hp', {}, [block, h('div.bar.bar-enemy', {}, [hpLag, hpFill, hpText])]), statuses]),
    ]);
    el.style.left = `${this.enemyX(e.index)}px`;
    el.style.top = `${ENEMY_FOOT_Y}px`;
    attachTooltip(sprite, () => ({ title: enemyName(e.def), body: enemyDesc(e.def) }));
    attachTooltip(intent, () => {
      const it = this.combat.intentOf(this.combat.enemies[e.index]);
      if (!it) return null;
      const type = t(`battle.intent.${it.type}` as any);
      const dmg = it.damage !== undefined ? `\n${it.damage}${(it.hits ?? 1) > 1 ? ` × ${it.hits}` : ''}` : '';
      return { title: it.name, body: `${type}${dmg}` };
    });
    // 敵のクリック・ホバー（狙い用）
    el.addEventListener('pointerenter', () => this.setHoverEnemy(e.index));
    el.addEventListener('pointerleave', () => this.setHoverEnemy(null));
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.clickEnemy(e.index);
    });
    this.enemyViews.set(e.index, { el, sprite, hpFill, hpLag, hpText, block, statuses, intent });
    this.enemyLayer.append(el);
    this.renderEnemy(e.index);
    if (animateIn) {
      animate(sprite, [{ opacity: 0, filter: 'brightness(0) blur(10px)', transform: 'translateY(40px) scale(0.9)' }, { opacity: 1, filter: 'brightness(1) blur(0)', transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.2,.9,.3,1)' });
    }
    // 位置を詰め直す（召喚で敵の数が変わった時）
    this.enemyViews.forEach((v, i) => (v.el.style.left = `${this.enemyX(i)}px`));
  }

  /** 敵の登場演出（戦闘開始時） */
  async introEnemies(kind: 'normal' | 'elite' | 'boss', bossName?: string): Promise<void> {
    this.busy = true;
    const views = Array.from(this.enemyViews.values());
    views.forEach((v) => (v.el.style.opacity = '0'));
    if (kind === 'boss') {
      Audio.duck(true);
      Audio.play('se_heartbeat');
      await wait(400);
      Audio.play('se_heartbeat');
    }
    await Promise.all(views.map((v, i) => {
      v.el.style.opacity = '';
      return animate(v.el, [{ opacity: 0, filter: 'brightness(0)', transform: 'translate(-50%,-100%) translateY(60px)' }, { opacity: 1, filter: 'brightness(1)', transform: 'translate(-50%,-100%)' }], { duration: kind === 'boss' ? 1600 : 700, delay: i * 140, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
    }));
    if (kind === 'boss') {
      ui.fx.shake(1.4, 600);
      await ui.fx.banner(t('battle.bossAppear'), { sub: bossName, cls: 'banner-boss', hold: 1100 });
      Audio.duck(false);
    } else if (kind === 'elite') {
      ui.fx.shake(0.8);
      await ui.fx.banner(t('battle.eliteAppear'), { cls: 'banner-elite', hold: 600 });
    }
    this.busy = false;
  }

  private renderEnemy(index: number): void {
    const v = this.enemyViews.get(index);
    const s = this.vState.get(`e${index}`);
    if (!v || !s) return;
    const pct = Math.max(0, (s.hp / s.maxHp) * 100);
    v.hpFill.style.width = `${pct}%`;
    setTimeout(() => (v.hpLag.style.width = `${pct}%`), 380);
    v.hpText.textContent = `${s.hp} / ${s.maxHp}`;
    this.renderBlock(v.block, s.block);
    this.renderStatuses(v.statuses, s.statuses);
  }

  private renderIntent(index: number): void {
    const v = this.enemyViews.get(index);
    const e = this.combat.enemies[index];
    if (!v || !e) return;
    clear(v.intent);
    const it = this.combat.intentOf(e);
    if (!it) {
      v.intent.classList.remove('visible');
      return;
    }
    v.intent.classList.add('visible');
    v.intent.dataset.type = it.type;
    v.intent.append(img(IMAGES.intent[it.type]));
    if (it.damage !== undefined) v.intent.append(h('span.intent-num', {}, `${it.damage}${(it.hits ?? 1) > 1 ? `×${it.hits}` : ''}`));
  }

  // =========================================================
  // プレイヤー・共通表示
  // =========================================================
  private renderPlayer(): void {
    const s = this.vState.get('p')!;
    const pct = Math.max(0, (s.hp / s.maxHp) * 100);
    this.player.hpFill.style.width = `${pct}%`;
    setTimeout(() => (this.player.hpLag.style.width = `${pct}%`), 380);
    this.player.hpText.textContent = `${s.hp} / ${s.maxHp}`;
    this.player.hpFill.classList.toggle('low', pct <= 30);
    this.renderBlock(this.player.block, s.block);
    this.renderStatuses(this.player.statuses, s.statuses);
    ui.hud.showHp(s.hp, s.maxHp);
    ui.stage.setLowHp(pct <= 25 && s.hp > 0);
  }

  private renderBlock(el: HTMLElement, block: number): void {
    el.classList.toggle('visible', block > 0);
    el.querySelector('span')!.textContent = String(block);
  }

  private renderStatuses(el: HTMLElement, st: StatusMap): void {
    clear(el);
    for (const [k, v] of Object.entries(st) as [StatusId, number][]) {
      if (!v) continue;
      const def = STATUS_EFFECTS[k];
      const icon = h(`div.status-icon.${def.polarity}`, {}, [img(def.icon), h('span', {}, k === 'stun' ? '' : String(v))]);
      attachTooltip(icon, () => ({ title: statusName(k), body: statusDesc(k, v) }));
      el.append(icon);
    }
  }

  private renderAp(pulse = false): void {
    const { ap, maxAp } = this.combat.player;
    this.apOrb.querySelector('.ap-orb-text')!.textContent = `${ap}/${maxAp}`;
    this.apOrb.classList.toggle('empty', ap <= 0);
    if (pulse) animate(this.apOrb, [{ transform: 'scale(1.25)', filter: 'brightness(1.8)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], 300);
  }

  private renderCounts(): void {
    this.drawCount.textContent = String(Math.max(0, this.vDraw));
    this.discardCount.textContent = String(Math.max(0, this.vDiscard));
    this.exhaustCount.textContent = String(Math.max(0, this.vExhaust));
    this.exhaustCount.parentElement?.classList.toggle('visible', this.vExhaust > 0);
  }

  /** Model と表示を完全に一致させる */
  syncAll(): void {
    const c = this.combat;
    this.vState.set('p', { hp: c.playerHp, maxHp: c.gs.maxHp, block: c.player.block, statuses: { ...c.player.statuses } });
    for (const e of c.enemies) {
      this.vState.set(`e${e.index}`, { hp: e.hp, maxHp: e.maxHp, block: e.block, statuses: { ...e.statuses } });
      this.renderEnemy(e.index);
      this.renderIntent(e.index);
    }
    this.renderPlayer();
    this.vDraw = c.drawPile.length;
    this.vDiscard = c.discardPile.length;
    this.vExhaust = c.exhaustPile.length;
    this.renderCounts();
    this.renderAp();
    this.refreshHandState();
    this.endTurnBtn.disabled = c.phase !== 'player';
  }

  /** 手札のカードの「使える/使えない」表示と数値を更新 */
  private refreshHandState(): void {
    for (const c of this.combat.hand) {
      const el = this.cardEls.get(c.uid);
      if (!el) continue;
      const def = getCard(c.cardId);
      const ok = this.combat.phase === 'player' && def.cost <= this.combat.player.ap;
      el.classList.toggle('playable', ok);
      el.classList.toggle('unplayable', !ok);
      updateCardNumbers(el, def, this.combat.cardNumbers(def, null));
    }
  }

  // =========================================================
  // 手札のレイアウト
  // =========================================================
  private layoutHand(): void {
    const uids = this.combat.hand.map((c) => c.uid).filter((u) => this.cardEls.has(u));
    const n = uids.length;
    const spacing = Math.min(168, 1050 / Math.max(1, n));
    const mid = (n - 1) / 2;
    const hoverIdx = this.hoveredCard ? uids.indexOf(this.hoveredCard) : -1;
    uids.forEach((uid, i) => {
      const el = this.cardEls.get(uid)!;
      if (el.classList.contains('dragging')) return;
      const off = i - mid;
      let x = 960 + off * spacing;
      let y = HAND_Y + Math.abs(off) ** 2 * 5;
      let rot = off * 3.2;
      let scale = 1;
      let z = 10 + i;
      const isTarget = this.targeting?.uid === uid;
      if (hoverIdx >= 0 && !isTarget) {
        if (i === hoverIdx) {
          y = HAND_Y - 120;
          rot = 0;
          scale = 1.32;
          z = 100;
        } else x += (i < hoverIdx ? -1 : 1) * 46;
      }
      if (isTarget) {
        x = 960;
        y = HAND_Y - 170;
        rot = 0;
        scale = 1.2;
        z = 120;
      }
      if (this.choosing?.picked.has(uid)) y -= 60;
      el.style.zIndex = String(z);
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) rotate(${rot}deg) scale(${scale})`;
    });
  }

  private attachCardInput(el: HTMLElement, uid: string): void {
    el.addEventListener('pointerenter', () => {
      if (this.targeting) return;
      this.hoveredCard = uid;
      Audio.play('se_hover', { volume: 0.6 });
      this.layoutHand();
    });
    el.addEventListener('pointerleave', () => {
      if (this.hoveredCard === uid) this.hoveredCard = null;
      this.layoutHand();
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      this.startCardPointer(uid, el, e);
    });
  }

  /** カードの押下 → クリックかドラッグかを判定 */
  private startCardPointer(uid: string, el: HTMLElement, down: PointerEvent): void {
    if (this.choosing) {
      this.toggleChoice(uid);
      return;
    }
    if (this.busy || isModalOpen()) return;
    const startX = down.clientX;
    const startY = down.clientY;
    let dragging = false;
    const def = getCard(this.combat.hand.find((c) => c.uid === uid)?.cardId ?? '');
    const needsTarget = def.target === 'enemy' && this.combat.aliveEnemies.length > 1;

    const move = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (!dragging && dist > 12) {
        dragging = true;
        if (!this.checkPlayable(uid)) return finish();
        if (needsTarget) this.beginTargeting(uid);
        else el.classList.add('dragging');
      }
      if (dragging && !needsTarget) {
        const p = this.toStage(e.clientX, e.clientY);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%,-50%) scale(1.15)`;
        el.style.zIndex = '200';
        el.classList.toggle('will-play', p.y < 720);
      }
    };
    const up = (e: PointerEvent) => {
      finish();
      if (!dragging) {
        // クリック
        if (!this.checkPlayable(uid)) return;
        if (needsTarget) this.beginTargeting(uid);
        else this.requestPlay(uid, def.target === 'enemy' ? this.combat.aliveEnemies[0]?.index ?? null : null);
        return;
      }
      if (needsTarget) {
        // ドラッグで狙っていた場合：敵の上で離せば使用
        if (this.hoverEnemy !== null) this.clickEnemy(this.hoverEnemy);
        return;
      }
      el.classList.remove('dragging', 'will-play');
      const p = this.toStage(e.clientX, e.clientY);
      if (p.y < 720) this.requestPlay(uid, def.target === 'enemy' ? this.combat.aliveEnemies[0]?.index ?? null : null);
      else this.layoutHand();
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  private checkPlayable(uid: string): boolean {
    const r = this.combat.canPlay(uid);
    if (r.ok) return true;
    if (r.reason === 'ap') {
      Audio.play('se_error');
      this.flashHint(t('battle.notEnoughAp'));
      animate(this.apOrb, [{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], 200);
      const el = this.cardEls.get(uid);
      if (el) el.classList.add('shake-no'), setTimeout(() => el.classList.remove('shake-no'), 400);
    }
    return false;
  }

  private requestPlay(uid: string, target: number | null): void {
    this.cancelTargeting(false);
    this.hoveredCard = null;
    this.onPlayCard(uid, target);
  }

  // ---- 狙い（矢印） ----
  private beginTargeting(uid: string): void {
    this.targeting = { uid };
    this.hoveredCard = null;
    this.root.classList.add('is-targeting');
    this.hintEl.textContent = t('battle.selectTarget');
    this.hintEl.classList.add('visible');
    Audio.play('se_card_draw');
    this.layoutHand();
  }

  private cancelTargeting(withSound = true): void {
    if (!this.targeting) return;
    const r = this.targeting.resolve;
    this.targeting = null;
    this.root.classList.remove('is-targeting');
    this.arrow.classList.remove('visible');
    this.hintEl.classList.remove('visible');
    if (withSound) Audio.play('se_cancel');
    this.refreshHandState();
    this.layoutHand();
    r?.(null);
  }

  private clickEnemy(index: number): void {
    if (!this.targeting) return;
    const e = this.combat.enemies[index];
    if (!e || e.dead) return;
    const tg = this.targeting;
    if (tg.resolve) {
      this.targeting = null;
      this.root.classList.remove('is-targeting');
      this.arrow.classList.remove('visible');
      this.hintEl.classList.remove('visible');
      tg.resolve(index);
      return;
    }
    this.requestPlay(tg.uid, index);
  }

  private setHoverEnemy(index: number | null): void {
    this.hoverEnemy = index;
    this.enemyViews.forEach((v, i) => v.el.classList.toggle('targeted', !!this.targeting && i === index));
    // 狙っている敵に合わせてカードの数値を更新（脆弱などを反映）
    if (this.targeting && !this.targeting.resolve) {
      const el = this.cardEls.get(this.targeting.uid);
      const c = this.combat.hand.find((x) => x.uid === this.targeting!.uid);
      if (el && c) updateCardNumbers(el, getCard(c.cardId), this.combat.cardNumbers(getCard(c.cardId), index));
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.targeting) return;
    const p = this.toStage(e.clientX, e.clientY);
    const from = this.targeting.resolve ? { x: 960, y: 900 } : { x: 960, y: HAND_Y - 290 };
    const cx = from.x + (p.x - from.x) * 0.2;
    const cy = Math.min(from.y, p.y) - 220;
    this.arrowPath.setAttribute('d', `M${from.x},${from.y} Q${cx},${cy} ${p.x},${p.y}`);
    this.arrow.classList.add('visible');
    this.arrow.classList.toggle('locked', this.hoverEnemy !== null);
  }

  /** 画面座標 → ステージ座標 */
  private toStage(cx: number, cy: number): { x: number; y: number } {
    const r = ui.stage.el.getBoundingClientRect();
    return { x: (cx - r.left) / ui.stage.scale, y: (cy - r.top) / ui.stage.scale };
  }

  /** アイテム用：敵を1体選ばせる（1体しかいなければ自動） */
  selectTarget(): Promise<number | null> {
    const alive = this.combat.aliveEnemies;
    if (alive.length === 1) return Promise.resolve(alive[0].index);
    return new Promise((resolve) => {
      this.targeting = { uid: '', resolve };
      this.root.classList.add('is-targeting');
      this.hintEl.textContent = t('battle.selectTarget');
      this.hintEl.classList.add('visible');
    });
  }

  // ---- 手札から廃棄するカードを選ぶ ----
  chooseFromHand(p: PendingChoice): Promise<string[]> {
    return new Promise((resolve) => {
      this.choosing = { count: p.count, picked: new Set(), candidates: p.candidates, resolve };
      this.root.classList.add('is-choosing');
      this.hintEl.textContent = t('battle.selectExhaust', { n: p.count });
      this.hintEl.classList.add('visible');
      this.layoutHand();
    });
  }

  private toggleChoice(uid: string): void {
    const ch = this.choosing;
    if (!ch || !ch.candidates.includes(uid)) return;
    if (ch.picked.has(uid)) ch.picked.delete(uid);
    else ch.picked.add(uid);
    Audio.play('se_click');
    this.layoutHand();
    if (ch.picked.size >= ch.count) {
      this.choosing = null;
      this.root.classList.remove('is-choosing');
      this.hintEl.classList.remove('visible');
      ch.resolve([...ch.picked]);
    }
  }

  private flashHint(text: string): void {
    const el = h('div.battle-warn', {}, text);
    this.root.append(el);
    animate(el, [{ opacity: 0, transform: 'translate(-50%,10px)' }, { opacity: 1, transform: 'translate(-50%,0)', offset: 0.15 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], 1100).then(() => el.remove());
  }

  private onKey(e: KeyboardEvent): void {
    if (isModalOpen()) return;
    if (e.key === 'Escape') {
      this.cancelTargeting();
      return;
    }
    if (this.busy) return;
    if (e.key === 'e' || e.key === 'E') {
      if (!this.choosing && !this.targeting) {
        Audio.play('se_click');
        this.onEndTurn();
      }
      return;
    }
    const num = e.key === '0' ? 10 : Number(e.key);
    if (num >= 1 && num <= 10) {
      const c = this.combat.hand[num - 1];
      if (!c) return;
      if (this.choosing) return this.toggleChoice(c.uid);
      if (!this.checkPlayable(c.uid)) return;
      const def = getCard(c.cardId);
      if (def.target === 'enemy' && this.combat.aliveEnemies.length > 1) this.beginTargeting(c.uid);
      else this.requestPlay(c.uid, def.target === 'enemy' ? this.combat.aliveEnemies[0].index : null);
    }
  }

  // =========================================================
  // 演出の再生
  // =========================================================
  /** CombatEvent を順番に演出する */
  async play(events: CombatEvent[]): Promise<void> {
    this.busy = true;
    this.endTurnBtn.disabled = true;
    for (const ev of events) await this.playOne(ev);
    this.syncAll();
    this.layoutHand();
    this.busy = false;
  }

  private posOf(r: Ref): { x: number; y: number } {
    if (r.side === 'player') return { ...PLAYER_POS };
    const v = this.enemyViews.get(r.index);
    const e = this.combat.enemies[r.index];
    const hgt = ENEMY_BASE_HEIGHT * (e?.def.scale ?? 1);
    return { x: v ? parseFloat(v.el.style.left) : 960, y: ENEMY_FOOT_Y - hgt * 0.5 };
  }

  private key(r: Ref): string {
    return r.side === 'player' ? 'p' : `e${r.index}`;
  }

  private renderRef(r: Ref): void {
    if (r.side === 'player') this.renderPlayer();
    else this.renderEnemy(r.index);
  }

  private cardIdOf(uid: string): string {
    return this.combat.gs.data.deck.find((c) => c.uid === uid)?.cardId ?? 'strike';
  }

  private async playOne(ev: CombatEvent): Promise<void> {
    const fx = ui.fx;
    switch (ev.t) {
      case 'turnStart':
        Audio.play('se_turn');
        await fx.banner(t('battle.yourTurn'), { sub: t('battle.turn', { n: ev.turn }), cls: 'banner-turn', hold: 350 });
        break;

      case 'enemyTurnStart':
        this.enemyViews.forEach((v) => v.intent.classList.add('acting'));
        await fx.banner(t('battle.enemyTurn'), { cls: 'banner-enemy', hold: 250 });
        break;

      case 'draw': {
        for (const uid of ev.uids) {
          const def = getCard(this.cardIdOf(uid));
          const el = createCardEl(def, { uid, numbers: this.combat.cardNumbers(def, null) });
          el.classList.add('in-hand');
          el.style.transform = `translate(${DRAW_POS.x}px, ${DRAW_POS.y}px) translate(-50%,-50%) rotate(-30deg) scale(0.25)`;
          this.attachCardInput(el, uid);
          this.handEl.append(el);
          this.cardEls.set(uid, el);
          this.vDraw--;
          this.renderCounts();
          Audio.play('se_card_draw');
          void el.offsetWidth;
          this.layoutHand();
          await wait(85);
        }
        await wait(160);
        break;
      }

      case 'reshuffle': {
        Audio.play('se_shuffle');
        fx.floatText(DISCARD_POS.x, DISCARD_POS.y - 80, t('battle.reshuffle'));
        for (let i = 0; i < Math.min(8, ev.count); i++) {
          const back = h('div.card-back-fly', { style: { left: `${DISCARD_POS.x}px`, top: `${DISCARD_POS.y}px` } }, img(IMAGES.cardBack));
          ui.stage.fxLayer.append(back);
          animate(back, [{ transform: 'translate(-50%,-50%) scale(0.4)' }, { transform: `translate(calc(-50% + ${DRAW_POS.x - DISCARD_POS.x}px), calc(-50% - 120px)) rotate(-200deg) scale(0.5)`, offset: 0.5 }, { transform: `translate(calc(-50% + ${DRAW_POS.x - DISCARD_POS.x}px), -50%) rotate(-360deg) scale(0.3)` }], { duration: 520, delay: i * 40, easing: 'ease-in-out' }).then(() => back.remove());
        }
        this.vDraw = ev.count;
        this.vDiscard = 0;
        this.renderCounts();
        await wait(500);
        break;
      }

      case 'discardHand': {
        ev.uids.forEach((uid, i) => {
          const el = this.cardEls.get(uid);
          if (!el) return;
          this.cardEls.delete(uid);
          animate(el, [{ transform: el.style.transform, opacity: 1 }, { transform: `translate(${DISCARD_POS.x}px, ${DISCARD_POS.y}px) translate(-50%,-50%) rotate(40deg) scale(0.2)`, opacity: 0.3 }], { duration: 380, delay: i * 50, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).then(() => el.remove());
        });
        this.vDiscard += ev.uids.length;
        this.renderCounts();
        Audio.play('se_card_draw');
        await wait(300 + ev.uids.length * 50);
        break;
      }

      case 'cardPlayed': {
        const el = this.cardEls.get(ev.uid);
        this.cardEls.delete(ev.uid);
        this.layoutHand();
        Audio.play('se_card_play');
        if (el) {
          this.playing.set(ev.uid, el);
          el.classList.remove('playable', 'unplayable', 'dragging', 'will-play');
          el.classList.add('played');
          el.style.zIndex = '300';
          await animate(el, [{ transform: el.style.transform }, { transform: `translate(${PLAY_ZONE.x}px, ${PLAY_ZONE.y}px) translate(-50%,-50%) scale(1.15)` }], { duration: 200, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' });
          el.style.transform = `translate(${PLAY_ZONE.x}px, ${PLAY_ZONE.y}px) translate(-50%,-50%) scale(1.15)`;
          await wait(110);
        }
        break;
      }

      case 'cardToPile': {
        const el = this.playing.get(ev.uid) ?? this.cardEls.get(ev.uid);
        this.playing.delete(ev.uid);
        this.cardEls.delete(ev.uid);
        if (!el) break;
        if (ev.pile === 'exhaust') {
          Audio.play('se_card_exhaust');
          el.classList.add('burning');
          animate(el, [{ transform: el.style.transform, filter: 'brightness(1)', opacity: 1 }, { transform: `${el.style.transform} translateY(-60px) scale(0.9)`, filter: 'brightness(3) sepia(1) hue-rotate(-30deg)', opacity: 0 }], { duration: 650, easing: 'ease-in', fill: 'forwards' }).then(() => el.remove());
          const c = this.cardCenter(el);
          ui.particles.burst(c.x, c.y, 'buff', 1.2);
          this.vExhaust++;
          await wait(260);
        } else {
          animate(el, [{ transform: el.style.transform, opacity: 1 }, { transform: `translate(${DISCARD_POS.x}px, ${DISCARD_POS.y}px) translate(-50%,-50%) rotate(30deg) scale(0.2)`, opacity: 0.2 }], { duration: 360, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).then(() => el.remove());
          this.vDiscard++;
        }
        this.renderCounts();
        this.layoutHand();
        break;
      }

      case 'itemUsed': {
        const def = getItem(ev.itemId);
        Audio.play('se_item');
        const icon = h('div.item-use-fly', { style: { left: `${PLAY_ZONE.x}px`, top: `${PLAY_ZONE.y}px` } }, [img(def.image), h('div', {}, itemName(def))]);
        ui.stage.fxLayer.append(icon);
        await animate(icon, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(0.4)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.2)', offset: 0.4 }, { opacity: 0, transform: 'translate(-50%,-80%) scale(1)' }], { duration: 650 });
        icon.remove();
        break;
      }

      case 'ap':
        this.renderAp(true);
        this.refreshHandState();
        break;

      case 'attack': {
        if (ev.source.side === 'player') {
          const p = this.posOf(ev.target);
          Audio.play('se_slash');
          fx.slash(p.x, p.y);
          await wait(70);
        } else {
          const v = this.enemyViews.get(ev.source.index);
          if (v) {
            Audio.play('se_enemy_attack');
            await animate(v.sprite, [{ transform: 'none' }, { transform: 'translateY(-14px) scale(0.97)', offset: 0.35 }, { transform: 'translateY(50px) scale(1.18)', offset: 0.7 }, { transform: 'none' }], { duration: 330, easing: 'ease-in-out' });
          }
        }
        break;
      }

      case 'damage': {
        const s = this.vState.get(this.key(ev.target));
        const p = this.posOf(ev.target);
        if (ev.evaded) {
          Audio.play('se_evade');
          fx.popNumber(p.x, p.y - 40, t('battle.evade'), 'miss');
          if (ev.target.side === 'player') animate(this.player.hpFill.parentElement!.parentElement!, [{ transform: 'translateX(0)' }, { transform: 'translateX(-40px)' }, { transform: 'translateX(0)' }], 300);
          await wait(250);
          break;
        }
        if (s) {
          s.hp = ev.hpAfter;
          s.block = ev.blockAfter;
        }
        if (ev.kind === 'poison') {
          Audio.play('se_debuff');
          ui.particles.burst(p.x, p.y, 'debuff', 0.8);
          fx.popNumber(p.x, p.y, String(ev.amount), 'poison');
        } else if (ev.amount === 0 && ev.blocked > 0) {
          Audio.play('se_block');
          fx.ring(p.x, p.y, 'rgba(120,190,255,0.9)', 200);
          fx.floatText(p.x, p.y - 30, t('battle.block'), 'float-block');
        } else {
          if (ev.blocked > 0) {
            Audio.play('se_block', { volume: 0.6 });
            fx.ring(p.x, p.y, 'rgba(120,190,255,0.7)', 160);
          }
          if (ev.target.side === 'enemy') {
            const v = this.enemyViews.get(ev.target.index);
            if (v) {
              animate(v.sprite, [{ filter: 'brightness(4) saturate(0)', transform: 'translateX(18px)' }, { filter: 'brightness(1.6) sepia(1) hue-rotate(-40deg) saturate(4)', transform: 'translateX(-12px)', offset: 0.3 }, { filter: 'none', transform: 'none' }], { duration: ev.crit ? 420 : 260 });
            }
            Audio.play(ev.crit ? 'se_crit' : 'se_hit');
            ui.particles.burst(p.x, p.y, 'hit', ev.crit ? 1.8 : 1);
            ui.particles.burst(p.x, p.y, 'blood', ev.crit ? 1.3 : 0.6);
            fx.popNumber(p.x + (Math.random() - 0.5) * 60, p.y - 30, String(ev.amount), ev.crit ? 'crit' : 'damage');
            if (ev.crit) {
              fx.floatText(p.x, p.y - 140, t('battle.critical'), 'float-crit');
              fx.ring(p.x, p.y, 'rgba(255,200,80,1)', 380);
              fx.shake(1.3);
              await fx.hitStop(130);
            } else {
              fx.shake(ev.amount >= 20 ? 0.8 : 0.35, 220);
              await fx.hitStop(40);
            }
          } else {
            // プレイヤー被弾
            Audio.play('se_player_hurt');
            ui.stage.hurtFlash(Math.min(1, 0.4 + ev.amount / 25));
            fx.shake(ev.amount >= 12 ? 1.3 : 0.75);
            ui.particles.burst(p.x, p.y, 'blood', 1.2);
            fx.popNumber(p.x, p.y - 40, String(ev.amount), 'damage');
            await fx.hitStop(80);
          }
        }
        this.renderRef(ev.target);
        await wait(150);
        break;
      }

      case 'block': {
        const s = this.vState.get(this.key(ev.target));
        if (s) s.block = ev.blockAfter;
        if (ev.amount > 0) {
          const p = this.posOf(ev.target);
          Audio.play('se_block');
          ui.particles.burst(p.x, p.y, 'block', 0.7);
          fx.ring(p.x, p.y, 'rgba(120,190,255,0.9)', 240);
          fx.popNumber(p.x, p.y - 30, `+${ev.amount}`, 'block');
          const badge = ev.target.side === 'player' ? this.player.block : this.enemyViews.get(ev.target.index)?.block;
          this.renderRef(ev.target);
          if (badge) animate(badge, [{ transform: 'scale(1.7)' }, { transform: 'scale(1)' }], 300);
          await wait(200);
        } else this.renderRef(ev.target);
        break;
      }

      case 'heal': {
        const s = this.vState.get(this.key(ev.target));
        if (s) s.hp = ev.hpAfter;
        const p = this.posOf(ev.target);
        Audio.play('se_heal');
        ui.particles.burst(p.x, p.y, 'heal', 1);
        fx.popNumber(p.x, p.y - 30, `+${ev.amount}`, 'heal');
        this.renderRef(ev.target);
        await wait(220);
        break;
      }

      case 'status': {
        const s = this.vState.get(this.key(ev.target));
        if (s) {
          if (ev.total > 0) s.statuses[ev.status] = ev.total;
          else delete s.statuses[ev.status];
        }
        this.renderRef(ev.target);
        // 減少（自然消滅）は静かに更新、付与は演出する
        if (ev.delta > 0) {
          const p = this.posOf(ev.target);
          const pol = STATUS_EFFECTS[ev.status].polarity;
          Audio.play(pol === 'buff' ? 'se_buff' : ev.status === 'stun' ? 'se_stun' : 'se_debuff');
          ui.particles.burst(p.x, p.y, pol === 'buff' ? 'buff' : 'debuff', 0.8);
          fx.floatText(p.x, p.y - 60, `${statusName(ev.status)}${ev.status === 'stun' ? '' : ` +${ev.delta}`}`, pol === 'buff' ? 'float-buff' : 'float-debuff');
          if (ev.target.side === 'player' && (ev.status === 'turnStrength' || ev.status === 'strength')) this.refreshHandState();
          await wait(260);
        }
        break;
      }

      case 'resist': {
        const p = this.posOf(ev.target);
        Audio.play('se_error');
        fx.floatText(p.x, p.y - 60, t('battle.resist'), 'float-resist');
        await wait(300);
        break;
      }

      case 'enemyAction': {
        const v = this.enemyViews.get(ev.index);
        const e = this.combat.enemies[ev.index];
        if (v && e) {
          const tag = h(`div.action-name.intent-${ev.intent}`, {}, ev.name);
          v.el.append(tag);
          animate(tag, [{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%,0)', offset: 0.15 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], 1300).then(() => tag.remove());
          v.intent.classList.remove('acting');
          v.intent.classList.add('used');
          if (ev.intent !== 'attack') await animate(v.sprite, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.8) drop-shadow(0 0 30px rgba(255,80,80,.9))' }, { filter: 'brightness(1)' }], 380);
          await wait(160);
        }
        break;
      }

      case 'stunned': {
        const p = this.posOf({ side: 'enemy', index: ev.index });
        Audio.play('se_stun');
        fx.floatText(p.x, p.y - 80, t('battle.stunned'), 'float-debuff');
        const v = this.enemyViews.get(ev.index);
        if (v) await animate(v.sprite, [{ transform: 'rotate(0)' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(0)' }], 500);
        break;
      }

      case 'death': {
        if (ev.target.side !== 'enemy') break;
        const v = this.enemyViews.get(ev.target.index);
        const p = this.posOf(ev.target);
        Audio.play('se_enemy_die');
        ui.particles.burst(p.x, p.y, 'death', 1.2);
        ui.particles.burst(p.x, p.y, 'blood', 1.5);
        if (v) {
          v.el.classList.add('dead');
          v.intent.classList.remove('visible');
          await animate(v.sprite, [{ filter: 'brightness(1)', opacity: 1, transform: 'none' }, { filter: 'brightness(3) saturate(0)', opacity: 1, offset: 0.1 }, { filter: 'brightness(0) blur(6px)', opacity: 0, transform: 'translateY(40px) scaleY(0.6)' }], { duration: 750, easing: 'ease-in', fill: 'forwards' });
          animate(v.el.querySelector('.enemy-info')!, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
        }
        break;
      }

      case 'summon': {
        const e = this.combat.enemies[ev.index];
        if (e) {
          Audio.play('se_debuff');
          this.createEnemyView(e, true);
          await wait(600);
        }
        break;
      }

      case 'intents':
        this.enemyViews.forEach((v, i) => {
          v.intent.classList.remove('used', 'acting');
          this.renderIntent(i);
          if (v.intent.classList.contains('visible')) animate(v.intent, [{ opacity: 0, transform: 'translate(-50%, 10px) scale(0.6)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1)' }], { duration: 300, delay: i * 60, fill: 'backwards' });
        });
        break;

      case 'victory':
      case 'defeat':
        break;
    }
  }

  private cardCenter(el: HTMLElement): { x: number; y: number } {
    const m = el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 960, y: 900 };
  }

  /** 勝利時：手札を片付ける */
  async clearHand(): Promise<void> {
    this.cardEls.forEach((el) => animate(el, [{ opacity: 1 }, { opacity: 0, transform: `${el.style.transform} translateY(200px)` }], { duration: 300, fill: 'forwards' }));
    await wait(300);
  }
}
