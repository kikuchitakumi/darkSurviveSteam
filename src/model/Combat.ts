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
import type { CardDef, Effect, EnemyActionDef, EnemyDef, IntentType, StatusId, ValueFormula, ValueSource } from './types';

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
  | { t: 'damage'; target: Ref; amount: number; blocked: number; hpAfter: number; blockAfter: number; crit: boolean; evaded: boolean; kind: DamageKind }
  | { t: 'block'; target: Ref; amount: number; blockAfter: number }
  | { t: 'heal'; target: Ref; amount: number; hpAfter: number }
  | { t: 'status'; target: Ref; status: StatusId; delta: number; total: number }
  | { t: 'resist'; target: Ref }
  | { t: 'cost'; uid: string; cost: number }
  | { t: 'enemyAction'; index: number; name: string; intent: IntentType }
  | { t: 'stunned'; index: number }
  | { t: 'death'; target: Ref }
  | { t: 'summon'; index: number }
  | { t: 'intents' }
  | { t: 'victory' }
  | { t: 'defeat' };

/** ダメージの種類（演出の出し分けに使う） */
export type DamageKind = 'attack' | 'poison' | 'curse' | 'thorns' | 'item' | 'self';

/** プレイヤーに選択を求めている状態（手札から廃棄するカード・コストを下げるカードを選ぶ） */
export interface PendingChoice {
  kind: 'exhaustFromHand' | 'reduceCost';
  count: number;
  candidates: string[];
  /** reduceCost の時：下げる量 */
  amount?: number;
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

  // ---- カードの効果で参照する「戦闘中の記録」 ----
  /** このターンに使ったカードの枚数（憤怒） */
  cardsPlayedTurn = 0;
  /** 前のプレイヤーターン終了から受けたダメージ（報復） */
  damageTakenTurn = 0;
  /** この戦闘中に減った HP の合計（死屍累々） */
  hpLostBattle = 0;
  /** この戦闘中だけ増えた最大AP（誇り） */
  maxApBonus = 0;
  /** X コストのカードを使った時の X（残りAP） */
  currentX = 0;
  /** この戦闘中のコスト軽減（選択）：カードの uid → 下げる量 */
  costMods = new Map<string, number>();

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
    this.player.maxAp = this.gs.maxAp + this.maxApBonus;
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
    if (this.costOf(uid) > this.player.ap) return { ok: false, reason: 'ap' };
    return { ok: true };
  }

  /**
   * 手札のカードの実際のコスト（「選択」による軽減を反映）。
   * X コストは 0 扱い（残りAPを全て使う）。
   */
  costOf(uid: string): number {
    const c = this.hand.find((h) => h.uid === uid) ?? this.drawPile.concat(this.discardPile).find((h) => h.uid === uid);
    if (!c) return 0;
    const def = getCard(c.cardId);
    if (def.cost === 'X') return 0;
    return Math.max(0, def.cost - (this.costMods.get(uid) ?? 0));
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
    if (def.cost === 'X') {
      // X コスト：残りAPを全て使い、その数を X とする
      this.currentX = this.player.ap;
      this.player.ap = 0;
    } else {
      this.currentX = 0;
      this.player.ap -= this.costOf(uid);
    }
    this.emit({ t: 'ap', value: this.player.ap, max: this.player.maxAp });
    this.hand = this.hand.filter((h) => h.uid !== uid);
    this.cardsPlayedTurn++;
    this.emit({ t: 'cardPlayed', uid, cardId: def.id, target });
    this.gs.data.stats.cardsPlayed++;
    return this.runCardEffects(card, def, def.effects, target);
  }

  /** 選択待ち（手札から廃棄）の決定 */
  resolveChoice(uids: string[]): void {
    if (!this.pending || !this.resume) return;
    const picked = uids.filter((u) => this.pending!.candidates.includes(u)).slice(0, this.pending.count);
    if (this.pending.kind === 'reduceCost') {
      for (const u of picked) this.reduceCost(u, this.pending.amount ?? 1);
    } else {
      for (const u of picked) this.exhaustFromHand(u);
    }
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
    // 「このターン受けたダメージ（報復）」は、ここから次のプレイヤーターン中までを数える
    this.damageTakenTurn = 0;

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
    // 敵ターンの終了時：呪いの数だけダメージ（シールド無視・呪いは減らない）
    for (const e of this.enemies) {
      const curse = e.statuses.curse ?? 0;
      if (!e.dead && curse > 0) this.dealDamage({ side: 'enemy', index: e.index }, curse, false, 'curse');
    }
    if (this.checkEnd()) return;
    for (const e of this.enemies) if (!e.dead) this.endOfTurnStatuses({ side: 'enemy', index: e.index });
    if (this.checkEnd()) return;

    this.decideIntents();
    this.startPlayerTurn();
  }

  // =========================================================
  // 数値計算（View のプレビュー表示にも使う）
  // =========================================================

  /** 攻撃力（奮起中は2倍） */
  get effectiveAtk(): number {
    return this.gs.stats.atk * ((this.player.statuses.atkDouble ?? 0) > 0 ? 2 : 1);
  }

  /** 計算式の「もと」の値 */
  sourceValue(src: ValueSource): number {
    switch (src) {
      case 'atk': return this.effectiveAtk;
      case 'mag': return this.gs.stats.mag;
      case 'def': return this.gs.stats.def;
      case 'cardsPlayedTurn': return this.cardsPlayedTurn;
      case 'damageTakenTurn': return this.damageTakenTurn;
      case 'hpLostBattle': return this.hpLostBattle;
      case 'turn': return this.turn;
      default: return 0;
    }
  }

  /**
   * 計算式の値：amount + mult × (scale の値) × (xMult なら X)
   * @param defaultScale scale 省略時の扱い（旧カード互換：ダメージ=攻撃力、シールド=防御力）
   * @param x X の値（プレビュー時は現在のAPを渡す）
   */
  formulaValue(f: ValueFormula, defaultScale: ValueSource, x = this.currentX): number {
    const scale = f.scale ?? defaultScale;
    const mult = f.mult ?? 1;
    return (f.amount ?? 0) + mult * this.sourceValue(scale) * (f.xMult ? x : 1);
  }

  /** プレイヤーの攻撃1回あたりのダメージ（クリティカル前）。筋力などの「ダメージ増加」はカードの攻撃全てに乗る */
  calcPlayerDamage(f: ValueFormula, targetIndex: number | null, fromItem = false, x = this.currentX): number {
    const s = this.player.statuses;
    let dmg = this.formulaValue(f, fromItem ? 'none' : 'atk', x);
    if (!fromItem) dmg += (s.strength ?? 0) + (s.turnStrength ?? 0);
    if ((s.weak ?? 0) > 0) dmg *= BALANCE.WEAK_MULTIPLIER;
    const t = targetIndex !== null ? this.enemies[targetIndex] : null;
    if (t && (t.statuses.vulnerable ?? 0) > 0) dmg *= BALANCE.VULNERABLE_MULTIPLIER;
    return Math.max(0, Math.floor(dmg));
  }

  /** プレイヤーが得るシールド量 */
  calcPlayerBlock(f: ValueFormula, fromItem = false, x = this.currentX): number {
    const s = this.player.statuses;
    let b = this.formulaValue(f, fromItem ? 'none' : 'def', x);
    if (!fromItem) b += s.dexterity ?? 0;
    if ((s.frail ?? 0) > 0) b *= BALANCE.FRAIL_MULTIPLIER;
    return Math.max(0, Math.floor(b));
  }

  /** 回復量 */
  calcHeal(f: ValueFormula, x = this.currentX): number {
    return Math.max(0, Math.floor(this.formulaValue(f, 'none', x)));
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

  /**
   * カード説明文の {damage} {hits} {block} {heal} {curse} {self} {x} に入れる数値。
   * X コストのカードは「今のAP」を X として計算する。
   */
  cardNumbers(def: CardDef, targetIndex: number | null = null): Record<string, number> {
    const out: Record<string, number> = {};
    const x = def.cost === 'X' ? this.player.ap : 0;
    out.x = x;
    for (const eff of def.effects) {
      if (eff.kind === 'damage' && out.damage === undefined) {
        out.damage = this.calcPlayerDamage(eff, eff.target === 'all' ? null : targetIndex, false, x);
        out.hits = eff.hits === 'X' ? x : eff.hits ?? 1;
      } else if (eff.kind === 'block' && out.block === undefined) out.block = this.calcPlayerBlock(eff, false, x);
      else if (eff.kind === 'heal' && out.heal === undefined) out.heal = this.calcHeal(eff, x);
      else if (eff.kind === 'selfDamage' && out.self === undefined) out.self = Math.floor(this.formulaValue(eff, 'none', x));
      else if (eff.kind === 'status' && eff.status === 'curse' && out.curse === undefined) out.curse = Math.floor(this.formulaValue(eff, 'none', x));
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
      if (eff.kind === 'reduceCostChoice') {
        const candidates = this.hand.filter((h) => getCard(h.cardId).cost !== 'X').map((h) => h.uid);
        if (candidates.length === 0) continue;
        if (candidates.length === 1) {
          this.reduceCost(candidates[0], eff.amount);
          continue;
        }
        this.pending = { kind: 'reduceCost', count: 1, candidates, amount: eff.amount };
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

  /** この戦闘中、カードのコストを下げる（選択） */
  private reduceCost(uid: string, amount: number): void {
    this.costMods.set(uid, (this.costMods.get(uid) ?? 0) + amount);
    this.emit({ t: 'cost', uid, cost: this.costOf(uid) });
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
        const hits = eff.hits === 'X' ? this.currentX : eff.hits ?? 1;
        for (let h = 0; h < hits; h++) {
          for (const ti of targets) {
            const en = this.enemies[ti];
            if (!en || en.dead) continue;
            let dmg = this.calcPlayerDamage(eff, ti, fromItem);
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
        this.gainBlock({ side: 'player' }, this.calcPlayerBlock(eff, fromItem));
        break;
      }
      case 'status': {
        const t = eff.target ?? 'target';
        const amount = Math.floor(this.formulaValue(eff, 'none'));
        if (amount === 0) break;
        if (t === 'self') this.addStatus({ side: 'player' }, eff.status, amount);
        else for (const ti of this.resolveTargets(t === 'all' ? 'all' : 'target', target)) this.addStatus({ side: 'enemy', index: ti }, eff.status, amount);
        break;
      }
      case 'selfDamage':
        this.dealDamage({ side: 'player' }, Math.floor(this.formulaValue(eff, 'none')), false, 'self');
        break;
      case 'breakBlock': {
        for (const ti of this.resolveTargets(eff.target ?? 'target', target)) {
          const en = this.enemies[ti];
          if (!en || en.dead || en.block <= 0) continue;
          en.block = Math.floor(en.block * (1 - eff.percent / 100));
          this.emit({ t: 'block', target: { side: 'enemy', index: ti }, amount: 0, blockAfter: en.block });
        }
        break;
      }
      case 'maxAp':
        this.maxApBonus += eff.amount;
        this.player.maxAp += eff.amount;
        this.player.ap += eff.amount;
        this.emit({ t: 'ap', value: this.player.ap, max: this.player.maxAp });
        break;
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
        this.healTarget({ side: 'player' }, this.calcHeal(eff));
        break;
      case 'healPercent':
        this.healTarget({ side: 'player' }, Math.ceil((this.gs.maxHp * eff.percent) / 100));
        break;
      case 'exhaustChoice':
      case 'reduceCostChoice':
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
  private dealDamage(target: Ref, amount: number, crit: boolean, kind: DamageKind, source?: Ref): void {
    if (target.side === 'enemy' && this.enemies[target.index].dead) return;
    // プレイヤーへの攻撃は運で回避できる（最大50%）
    if (target.side === 'player' && kind === 'attack' && this.rng.chance(this.gs.evadeRate)) {
      this.emit({ t: 'damage', target, amount: 0, blocked: 0, hpAfter: this.getHp(target), blockAfter: this.getBlock(target), crit: false, evaded: true, kind });
      return;
    }
    let blocked = 0;
    let rest = amount;
    // 毒・呪い・自傷はシールドを無視する
    if (kind !== 'poison' && kind !== 'curse' && kind !== 'self') {
      const blk = this.getBlock(target);
      blocked = Math.min(blk, rest);
      rest -= blocked;
      this.setBlock(target, blk - blocked);
    }
    const before = this.getHp(target);
    this.setHp(target, before - rest);
    this.emit({ t: 'damage', target, amount: rest, blocked, hpAfter: this.getHp(target), blockAfter: this.getBlock(target), crit, evaded: false, kind });
    if (target.side === 'player') {
      const lost = before - this.getHp(target);
      this.hpLostBattle += lost;
      this.damageTakenTurn += lost;
    }

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
    for (const k of ['turnStrength', 'atkDouble'] as StatusId[]) {
      const v = s[k];
      if (!v) continue;
      delete s[k];
      this.emit({ t: 'status', target: r, status: k, delta: -v, total: 0 });
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
    this.cardsPlayedTurn = 0;
    const st = this.player.statuses;
    this.tickPoison({ side: 'player' });
    // 血の代償：毎ターン自分にダメージ
    if ((st.bloodPrice ?? 0) > 0) this.dealDamage({ side: 'player' }, st.bloodPrice!, false, 'self');
    if (this.checkEnd()) return;
    // 奮起：予約していた「攻撃力2倍」をこのターンに適用
    if ((st.atkDoubleNext ?? 0) > 0) {
      delete st.atkDoubleNext;
      this.emit({ t: 'status', target: { side: 'player' }, status: 'atkDoubleNext', delta: -1, total: 0 });
      this.addStatus({ side: 'player' }, 'atkDouble', 1);
    }
    // 不屈の守勢：毎ターン 防御力×N のシールド
    if ((st.fortify ?? 0) > 0) this.gainBlock({ side: 'player' }, this.calcPlayerBlock({ amount: 0, scale: 'def', mult: st.fortify! }));
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
            const dmg = this.calcEnemyDamage(e, eff.amount);
            this.dealDamage({ side: 'player' }, dmg, false, 'attack', ref);
            // しっぺ返し：攻撃した敵は、その攻撃力と同じダメージを受ける
            if ((this.player.statuses.retribution ?? 0) > 0 && !e.dead && dmg > 0) this.dealDamage(ref, dmg, false, 'thorns');
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
