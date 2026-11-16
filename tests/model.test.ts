// =============================================================
// model.test.ts  【テスト：ゲームロジック（Model）】
// -------------------------------------------------------------
// 実行: npm test
// 画面に依存しない Model 部分（戦闘・成長・抽選）が仕様通りに動くかを確認する。
// ルールを変えた時は、まずこのテストが通るかを見ると安心。
// =============================================================
import { describe, expect, it } from 'vitest';
import { Random } from '@/core/Random';
import { BALANCE } from '@/config/balance';
import { CARDS, cardWeightAt, getCard, getStarterDeck } from '@/data/cards';
import { ENEMIES } from '@/data/enemies';
import { GameState } from '@/model/GameState';
import { Combat } from '@/model/Combat';
import { rollStats } from '@/model/StatRoller';
import { generateEncounter, generateRoutes, isBossFloor } from '@/model/FloorGenerator';
import { rollBattleReward, rollShop } from '@/model/Loot';
import type { Stats } from '@/model/types';

const baseStats: Stats = { hp: 3, atk: 2, def: 2, mag: 3, luk: 0 };

function newGame(stats: Stats = baseStats, deck = getStarterDeck()): GameState {
  return GameState.create(12345, stats, [], false, deck);
}

/** 指定したカードだけのデッキで戦闘を始める */
function setup(deck: string[], enemies = ['crawler'], stats: Stats = baseStats) {
  const gs = newGame(stats, deck);
  const c = new Combat(gs, enemies, 'normal', 1, new Random(7));
  c.start();
  c.takeEvents();
  return { gs, c };
}
/** 手札から指定IDのカードの uid を探す（手札に無ければ山札・捨て札から手札へ移す） */
function uidOf(c: Combat, id: string): string {
  let card = c.hand.find((h) => h.cardId === id);
  if (!card) {
    for (const pile of [c.drawPile, c.discardPile]) {
      const i = pile.findIndex((h) => h.cardId === id);
      if (i >= 0) {
        card = pile.splice(i, 1)[0];
        c.hand.push(card);
        break;
      }
    }
  }
  return card!.uid;
}
const fill = (id: string, n = 15) => Array(n).fill(id);

describe('乱数', () => {
  it('同じシードなら同じ結果になる', () => {
    const a = new Random(42);
    const b = new Random(42);
    expect([a.next(), a.next(), a.int(1, 5)]).toEqual([b.next(), b.next(), b.int(1, 5)]);
  });
});

describe('ステータス抽選', () => {
  it('各ステータスは 1～5（才能なら 8～12）', () => {
    const rng = new Random(1);
    for (let i = 0; i < 500; i++) {
      const r = rollStats(rng);
      for (const [k, v] of Object.entries(r.stats)) {
        if (r.talents.includes(k as any)) expect(v).toBeGreaterThanOrEqual(BALANCE.TALENT_ROLL_MIN);
        else {
          expect(v).toBeGreaterThanOrEqual(1);
          expect(v).toBeLessThanOrEqual(5);
        }
      }
    }
  });
});

describe('初期状態', () => {
  it('初期デッキは12枚（ブロック3・鉄壁1・一閃3・骨断ち1・黒炎3・業火1）', () => {
    const deck = getStarterDeck();
    expect(deck.length).toBe(12);
    const count = (id: string) => deck.filter((x) => x === id).length;
    expect([count('block'), count('iron_wall'), count('issen'), count('bone_breaker'), count('black_flame'), count('inferno')]).toEqual([3, 1, 3, 1, 3, 1]);
  });
  it('所持金100G・最大HP=20+体力×10・AP3', () => {
    const gs = newGame();
    expect(gs.data.gold).toBe(100);
    expect(gs.maxHp).toBe(BALANCE.BASE_HP + 30);
    expect(gs.maxAp).toBe(3);
  });
  it('全カードのIDが重複していない', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });
});

describe('レベルアップ', () => {
  it('レベルごとのステータスポイント（2 / Lv20〜3 / Lv40〜4 / Lv50〜5 / 10の倍数で+5）', () => {
    expect(BALANCE.statPointsForLevel(2)).toBe(2);
    expect(BALANCE.statPointsForLevel(10)).toBe(7);
    expect(BALANCE.statPointsForLevel(21)).toBe(3);
    expect(BALANCE.statPointsForLevel(40)).toBe(9);
    expect(BALANCE.statPointsForLevel(55)).toBe(5);
  });
  it('経験値でレベルが上がり、ポイントを割り振れる（上限99）', () => {
    const gs = newGame();
    expect(gs.addExp(gs.expToNext)).toEqual([2]);
    gs.allocate({ hp: 2 });
    expect(gs.maxHp).toBe(BALANCE.BASE_HP + 50);
    gs.data.statPoints = 500;
    gs.allocate({ atk: 500 });
    expect(gs.data.baseStats.atk).toBe(99);
  });
});

describe('戦闘：基本', () => {
  it('開始時に5枚引き、AP は 3', () => {
    const { c } = setup(getStarterDeck());
    expect(c.hand.length).toBe(5);
    expect(c.player.ap).toBe(3);
  });

  it('山札が尽きたら捨て札をシャッフルして引く', () => {
    const { c } = setup(fill('block', 7));
    c.endTurn();
    expect(c.hand.length).toBe(5);
    expect(c.drawPile.length + c.discardPile.length + c.hand.length).toBe(7);
  });

  it('敵は右から行動する', () => {
    const { c } = setup(fill('block'), ['rot_rat', 'crawler', 'rusted_sentry']);
    c.endTurn();
    const order = c.takeEvents().filter((e) => e.t === 'enemyAction').map((e: any) => e.index);
    expect(order).toEqual([2, 1, 0]);
  });

  it('敵を全滅させると勝利 / HP0で敗北', () => {
    const a = setup(fill('issen'), ['rot_rat']);
    a.c.enemies[0].hp = 1;
    a.c.playCard(a.c.hand[0].uid, 0);
    expect(a.c.phase).toBe('won');
    const b = setup(fill('block'));
    b.gs.data.hp = 1;
    b.c.enemies[0].statuses.strength = 99;
    b.c.endTurn();
    expect(b.c.phase).toBe('lost');
  });

  it('強敵は通常の敵より HP が2倍', () => {
    const gs = newGame();
    const n = new Combat(gs, ['iron_jailer'], 'normal', 5, new Random(3));
    const e = new Combat(gs, ['iron_jailer'], 'elite', 5, new Random(3));
    expect(e.enemies[0].maxHp / n.enemies[0].maxHp).toBeCloseTo(BALANCE.ELITE_HP_MULTIPLIER, 0);
  });
});

describe('戦闘：新カードの効果', () => {
  it('一閃＝攻撃力×1 / 骨断ち＝攻撃力×3 / 黒炎＝魔力×1 / 業火＝魔力×3', () => {
    const { c } = setup(['issen', 'bone_breaker', 'black_flame', 'inferno', ...fill('block', 11)]);
    expect(c.cardNumbers(getCard('issen')).damage).toBe(baseStats.atk);
    expect(c.cardNumbers(getCard('bone_breaker')).damage).toBe(baseStats.atk * 3);
    expect(c.cardNumbers(getCard('black_flame')).damage).toBe(baseStats.mag);
    expect(c.cardNumbers(getCard('inferno')).damage).toBe(baseStats.mag * 3);
  });

  it('ブロック＝防御力×1 / 鉄壁＝防御力×3 のシールド', () => {
    const { c } = setup(['block', 'iron_wall', ...fill('issen', 13)]);
    c.playCard(uidOf(c, 'block'), null);
    expect(c.player.block).toBe(baseStats.def);
    c.playCard(uidOf(c, 'iron_wall'), null);
    expect(c.player.block).toBe(baseStats.def * 4);
  });

  it('三閃撃は3回ダメージ', () => {
    const { c } = setup(fill('triple_slash'));
    const hp = c.enemies[0].hp;
    c.playCard(c.hand[0].uid, 0);
    expect(hp - c.enemies[0].hp).toBe(baseStats.atk * 3);
  });

  it('X コスト：残りAPを全て使い、X 倍になる（致死の一撃）', () => {
    const { c } = setup(fill('lethal_blow'));
    const hp = c.enemies[0].hp;
    c.playCard(c.hand[0].uid, 0);
    expect(c.player.ap).toBe(0);
    expect(hp - c.enemies[0].hp).toBe(baseStats.atk * 3);
  });

  it('獅子乱舞：攻撃力×1 を X 回', () => {
    const { c } = setup(fill('lion_dance'));
    const ev0 = c.enemies[0].hp;
    c.playCard(c.hand[0].uid, 0);
    expect(ev0 - c.enemies[0].hp).toBe(baseStats.atk * 3);
  });

  it('呪い：敵ターン終了時に呪いの数だけダメージ（減らない）', () => {
    const { c } = setup(fill('curse_flame'), ['rusted_sentry']);
    c.playCard(c.hand[0].uid, 0);
    expect(c.enemies[0].statuses.curse).toBe(baseStats.mag);
    const hp = c.enemies[0].hp;
    c.endTurn();
    expect(hp - c.enemies[0].hp).toBe(baseStats.mag);
    expect(c.enemies[0].statuses.curse).toBe(baseStats.mag);
  });

  it('積年の恨み：現在のターン数だけ呪い', () => {
    const { c } = setup(fill('grudge'));
    c.playCard(c.hand[0].uid, 0);
    expect(c.enemies[0].statuses.curse).toBe(1);
  });

  it('憤怒：このターンに使ったカード枚数×5', () => {
    const { c } = setup(['inspiration', 'inspiration', 'fury', ...fill('block', 12)]);
    c.enemies[0].hp = c.enemies[0].maxHp = 999;
    c.playCard(uidOf(c, 'inspiration'), null);
    c.playCard(uidOf(c, 'inspiration'), null);
    const hp = c.enemies[0].hp;
    c.playCard(uidOf(c, 'fury'), 0);
    expect(hp - c.enemies[0].hp).toBe(15);
  });

  it('血閃：自分に2ダメージ、攻撃力×2のダメージ / 死屍累々：減ったHPぶん', () => {
    const { gs, c } = setup(['blood_flash', 'corpse_pile', ...fill('block', 13)]);
    const myHp = gs.hp;
    c.playCard(uidOf(c, 'blood_flash'), 0);
    expect(myHp - gs.hp).toBe(2);
    expect(c.hpLostBattle).toBe(2);
    expect(c.cardNumbers(getCard('corpse_pile')).damage).toBe(2);
  });

  it('鎧砕き：敵のシールドを50%下げる', () => {
    const { c } = setup(fill('armor_break'));
    c.enemies[0].block = 10;
    c.playCard(c.hand[0].uid, 0);
    expect(c.enemies[0].block).toBe(5);
  });

  it('誇り：この戦闘中、最大APが1上がる', () => {
    const { c } = setup(fill('pride'));
    c.playCard(c.hand[0].uid, null);
    expect(c.player.maxAp).toBe(4);
    c.endTurn();
    expect(c.player.ap).toBe(4);
  });

  it('選択：選んだカードのコストが -1 になる', () => {
    const { c } = setup(['selection', 'bone_breaker', 'iron_wall', ...fill('block', 12)]);
    const target = uidOf(c, 'bone_breaker');
    uidOf(c, 'iron_wall');
    const r = c.playCard(uidOf(c, 'selection'), null);
    expect(r).toBe('needChoice');
    c.resolveChoice([target]);
    expect(c.costOf(target)).toBe(1);
  });

  it('奮起：次のターン攻撃力が2倍', () => {
    const { c } = setup(['rally', ...fill('issen', 14)]);
    c.playCard(uidOf(c, 'rally'), null);
    expect(c.effectiveAtk).toBe(baseStats.atk);
    c.endTurn();
    expect(c.effectiveAtk).toBe(baseStats.atk * 2);
    c.endTurn();
    expect(c.effectiveAtk).toBe(baseStats.atk);
  });

  it('不屈の守勢：毎ターン 防御力×1 のシールド', () => {
    const { c } = setup(['steadfast', ...fill('issen', 14)], ['rusted_sentry']);
    c.player.ap = 5;
    c.playCard(uidOf(c, 'steadfast'), null);
    c.endTurn();
    expect(c.player.block).toBe(baseStats.def);
  });

  it('しっぺ返し：攻撃した敵がその攻撃力ぶんのダメージを受ける', () => {
    const { c } = setup(fill('tit_for_tat'), ['rot_rat']);
    c.enemies[0].nextAction = c.enemies[0].def.actions.find((a) => a.intent === 'attack')!;
    c.playCard(c.hand[0].uid, null);
    const hp = c.enemies[0].hp;
    c.endTurn();
    expect(c.enemies[0].hp).toBeLessThan(hp);
  });

  it('謀略：敵は次の行動をしない＆封印耐性を得る', () => {
    const { gs, c } = setup(fill('scheme'));
    const hp = gs.hp;
    c.playCard(c.hand[0].uid, 0);
    c.endTurn();
    expect(gs.hp).toBe(hp);
    expect(c.enemies[0].statuses.stunResist).toBeGreaterThan(0);
  });
});

describe('塔の構成', () => {
  it('10Fごとにボス / 2F以降は異なる2択', () => {
    expect(isBossFloor(10)).toBe(true);
    expect(generateRoutes(20, new Random(1), false)).toEqual(['boss']);
    const rng = new Random(9);
    for (let f = 2; f < 100; f++) {
      if (isBossFloor(f)) continue;
      const r = generateRoutes(f, rng, false);
      expect(r.length).toBe(2);
      expect(r[0]).not.toBe(r[1]);
    }
  });
  it('敵は最大3体・全ボス階にボスがいる', () => {
    const rng = new Random(5);
    for (let f = 1; f <= 100; f++) {
      expect(generateEncounter(f, 'normal', rng).length).toBeLessThanOrEqual(3);
      if (isBossFloor(f)) expect(ENEMIES.find((e) => e.bossFloor === f)).toBeDefined();
    }
  });
});

describe('報酬・ショップ', () => {
  it('カード報酬は重複なしの3枚', () => {
    const rng = new Random(2);
    for (let i = 0; i < 50; i++) {
      const r = rollBattleReward(5, 'normal', rng);
      expect(r.cardChoices.length).toBe(3);
      expect(new Set(r.cardChoices).size).toBe(3);
    }
  });
  it('出現階の範囲外のカードは報酬に出ない（レジェンドは12F未満で出ない）', () => {
    const rng = new Random(3);
    const legend = new Set(CARDS.filter((c) => c.rarity === 'legendary').map((c) => c.id));
    for (let i = 0; i < 200; i++) rollBattleReward(2, 'normal', rng).cardChoices.forEach((id) => expect(legend.has(id)).toBe(false));
    expect(cardWeightAt(getCard('lion_dance'), 2)).toBe(0);
    expect(cardWeightAt(getCard('lion_dance'), 50)).toBeGreaterThan(0);
  });
  it('闇商人は約20%で出現する', () => {
    const rng = new Random(4);
    let dark = 0;
    for (let i = 0; i < 2000; i++) if (rollShop(10, rng).dark) dark++;
    expect(dark / 2000).toBeGreaterThan(0.15);
    expect(dark / 2000).toBeLessThan(0.25);
  });
});
