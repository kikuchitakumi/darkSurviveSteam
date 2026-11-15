// =============================================================
// Combat.ts  【Model：戦闘エンジン】
// -------------------------------------------------------------
// 戦闘のルールを「全て」このファイルで処理する。画面のことは一切知らない。
//
// ■ 仕組み
//   プレイヤーの操作（カード使用・アイテム使用・ターン終了）を受け取ると、
//   ルールに従って状態を更新し、起きた出来事を CombatEvent として記録する。
//   Controller は takeEvents() で出来事の一覧を受け取り、
//   View に「順番にアニメーション再生」させる。
//   → ロジックと演出が分離されるので、テストしやすく、演出も作り込みやすい。
//
// ■ ターンの流れ
//   [プレイヤーのターン開始] ブロック0 → 毒 → AP回復 → 5枚ドロー
//   [プレイヤー行動] カード/アイテムを使う
//   [ターン終了] 手札を全て捨て札へ → プレイヤーの状態異常が減る
//   [敵のターン] 右の敵から順に：ブロック0 → 毒 → 行動（封印中なら何もしない）
//   [敵のターン終了] 敵の状態異常が減る → 次の行動（意図）を決める
// =============================================================
import { BALANCE, enemyDmgScale, enemyHpScale } from '@/config/balance';
import { getCard } from '@/data/cards';
import { getEnemy } from '@/data/enemies';
import { getItem } from '@/data/items';
import { Random } from '@/core/Random';
import type { DeckCard, GameState } from './GameState';
import type { CardDef, Effect, EnemyActionDef, EnemyDef, IntentType, StatusId } from './types';

// -------------------------------------------------------------
// 型定義
// -------------------------------------------------------------
export type StatusMap = Partial<Record<StatusId, number>>;

/** 戦闘の参加者を指す参照（player か、何番目の敵か） */
export type Ref = { side: 'player' } | { side: 'enemy'; index: number };

/** 敵1体の戦闘中の状態 */
export interface EnemyInstance {
  index: number;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  block: number;
  statuses: StatusMap;
  dead: boolean;
  /** 攻撃・ブロック量に掛かる倍率（階数・強敵補正） */
  dmgMult: number;
  /** 次に行う行動（意図） */
  nextAction: EnemyActionDef | null;
  cycleIndex: number;
  lastActionId: string | null;
}

/** 戦闘で起きた出来事（View がこれを順番に演出する） */
export type CombatEvent =
  | { t: 'turnStart'; turn: number }
  | { t: 'enemyTurnStart' }
  | { t: 'draw'; uids: string[] }
  | { t: 'reshuffle'; count: number }
  | { t: 'discardHand'; uids: string[] }
  | { t: 'cardPlayed'; uid: string; cardId: string; target: number | null }
  | { t: 'cardToPile'; uid: string; pile: 'discard' | 'exhaust' }
  | { t: 'itemUsed'; itemId: string; target: number | null }
  | { t: 'ap'; value: number; max: number }
  | { t: 'attack'; source: Ref; target: Ref }
  | { t: 'damage'; target: Ref; amount: number; blocked: number; hpAfter: number; blockAfter: number; crit: boolean; evaded: boolean; kind: 'attack' | 'poison' | 'thorns' | 'item' }
  | { t: 'block'; target: Ref; amount: number; blockAfter: number }
  | { t: 'heal'; target: Ref; amount: number; hpAfter: number }
  | { t: 'status'; target: Ref; status: StatusId; delta: number; total: number }
  | { t: 'resist'; target: Ref }
  | { t: 'enemyAction'; index: number; name: string; intent: IntentType }
  | { t: 'stunned'; index: number }
  | { t: 'death'; target: Ref }
  | { t: 'summon'; index: number }
  | { t: 'intents' }
  | { t: 'victory' }
  | { t: 'defeat' };

/** プレイヤーに選択を求めている状態（手札から廃棄するカードを選ぶ等） */
export interface PendingChoice {
  kind: 'exhaustFromHand';
  count: number;
  candidates: string[];
}

/** 敵の意図の表示用情報 */
export interface IntentPreview {
  type: IntentType | 'stun';
  name: string;
  damage?: number;
  hits?: number;
}

export type BattleKind = 'normal' | 'elite' | 'boss';

// -------------------------------------------------------------
// 戦闘クラス
// -------------------------------------------------------------
export class Combat {
  enemies: EnemyInstance[] = [];
  drawPile: DeckCard[] = [];
  hand: DeckCard[] = [];
  discardPile: DeckCard[] = [];
  exhaustPile: DeckCard[] = [];

  /** プレイヤーの戦闘中の状態（HP は GameState と共有） */
  player = { block: 0, statuses: {} as StatusMap, ap: 0, maxAp: 0 };

  turn = 0;
  phase: 'player' | 'enemy' | 'won' | 'lost' = 'player';
  pending: PendingChoice | null = null;

  private events: CombatEvent[] = [];
  /** 選択待ちで中断した効果の続き */
  private resume: { card: DeckCard; def: CardDef; rest: Effect[]; target: number | null } | null = null;

  constructor(
    public readonly gs: GameState,
    enemyIds: string[],
    public readonly kind: BattleKind,
    public readonly floor: number,
    private readonly rng: Random,
  ) {
    enemyIds.slice(0, BALANCE.MAX_ENEMIES).forEach((id, i) => this.enemies.push(this.createEnemy(id, i)));
  }

  /**
   * 戦闘外（報酬画面・ショップ）でカードの数値を表示するためのプレビュー。
   * 現在のステータスだけを反映した数値を返す。
   */
  static previewNumbers(gs: GameState, def: CardDef): Record<string, number> {
    return new Combat(gs, [], 'normal', 1, new Random(1)).cardNumbers(def);
  }

  /** 敵インスタンスを作る（階数・強敵補正を掛ける） */
  private createEnemy(id: string, index: number): EnemyInstance {
    const def = getEnemy(id);
    const hpMult = enemyHpScale(this.floor) * (this.kind === 'elite' ? BALANCE.ELITE_HP_MULTIPLIER : 1);
    const dmgMult = enemyDmgScale(this.floor) * (this.kind === 'elite' ? BALANCE.ELITE_DMG_MULTIPLIER : 1);
    // 同じ敵が並んだ時に見分けやすいよう、HP を少しだけばらつかせる
    const hp = Math.max(1, Math.round(def.hp * hpMult * (0.92 + this.rng.next() * 0.16)));
    return {
      index, def, hp, maxHp: hp, block: 0, statuses: {}, dead: false, dmgMult,
      nextAction: null, cycleIndex: 0, lastActionId: null,
    };
  }

  // =========================================================
  // 公開API（Controller から呼ばれる）
  // =========================================================

  /** 戦闘開始 */
  start(): void {
    const deck = this.gs.data.deck.map((c) => ({ ...c }));
    this.drawPile = this.rng.shuffle(deck);
    this.player.maxAp = this.gs.maxAp;
    // 装備品による戦闘開始時の状態
    for (const s of this.gs.battleStartStatuses) this.addStatus({ side: 'player' }, s.status, s.amount);
    for (const e of this.enemies) for (const s of e.def.startStatus ?? []) this.addStatus({ side: 'enemy', index: e.index }, s.status, s.amount);
    this.decideIntents();
    this.startPlayerTurn();
  }

  /** 溜まった出来事を取り出す */
  takeEvents(): CombatEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  get playerHp(): number {
    return this.gs.data.hp;
  }

  get aliveEnemies(): EnemyInstance[] {
    return this.enemies.filter((e) => !e.dead);
  }

  /** カードが使えるかどうか */
  canPlay(uid: string): { ok: boolean; reason?: 'ap' | 'phase' | 'pending' } {
    if (this.phase !== 'player') return { ok: false, reason: 'phase' };
    if (this.pending) return { ok: false, reason: 'pending' };
    const c = this.hand.find((h) => h.uid === uid);
    if (!c) return { ok: false, reason: 'phase' };
    if (getCard(c.cardId).cost > this.player.ap) return { ok: false, reason: 'ap' };
    return { ok: true };
  }

  /**
   * カードを使う。
   * @param target 敵を選ぶカードの場合、敵の index
   * @returns 'needChoice' の場合は pending を見てプレイヤーに選ばせ、resolveChoice を呼ぶ
   */
  playCard(uid: string, target: number | null): 'done' | 'needChoice' | 'invalid' {
    if (!this.canPlay(uid).ok) return 'invalid';
    const card = this.hand.find((h) => h.uid === uid)!;
    const def = getCard(card.cardId);
    if (def.target === 'enemy') {
      if (target === null || !this.enemies[target] || this.enemies[target].dead) return 'invalid';
    }
    this.player.ap -= def.cost;
    this.emit({ t: 'ap', value: this.player.ap, max: this.player.maxAp });
    this.hand = this.hand.filter((h) => h.uid !== uid);
    this.emit({ t: 'cardPlayed', uid, cardId: def.id, target });
    this.gs.data.stats.cardsPlayed++;
    return this.runCardEffects(card, def, def.effects, target);
  }

  /** 選択待ち（手札から廃棄）の決定 */
  resolveChoice(uids: string[]): void {
    if (!this.pending || !this.resume) return;
    const picked = uids.filter((u) => this.pending!.candidates.includes(u)).slice(0, this.pending.count);
    for (const u of picked) this.exhaustFromHand(u);
    this.pending = null;
    const r = this.resume;
    this.resume = null;
    this.runCardEffects(r.card, r.def, r.rest, r.target);
  }

  /** アイテムを使う（APは消費しない・何回でも使える） */
  useItem(itemIndex: number, target: number | null): boolean {
    if (this.phase !== 'player' || this.pending) return false;
    const id = this.gs.data.items[itemIndex];
    if (!id) return false;
    const def = getItem(id);
    if (def.target === 'enemy' && (target === null || !this.enemies[target] || this.enemies[target].dead)) return false;
    this.gs.data.items.splice(itemIndex, 1);
    this.emit({ t: 'itemUsed', itemId: id, target });
    for (const eff of def.effects) {
      this.applyEffect(eff, target, true);
      if (this.checkEnd()) break;
    }
    this.gs.changed();
    return true;
  }

  /** ターン終了 → 敵のターン → 次のプレイヤーターン */
  endTurn(): void {
    if (this.phase !== 'player' || this.pending) return;
    // --- プレイヤーのターン終了処理 ---
    const uids = this.hand.map((h) => h.uid);
    this.discardPile.push(...this.hand);
    this.hand = [];
    if (uids.length) this.emit({ t: 'discardHand', uids });
    this.endOfTurnStatuses({ side: 'player' });
    if (this.checkEnd()) return;

    // --- 敵のターン ---
    this.phase = 'enemy';
    this.emit({ t: 'enemyTurnStart' });
    // 仕様：基本的には右の敵から行動する（index が大きいほど右）
    const actors = this.enemies.filter((e) => !e.dead).sort((a, b) => b.index - a.index);
    for (const e of actors) {
      if (e.dead) continue;
      this.enemyAct(e);
      if (this.checkEnd()) return;
    }
    for (const e of this.enemies) if (!e.dead) this.endOfTurnStatuses({ side: 'enemy', index: e.index });
    if (this.checkEnd()) return;

    this.decideIntents();
    this.startPlayerTurn();
  }

  // =========================================================
  // 数値計算（View のプレビュー表示にも使う）
  // =========================================================

  /** プレイヤーの攻撃1回あたりのダメージ（クリティカル前） */
  calcPlayerDamage(amount: number, scale: 'atk' | 'mag' | 'none' | undefined, targetIndex: number | null): number {
    const st = this.gs.stats;
    const s = this.player.statuses;
    let dmg = amount;
    if (scale === 'atk' || scale === undefined) dmg += st.atk + (s.strength ?? 0) + (s.turnStrength ?? 0);
    else if (scale === 'mag') dmg += st.mag;
    if ((s.weak ?? 0) > 0) dmg *= BALANCE.WEAK_MULTIPLIER;
    const t = targetIndex !== null ? this.enemies[targetIndex] : null;
    if (t && (t.statuses.vulnerable ?? 0) > 0) dmg *= BALANCE.VULNERABLE_MULTIPLIER;
    return Math.max(0, Math.floor(dmg));
  }

  /** プレイヤーが得るブロック量 */
  calcPlayerBlock(amount: number, scale: 'def' | 'mag' | 'none' | undefined): number {
    const st = this.gs.stats;
    const s = this.player.statuses;
    let b = amount;
    if (scale === 'def' || scale === undefined) b += st.def + (s.dexterity ?? 0);
    else if (scale === 'mag') b += st.mag;
    if ((s.frail ?? 0) > 0) b *= BALANCE.FRAIL_MULTIPLIER;
    return Math.max(0, Math.floor(b));
  }

  /** 回復量 */
  calcHeal(amount: number, scale: 'mag' | 'none' | undefined): number {
    return Math.floor(amount + (scale === 'mag' ? this.gs.stats.mag : 0));
  }

  /** 敵の攻撃1回あたりのダメージ（プレイヤーの脆弱も考慮） */
  calcEnemyDamage(e: EnemyInstance, amount: number): number {
    let dmg = Math.round(amount * e.dmgMult) + (e.statuses.strength ?? 0);
    if ((e.statuses.weak ?? 0) > 0) dmg *= BALANCE.WEAK_MULTIPLIER;
    if ((this.player.statuses.vulnerable ?? 0) > 0) dmg *= BALANCE.VULNERABLE_MULTIPLIER;
    return Math.max(0, Math.floor(dmg));
  }

  /** 敵の意図（頭上に表示する情報） */
  intentOf(e: EnemyInstance): IntentPreview | null {
    if (e.dead || !e.nextAction) return null;
    if ((e.statuses.stun ?? 0) > 0) return { type: 'stun', name: '封印' };
    const a = e.nextAction;
    const atk = a.effects.find((x) => x.kind === 'attack') as { amount: number; hits?: number } | undefined;
    return {
      type: a.intent,
      name: a.name,
      damage: atk ? this.calcEnemyDamage(e, atk.amount) : undefined,
      hits: atk ? atk.hits ?? 1 : undefined,
    };
  }

  /** カード説明文の {damage} 等に入れる数値 */
  cardNumbers(def: CardDef, targetIndex: number | null = null): Record<string, number> {
    const out: Record<string, number> = {};
    for (const eff of def.effects) {
      if (eff.kind === 'damage' && out.damage === undefined) {
        out.damage = this.calcPlayerDamage(eff.amount, eff.scale, eff.target === 'all' ? null : targetIndex);
        out.hits = eff.hits ?? 1;
      } else if (eff.kind === 'block' && out.block === undefined) out.block = this.calcPlayerBlock(eff.amount, eff.scale);
      else if (eff.kind === 'heal' && out.heal === undefined) out.heal = this.calcHeal(eff.amount, eff.scale);
    }
    return out;
  }

  // =========================================================
  // 内部処理
  // =========================================================

  private emit(e: CombatEvent): void {
    this.events.push(e);
  }

  /** カードの効果を順番に実行（選択が必要な効果で一時停止する） */
  private runCardEffects(card: DeckCard, def: CardDef, effects: Effect[], target: number | null): 'done' | 'needChoice' {
    for (let i = 0; i < effects.length; i++) {
      const eff = effects[i];
      if (eff.kind === 'exhaustChoice') {
        const candidates = this.hand.map((h) => h.uid);
        if (candidates.length === 0) continue;
        if (candidates.length <= eff.amount) {
          // 選ぶ余地がない場合は自動で廃棄
          candidates.forEach((u) => this.exhaustFromHand(u));
          continue;
        }
        this.pending = { kind: 'exhaustFromHand', count: eff.amount, candidates };
        this.resume = { card, def, rest: effects.slice(i + 1), target };
        return 'needChoice';
      }
      this.applyEffect(eff, target, false);
      if (this.checkEnd()) break;
    }
    // 使い終わったカードの行き先
    if (def.exhaust) {
      this.exhaustPile.push(card);
      this.emit({ t: 'cardToPile', uid: card.uid, pile: 'exhaust' });
    } else {
      this.discardPile.push(card);
      this.emit({ t: 'cardToPile', uid: card.uid, pile: 'discard' });
    }
    this.gs.changed();
    return 'done';
  }

  private exhaustFromHand(uid: string): void {
    const c = this.hand.find((h) => h.uid === uid);
    if (!c) return;
    this.hand = this.hand.filter((h) => h.uid !== uid);
    this.exhaustPile.push(c);
    this.emit({ t: 'cardToPile', uid, pile: 'exhaust' });
  }

  /** 効果1つを実行（カード・アイテム共通） */
  private applyEffect(eff: Effect, target: number | null, fromItem: boolean): void {
    switch (eff.kind) {
      case 'damage': {
        const targets = this.resolveTargets(eff.target ?? 'target', target);
        const hits = eff.hits ?? 1;
        for (let h = 0; h < hits; h++) {
          for (const ti of targets) {
            const en = this.enemies[ti];
            if (!en || en.dead) continue;
            let dmg = this.calcPlayerDamage(eff.amount, fromItem ? 'none' : eff.scale, ti);
            let crit = false;
            // クリティカル判定（カードのみ。運/99×50%、威力3倍）
            if (!fromItem && this.rng.chance(this.gs.critRate)) {
              crit = true;
              dmg *= BALANCE.CRIT_MULTIPLIER;
              this.gs.data.stats.crits++;
            }
            this.emit({ t: 'attack', source: { side: 'player' }, target: { side: 'enemy', index: ti } });
            this.dealDamage({ side: 'enemy', index: ti }, dmg, crit, fromItem ? 'item' : 'attack', { side: 'player' });
          }
          if (this.aliveEnemies.length === 0) break;
        }
        break;
      }
      case 'block': {
        const b = fromItem ? eff.amount : this.calcPlayerBlock(eff.amount, eff.scale);
        this.gainBlock({ side: 'player' }, b);
        break;
      }
      case 'status': {
        const t = eff.target ?? 'target';
        if (t === 'self') this.addStatus({ side: 'player' }, eff.status, eff.amount);
        else for (const ti of this.resolveTargets(t === 'all' ? 'all' : 'target', target)) this.addStatus({ side: 'enemy', index: ti }, eff.status, eff.amount);
        break;
      }
      case 'stun': {
        for (const ti of this.resolveTargets(eff.target ?? 'target', target)) this.addStatus({ side: 'enemy', index: ti }, 'stun', 1);
        break;
      }
      case 'draw':
        this.drawCards(eff.amount);
        break;
      case 'gainAp':
        this.player.ap += eff.amount;
        this.emit({ t: 'ap', value: this.player.ap, max: this.player.maxAp });
        break;
      case 'heal':
        this.healTarget({ side: 'player' }, this.calcHeal(eff.amount, eff.scale));
        break;
      case 'healPercent':
        this.healTarget({ side: 'player' }, Math.ceil((this.gs.maxHp * eff.percent) / 100));
        break;
      case 'exhaustChoice':
        break; // runCardEffects で処理
    }
  }

  private resolveTargets(mode: 'target' | 'all' | 'random', target: number | null): number[] {
    const alive = this.aliveEnemies.map((e) => e.index);
    if (mode === 'all') return alive;
    if (mode === 'random') return alive.length ? [this.rng.pick(alive)] : [];
    return target !== null && alive.includes(target) ? [target] : [];
  }

  // ---------------------------------------------------------
  // ダメージ・ブロック・回復・状態異常
  // ---------------------------------------------------------
  private getBlock(r: Ref): number {
    return r.side === 'player' ? this.player.block : this.enemies[r.index].block;
  }
  private setBlock(r: Ref, v: number): void {
    if (r.side === 'player') this.player.block = v;
    else this.enemies[r.index].block = v;
  }
  private getHp(r: Ref): number {
    return r.side === 'player' ? this.gs.data.hp : this.enemies[r.index].hp;
  }
  private setHp(r: Ref, v: number): void {
    if (r.side === 'player') this.gs.data.hp = Math.max(0, v);
    else this.enemies[r.index].hp = Math.max(0, v);
  }
  statusesOf(r: Ref): StatusMap {
    return r.side === 'player' ? this.player.statuses : this.enemies[r.index].statuses;
  }

  /**
   * ダメージを与える。ブロックで先に受け止め、残りが HP から引かれる。
   * kind = 'poison' の場合はブロックを無視する。
   */
  private dealDamage(target: Ref, amount: number, crit: boolean, kind: 'attack' | 'poison' | 'thorns' | 'item', source?: Ref): void {
    if (target.side === 'enemy' && this.enemies[target.index].dead) return;
    // プレイヤーへの攻撃は運で回避できる（最大50%）
    if (target.side === 'player' && kind === 'attack' && this.rng.chance(this.gs.evadeRate)) {
      this.emit({ t: 'damage', target, amount: 0, blocked: 0, hpAfter: this.getHp(target), blockAfter: this.getBlock(target), crit: false, evaded: true, kind });
      return;
    }
    let blocked = 0;
    let rest = amount;
    if (kind !== 'poison') {
      const blk = this.getBlock(target);
      blocked = Math.min(blk, rest);
      rest -= blocked;
      this.setBlock(target, blk - blocked);
    }
    this.setHp(target, this.getHp(target) - rest);
    this.emit({ t: 'damage', target, amount: rest, blocked, hpAfter: this.getHp(target), blockAfter: this.getBlock(target), crit, evaded: false, kind });

    if (target.side === 'enemy' && kind !== 'thorns') {
      this.gs.data.stats.damageDealt += rest;
      this.gs.data.stats.maxHit = Math.max(this.gs.data.stats.maxHit, rest);
    }
    // 棘：攻撃してきた相手にダメージを返す
    const thorns = this.statusesOf(target).thorns ?? 0;
    if (kind === 'attack' && thorns > 0 && source && this.getHp(target) > 0) {
      this.dealDamage(source, thorns, false, 'thorns');
    }
    this.checkDeath(target);
  }

  private checkDeath(r: Ref): void {
    if (r.side === 'enemy') {
      const e = this.enemies[r.index];
      if (!e.dead && e.hp <= 0) {
        e.dead = true;
        e.nextAction = null;
        this.gs.data.stats.enemiesKilled++;
        if (e.def.kind === 'boss') this.gs.data.stats.bossesKilled++;
        this.emit({ t: 'death', target: r });
      }
    }
  }

  private gainBlock(r: Ref, amount: number): void {
    if (amount <= 0) return;
    this.setBlock(r, this.getBlock(r) + amount);
    this.emit({ t: 'block', target: r, amount, blockAfter: this.getBlock(r) });
  }

  private healTarget(r: Ref, amount: number): void {
    const max = r.side === 'player' ? this.gs.maxHp : this.enemies[r.index].maxHp;
    const before = this.getHp(r);
    this.setHp(r, Math.min(max, before + Math.max(0, amount)));
    const healed = this.getHp(r) - before;
    if (healed > 0) this.emit({ t: 'heal', target: r, amount: healed, hpAfter: this.getHp(r) });
  }

  /** 状態異常を付与（封印は耐性チェックあり） */
  private addStatus(r: Ref, status: StatusId, amount: number): void {
    if (r.side === 'enemy' && this.enemies[r.index].dead) return;
    const s = this.statusesOf(r);
    if (status === 'stun') {
      const immune = r.side === 'enemy' && this.enemies[r.index].def.stunImmune;
      if (immune || (s.stunResist ?? 0) > 0) {
        this.emit({ t: 'resist', target: r });
        return;
      }
      s.stun = 1;
      this.emit({ t: 'status', target: r, status, delta: 1, total: 1 });
      return;
    }
    s[status] = (s[status] ?? 0) + amount;
    if ((s[status] ?? 0) <= 0) delete s[status];
    this.emit({ t: 'status', target: r, status, delta: amount, total: s[status] ?? 0 });
  }

  /** ターン終了時の状態異常の減少処理 */
  private endOfTurnStatuses(r: Ref): void {
    const s = this.statusesOf(r);
    // 再生：回復してから1減る
    if ((s.regen ?? 0) > 0) {
      this.healTarget(r, s.regen!);
      this.decStatus(r, 'regen');
    }
    if (s.turnStrength) {
      const v = s.turnStrength;
      delete s.turnStrength;
      this.emit({ t: 'status', target: r, status: 'turnStrength', delta: -v, total: 0 });
    }
    for (const k of ['weak', 'vulnerable', 'frail', 'stunResist'] as StatusId[]) if ((s[k] ?? 0) > 0) this.decStatus(r, k);
  }

  private decStatus(r: Ref, k: StatusId): void {
    const s = this.statusesOf(r);
    s[k] = (s[k] ?? 0) - 1;
    const total = Math.max(0, s[k]!);
    if (total <= 0) delete s[k];
    this.emit({ t: 'status', target: r, status: k, delta: -1, total });
  }

  /** 毒：ターン開始時にダメージを受け、1減る */
  private tickPoison(r: Ref): void {
    const p = this.statusesOf(r).poison ?? 0;
    if (p <= 0) return;
    this.dealDamage(r, p, false, 'poison');
    this.decStatus(r, 'poison');
  }

  // ---------------------------------------------------------
  // ドロー
  // ---------------------------------------------------------
  /** カードを引く。山札が足りなければ捨て札をシャッフルして山札にする */
  private drawCards(n: number): void {
    const drawn: string[] = [];
    for (let i = 0; i < n; i++) {
      if (this.hand.length >= BALANCE.HAND_LIMIT) break;
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break;
        if (drawn.length) this.emit({ t: 'draw', uids: drawn.splice(0) });
        this.drawPile = this.rng.shuffle(this.discardPile);
        this.discardPile = [];
        this.emit({ t: 'reshuffle', count: this.drawPile.length });
      }
      const c = this.drawPile.shift()!;
      this.hand.push(c);
      drawn.push(c.uid);
    }
    if (drawn.length) this.emit({ t: 'draw', uids: drawn });
  }

  // ---------------------------------------------------------
  // ターン進行
  // ---------------------------------------------------------
  private startPlayerTurn(): void {
    this.turn += 1;
    this.phase = 'player';
    this.emit({ t: 'turnStart', turn: this.turn });
    if (this.player.block > 0) {
      this.player.block = 0;
      this.emit({ t: 'block', target: { side: 'player' }, amount: 0, blockAfter: 0 });
    }
    this.tickPoison({ side: 'player' });
    if (this.checkEnd()) return;
    this.player.ap = this.player.maxAp;
    this.emit({ t: 'ap', value: this.player.ap, max: this.player.maxAp });
    this.drawCards(BALANCE.HAND_DRAW);
  }

  /** 全ての敵の次の行動を決める */
  private decideIntents(): void {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const acts = e.def.actions;
      let a: EnemyActionDef;
      if (e.def.pattern === 'cycle') {
        a = acts[e.cycleIndex % acts.length];
        e.cycleIndex++;
      } else {
        a = this.rng.weighted(acts, (x) => x.weight ?? 1);
        // 同じ行動が続きすぎないよう、1回だけ選び直す
        if (acts.length > 1 && a.id === e.lastActionId) a = this.rng.weighted(acts, (x) => x.weight ?? 1);
      }
      e.nextAction = a;
    }
    this.emit({ t: 'intents' });
  }

  /** 敵1体の行動 */
  private enemyAct(e: EnemyInstance): void {
    const ref: Ref = { side: 'enemy', index: e.index };
    if (e.block > 0) {
      e.block = 0;
      this.emit({ t: 'block', target: ref, amount: 0, blockAfter: 0 });
    }
    this.tickPoison(ref);
    if (e.dead) return;

    // 封印されていたら行動しない。次のターンは封印耐性を得る
    if ((e.statuses.stun ?? 0) > 0) {
      delete e.statuses.stun;
      this.emit({ t: 'stunned', index: e.index });
      this.emit({ t: 'status', target: ref, status: 'stun', delta: -1, total: 0 });
      this.addStatus(ref, 'stunResist', 2);
      return;
    }
    const a = e.nextAction;
    if (!a) return;
    e.lastActionId = a.id;
    this.emit({ t: 'enemyAction', index: e.index, name: a.name, intent: a.intent });
    for (const eff of a.effects) {
      switch (eff.kind) {
        case 'attack': {
          const hits = eff.hits ?? 1;
          for (let h = 0; h < hits; h++) {
            if (e.dead || this.gs.data.hp <= 0) break;
            this.emit({ t: 'attack', source: ref, target: { side: 'player' } });
            this.dealDamage({ side: 'player' }, this.calcEnemyDamage(e, eff.amount), false, 'attack', ref);
          }
          break;
        }
        case 'block': {
          const amt = Math.round(eff.amount * e.dmgMult);
          if (eff.target === 'allAllies') this.aliveEnemies.forEach((x) => this.gainBlock({ side: 'enemy', index: x.index }, amt));
          else this.gainBlock(ref, amt);
          break;
        }
        case 'status': {
          if (eff.target === 'player') this.addStatus({ side: 'player' }, eff.status, eff.amount);
          else if (eff.target === 'allAllies') this.aliveEnemies.forEach((x) => this.addStatus({ side: 'enemy', index: x.index }, eff.status, eff.amount));
          else this.addStatus(ref, eff.status, eff.amount);
          break;
        }
        case 'heal': {
          const amt = Math.round(eff.amount * e.dmgMult);
          if (eff.target === 'allAllies') this.aliveEnemies.forEach((x) => this.healTarget({ side: 'enemy', index: x.index }, amt));
          else this.healTarget(ref, amt);
          break;
        }
        case 'summon':
          this.summon(eff.enemyId);
          break;
      }
      if (this.checkEnd()) return;
    }
  }

  /** 召喚：空いている位置（倒れた敵の位置 or 新しい位置）に敵を出す */
  private summon(enemyId: string): void {
    if (this.aliveEnemies.length >= BALANCE.MAX_ENEMIES) return;
    let index = this.enemies.findIndex((x) => x.dead);
    if (index < 0) index = this.enemies.length;
    if (index >= BALANCE.MAX_ENEMIES) return;
    const inst = this.createEnemy(enemyId, index);
    // ボス戦の召喚は強敵補正を受けない（kind は戦闘全体のもの）
    this.enemies[index] = inst;
    this.emit({ t: 'summon', index });
  }

  /** 勝敗判定 */
  private checkEnd(): boolean {
    if (this.phase === 'won' || this.phase === 'lost') return true;
    if (this.gs.data.hp <= 0) {
      this.phase = 'lost';
      this.emit({ t: 'defeat' });
      return true;
    }
    if (this.aliveEnemies.length === 0) {
      this.phase = 'won';
      this.gs.data.stats.battlesWon++;
      this.emit({ t: 'victory' });
      return true;
    }
    return false;
  }
}
