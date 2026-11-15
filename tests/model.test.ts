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
import { STARTER_DECK, CARDS } from '@/data/cards';
import { ENEMIES } from '@/data/enemies';
import { GameState } from '@/model/GameState';
import { Combat } from '@/model/Combat';
import { rollStats } from '@/model/StatRoller';
import { generateEncounter, generateRoutes, isBossFloor } from '@/model/FloorGenerator';
import { rollBattleReward, rollShop } from '@/model/Loot';
import type { Stats } from '@/model/types';

const baseStats: Stats = { hp: 3, atk: 2, def: 2, mag: 1, luk: 0 };

function newGame(stats: Stats = baseStats, deck = STARTER_DECK): GameState {
  return GameState.create(12345, stats, [], false, deck);
}

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
  it('初期デッキは15枚（攻撃5・防御5・封印1・奮起2・取捨選択2）', () => {
    expect(STARTER_DECK.length).toBe(15);
    const count = (id: string) => STARTER_DECK.filter((x) => x === id).length;
    expect([count('strike'), count('defend'), count('seal'), count('rage'), count('scavenge')]).toEqual([5, 5, 1, 2, 2]);
  });
  it('所持金100G・最大HP=20+体力×10・AP3', () => {
    const gs = newGame();
    expect(gs.data.gold).toBe(100);
    expect(gs.maxHp).toBe(BALANCE.BASE_HP + 30);
    expect(gs.hp).toBe(BALANCE.BASE_HP + 30);
    expect(gs.maxAp).toBe(3);
  });
  it('金持ちの才能なら 1000G', () => {
    expect(GameState.create(1, baseStats, [], true, STARTER_DECK).data.gold).toBe(1000);
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
    const levels = gs.addExp(gs.expToNext);
    expect(levels).toEqual([2]);
    expect(gs.data.statPoints).toBe(2);
    gs.allocate({ hp: 2 });
    expect(gs.data.baseStats.hp).toBe(5);
    expect(gs.maxHp).toBe(BALANCE.BASE_HP + 50);
    expect(gs.hp).toBe(BALANCE.BASE_HP + 50); // 最大HPが増えた分、現在HPも増える
    gs.data.statPoints = 500;
    gs.allocate({ atk: 500 });
    expect(gs.data.baseStats.atk).toBe(99);
  });
});

/** 手札から指定IDのカードの uid を探す */
const uidOf = (c: Combat, id: string) => c.hand.find((h) => h.cardId === id)!.uid;

describe('戦闘', () => {
  const setup = (enemies = ['crawler'], deck = STARTER_DECK) => {
    const gs = newGame(baseStats, deck);
    const c = new Combat(gs, enemies, 'normal', 1, new Random(7));
    c.start();
    c.takeEvents();
    return { gs, c };
  };

  it('開始時に5枚引き、AP は 3', () => {
    const { c } = setup();
    expect(c.hand.length).toBe(5);
    expect(c.player.ap).toBe(3);
    expect(c.drawPile.length).toBe(10);
  });

  it('攻撃カード：1 + 攻撃力 のダメージ', () => {
    const { c } = setup(['crawler'], Array(15).fill('strike'));
    const hp = c.enemies[0].hp;
    expect(c.playCard(c.hand[0].uid, 0)).toBe('done');
    expect(c.enemies[0].hp).toBe(hp - (1 + baseStats.atk));
    expect(c.player.ap).toBe(2);
  });

  it('防御カード：1 + 防御力 のブロック', () => {
    const { c } = setup(['crawler'], Array(15).fill('defend'));
    c.playCard(c.hand[0].uid, null);
    expect(c.player.block).toBe(1 + baseStats.def);
  });

  it('奮起：このターンだけ攻撃力+5（ターン終了で消える）', () => {
    const { c } = setup(['crawler'], [...Array(5).fill('rage'), ...Array(10).fill('strike')]);
    c.playCard(uidOf(c, 'rage'), null);
    expect(c.calcPlayerDamage(1, 'atk', null)).toBe(1 + baseStats.atk + 5);
    c.endTurn();
    expect(c.player.statuses.turnStrength).toBeUndefined();
  });

  it('封印：敵は次の行動をしない＆封印耐性を得る', () => {
    const { gs, c } = setup(['crawler'], Array(15).fill('seal'));
    const hp = gs.hp;
    c.playCard(c.hand[0].uid, 0);
    expect(c.enemies[0].statuses.stun).toBe(1);
    c.endTurn();
    expect(gs.hp).toBe(hp); // 攻撃されていない
    expect(c.enemies[0].statuses.stunResist).toBeGreaterThan(0);
    // 耐性中はもう一度封印できない
    c.playCard(c.hand[0].uid, 0);
    expect(c.enemies[0].statuses.stun).toBeUndefined();
  });

  it('取捨選択：手札を1枚選んで廃棄し、2枚引く', () => {
    const { c } = setup(['crawler'], [...Array(5).fill('scavenge'), ...Array(10).fill('strike')]);
    const r = c.playCard(uidOf(c, 'scavenge'), null);
    expect(r).toBe('needChoice');
    const target = c.pending!.candidates[0];
    c.resolveChoice([target]);
    expect(c.exhaustPile.map((x) => x.uid)).toContain(target);
    expect(c.hand.length).toBe(5 - 1 - 1 + 2);
  });

  it('山札が尽きたら捨て札をシャッフルして引く', () => {
    const { c } = setup(['crawler'], Array(7).fill('defend'));
    c.endTurn(); // 5枚捨て → 山札2枚 → 2枚引いた後シャッフルして3枚引く
    expect(c.hand.length).toBe(5);
    expect(c.drawPile.length + c.discardPile.length + c.hand.length).toBe(7);
  });

  it('敵は右から行動する', () => {
    const { c } = setup(['rot_rat', 'crawler', 'rusted_sentry']);
    c.endTurn();
    const order = c.takeEvents().filter((e) => e.t === 'enemyAction').map((e: any) => e.index);
    expect(order).toEqual([2, 1, 0]);
  });

  it('敵を全滅させると勝利', () => {
    const { c } = setup(['rot_rat'], Array(15).fill('strike'));
    c.enemies[0].hp = 1;
    c.playCard(c.hand[0].uid, 0);
    expect(c.phase).toBe('won');
  });

  it('HPが0になると敗北', () => {
    const { gs, c } = setup(['crawler'], Array(15).fill('rage'));
    gs.data.hp = 1;
    c.enemies[0].statuses.strength = 99;
    c.endTurn();
    expect(c.phase).toBe('lost');
  });

  it('強敵は通常の敵より HP が2倍', () => {
    const gs = newGame();
    const n = new Combat(gs, ['iron_jailer'], 'normal', 5, new Random(3));
    const e = new Combat(gs, ['iron_jailer'], 'elite', 5, new Random(3));
    expect(e.enemies[0].maxHp / n.enemies[0].maxHp).toBeCloseTo(BALANCE.ELITE_HP_MULTIPLIER, 0);
  });
});

describe('塔の構成', () => {
  it('10Fごとにボス', () => {
    expect(isBossFloor(10)).toBe(true);
    expect(isBossFloor(100)).toBe(true);
    expect(isBossFloor(11)).toBe(false);
    expect(generateRoutes(20, new Random(1), false)).toEqual(['boss']);
  });
  it('2F以降は異なる2択', () => {
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
  it('カード報酬は3枚で、現在は初期デッキのカードのみ', () => {
    const starterIds = new Set(STARTER_DECK);
    const rng = new Random(2);
    for (let i = 0; i < 50; i++) {
      const r = rollBattleReward(5, 'normal', rng);
      expect(r.cardChoices.length).toBe(3);
      r.cardChoices.forEach((id) => expect(starterIds.has(id)).toBe(true));
    }
  });
  it('闇商人は約20%で出現する', () => {
    const rng = new Random(4);
    let dark = 0;
    for (let i = 0; i < 2000; i++) if (rollShop(10, rng).dark) dark++;
    expect(dark / 2000).toBeGreaterThan(0.15);
    expect(dark / 2000).toBeLessThan(0.25);
  });
  it('全カードの画像パスが設定されている', () => {
    CARDS.forEach((c) => expect(c.image).toMatch(/^images\/cards\/.+\.png$/));
  });
});
